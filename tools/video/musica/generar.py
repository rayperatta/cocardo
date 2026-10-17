#!/usr/bin/env python3
"""Genera música instrumental con ACE-Step 1.5 (local, en la GPU) a partir de un JSON de pedidos.

Corre en el venv de música (~/.local/share/cocardo-estudio/musica/venv); lo más simple es el lanzador musica.sh, que
además deja todas las cachés fuera del repo. Toma el candado de la GPU él solo (no lo envuelvas en flock) y lo suelta
apenas termina de generar.
Uso:
  tools/video/musica/musica.sh generar [pedidos.json] [--solo tema-1,drama-2] [--forzar]
Cada pedido: id, grupo, estilo (texto que lee el modelo), bpm, duracion (s que se le piden al modelo) y semilla;
opcionales: tonalidad («G major»), compas (4 = 4/4), pasos, fundido (s de salida) y modelo (acestep-v15-turbo).
«grupos» da a cada grupo su rango de duración final: se quitan los silencios de las puntas (el modelo a veces termina
antes) y lo que pase del máximo se corta con un fundido.
Lo crudo del modelo queda en ~/.local/share/cocardo-estudio/musica/crudos/ (la misma semilla da la misma pista):
si ya está, no se usa la GPU. --forzar lo rehace igual.
Salida en dist/estudio/musica/: <id>.wav (48 kHz, estéreo, 16 bits, −16 LUFS, pico real ≤ −1 dBTP) y <id>.json.
Después pasa revisar.py: comprueba voz, bpm y bucle, y elegir.py deja elegidas.json (lo que usan los montajes) y la
página para cambiar la elección.
"""
import argparse
import fcntl
import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[3]
ESTUDIO = Path.home() / '.local/share/cocardo-estudio'
CANDADO = ESTUDIO / 'gpu.lock'
ACE = ESTUDIO / 'musica/ACE-Step-1.5'          # clon del repositorio oficial (ace-step/ACE-Step-1.5)
PESOS = ESTUDIO / 'musica/checkpoints'          # HF ACE-Step/Ace-Step1.5 (DiT turbo, VAE, codificador y LM 1.7B)
CRUDOS = ESTUDIO / 'musica/crudos'
SALIDA = REPO / 'dist/estudio/musica'
MODELO, LM = 'acestep-v15-turbo', 'acestep-5Hz-lm-1.7B'
SR, LUFS, TECHO_DB = 48000, -16.0, -1.0
# Campos del pedido que cambian lo que genera el modelo (lo demás es posproceso)
DEL_MODELO = ('estilo', 'bpm', 'duracion', 'tonalidad', 'compas', 'semilla', 'pasos', 'modelo')

# Cachés fuera del repo: ACE-Step guarda las suyas en <ACESTEP_PROJECT_ROOT>/.cache/acestep o, sin esa variable, en la
# carpeta desde donde se lanza (la raíz del repo). Y nada de __pycache__ en tools/.
os.environ['ACESTEP_PROJECT_ROOT'] = str(ESTUDIO / 'musica')
os.environ.setdefault('HF_HOME', str(ESTUDIO / 'hf'))
sys.dont_write_bytecode = True


def cargar(modelo):
    """DiT (difusión de audio) + LM de 5 Hz (planea la estructura y escribe los códigos de audio)."""
    os.environ['ACESTEP_CHECKPOINTS_DIR'] = str(PESOS)
    from acestep.handler import AceStepHandler
    from acestep.llm_inference import LLMHandler
    dit = AceStepHandler()
    # Con «offload» cada modelo vuelve a la RAM cuando no le toca: el pico baja de ~14 GB a ~8 GB
    msg, ok = dit.initialize_service(project_root=str(ACE), config_path=modelo, device='cuda', offload_to_cpu=True)
    if not ok:
        sys.exit(f'No cargó {modelo}: {msg}')
    lm = LLMHandler()
    # Backend «pt» (PyTorch puro): el de vLLM pide flash-attn, que solo viene como binario de terceros
    msg, ok = lm.initialize(checkpoint_dir=str(PESOS), lm_model_path=LM, backend='pt', device='cuda',
                           offload_to_cpu=True)
    if not ok:
        sys.exit(f'No cargó {LM}: {msg}')
    return dit, lm


def generar(dit, lm, p, modelo):
    """Un pedido → audio float (muestras, canales), su frecuencia y los metadatos que eligió el LM."""
    import random

    import torch
    from acestep.inference import GenerationConfig, GenerationParams, generate_music
    turbo = 'turbo' in modelo
    params = GenerationParams(
        caption=p['estilo'], lyrics='[Instrumental]', instrumental=True,
        bpm=int(p['bpm']), keyscale=p.get('tonalidad', ''), timesignature=str(p.get('compas', 4)),
        duration=float(p['duracion']), seed=int(p['semilla']),
        inference_steps=int(p.get('pasos', 8 if turbo else 50)), shift=3.0 if turbo else 1.0,
        guidance_scale=1.0 if turbo else 7.0,
        # El LM respeta nuestro texto y datos: no reescribe el estilo ni adivina idioma (así no inventa voz)
        thinking=True, use_cot_caption=False, use_cot_metas=False, use_cot_language=False,
        enable_normalization=False)
    config = GenerationConfig(batch_size=1, use_random_seed=False, seeds=[int(p['semilla'])], audio_format='wav')
    # El LM, con una sola pista, no siembra su azar: lo sembramos aquí para que la misma semilla dé la misma pista
    random.seed(p['semilla'])
    np.random.seed(p['semilla'])
    torch.manual_seed(p['semilla'])
    r = generate_music(dit, lm, params, config, save_dir=None)
    if not r.success:
        raise RuntimeError(r.error or r.status_message)
    a = r.audios[0]
    return a['tensor'].float().numpy().T, int(a['sample_rate']), (r.extra_outputs or {}).get('lm_metadata')


def recortes(x):
    """Tramos de 3 o más muestras idénticas pegadas al pico: en la salida flotante del modelo solo salen si recortó."""
    m = np.abs(x).max(axis=1)
    tope = m >= 0.999 * m.max()
    igual = np.concatenate(([False], np.all(np.diff(x, axis=0) == 0, axis=1)))
    b = np.diff(np.concatenate(([0], (tope & igual).astype(np.int8), [0])))
    return int(np.sum(np.flatnonzero(b == -1) - np.flatnonzero(b == 1) >= 2))


def pico_real(x):
    """Pico real (sobremuestreo ×4, como los medidores dBTP)."""
    from scipy.signal import resample_poly
    return float(np.abs(resample_poly(x, 4, 1, axis=0)).max())


def limitar(x, techo):
    """Limitador con anticipación: baja la ganancia solo alrededor de los picos que pasan el techo."""
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    from scipy.signal import resample_poly
    env = np.abs(resample_poly(x, 4, 1, axis=0)).max(axis=1).reshape(-1, 4).max(axis=1)
    g = np.minimum(1.0, techo / np.maximum(env, 1e-9))
    if g.min() >= 1.0:
        return x
    # Mínimo y promedio con la misma ventana (±5 ms): la ganancia ya bajó al llegar al pico y no hay saltos
    v = 2 * int(0.005 * SR) + 1
    return x * uniform_filter1d(minimum_filter1d(g, v), v)[:, None]


def recortar(x, rango):
    """Quita el silencio de las puntas (40 dB bajo lo fuerte de la pista) dejando 0,3 s de cola, y corta en el
    máximo del rango si sobra. Devuelve el audio, los segundos quitados al inicio y si se cortó a la fuerza."""
    v, h = int(0.05 * SR), int(0.01 * SR)
    mono = x.mean(axis=1)
    n = 1 + max(0, (len(mono) - v) // h)
    db = 10 * np.log10(np.array([np.mean(mono[i * h:i * h + v] ** 2) for i in range(n)]) + 1e-12)
    vivo = np.flatnonzero(db > np.percentile(db, 95) - 40)
    ini = max(0, vivo[0] * h - int(0.02 * SR))
    x = x[ini:min(len(x), vivo[-1] * h + v + int(0.3 * SR))]
    cortado = bool(rango) and len(x) > rango[1] * SR
    if cortado:
        x = x[:int(rango[1] * SR)]
    return x, ini / SR, cortado


def terminar(x, sr, p, rango):
    """Estéreo a 48 kHz, sin silencios en las puntas, fundidos, −16 LUFS y pico real ≤ −1 dBTP."""
    import pyloudnorm as pyln
    from scipy.signal import resample_poly
    x = x.astype(np.float64)
    if sr != SR:
        x = resample_poly(x, SR, sr, axis=0)
    if x.shape[1] == 1:
        x = np.repeat(x, 2, axis=1)
    x = x[:, :2] - x[:, :2].mean(axis=0)
    x, quitado, cortado = recortar(x, rango)
    # Fundidos de coseno: 5 ms al entrar; al salir, la cola de 0,3 s o, si se cortó, «fundido» (1 s por defecto)
    n = len(x)
    rampa = np.ones(n)
    b = int(0.005 * SR)
    rampa[:b] = np.linspace(0, 1, b)
    f = int(max(0.3, float(p.get('fundido', 1.0 if cortado else 0))) * SR)
    rampa[-f:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, f))
    x = x * rampa[:, None]
    medidor = pyln.Meter(SR)
    techo = 10 ** ((TECHO_DB - 0.2) / 20)
    for _ in range(5):  # ganancia → limitador → volver a medir (el limitador baja un poco la sonoridad)
        x = limitar(x * 10 ** ((LUFS - medidor.integrated_loudness(x)) / 20), techo)
        if abs(medidor.integrated_loudness(x) - LUFS) < 0.1:
            break
    return x, medidor.integrated_loudness(x), quitado, cortado


def main():
    ap = argparse.ArgumentParser(description='Música instrumental con ACE-Step 1.5 (ver encabezado).')
    ap.add_argument('pedidos', nargs='?', default=str(Path(__file__).with_name('pedidos.json')))
    ap.add_argument('--solo', help='ids separados por coma')
    ap.add_argument('--forzar', action='store_true', help='vuelve a generar aunque ya esté lo crudo')
    a = ap.parse_args()
    datos = json.loads(Path(a.pedidos).read_text(encoding='utf-8'))
    pedidos = datos['pedidos'] if isinstance(datos, dict) else datos
    grupos = datos.get('grupos', {}) if isinstance(datos, dict) else {}
    if a.solo:
        ids = set(a.solo.split(','))
        pedidos = [p for p in pedidos if p['id'] in ids]
    SALIDA.mkdir(parents=True, exist_ok=True)
    CRUDOS.mkdir(parents=True, exist_ok=True)
    commit = subprocess.run(['git', '-C', str(ACE), 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip()

    def crudo(p):
        clave = {k: p.get(k) for k in DEL_MODELO} | {'modelo': p.get('modelo', MODELO), 'ace_step': commit}
        h = hashlib.sha1(json.dumps(clave, sort_keys=True).encode()).hexdigest()[:12]
        return CRUDOS / f"{p['id']}-{h}"
    pendientes = [p for p in pedidos if a.forzar or not crudo(p).with_suffix('.npy').exists()]

    # Fase GPU: genera lo que falta, guarda lo crudo y suelta modelos y candado
    if pendientes:
        CANDADO.parent.mkdir(parents=True, exist_ok=True)
        with open(CANDADO, 'a') as candado:
            fcntl.flock(candado, fcntl.LOCK_EX)  # mismo candado que «flock gpu.lock …»
            import torch
            cargado, dit, lm = None, None, None
            for p in sorted(pendientes, key=lambda p: p.get('modelo', MODELO)):
                modelo = p.get('modelo', MODELO)
                if modelo != cargado:
                    dit = lm = None
                    torch.cuda.empty_cache()
                    dit, lm = cargar(modelo)
                    cargado = modelo
                t0 = time.time()
                x, sr, meta = generar(dit, lm, p, modelo)
                seg = time.time() - t0
                np.save(crudo(p).with_suffix('.npy'), x.astype(np.float32))
                crudo(p).with_suffix('.json').write_text(json.dumps({
                    'sr': sr, 'modelo': modelo, 'lm': LM, 'ace_step': commit, 'segundos_gpu': round(seg, 1),
                    'vram_max_gb': round(torch.cuda.max_memory_allocated() / 2**30, 2), 'lm_metadata': meta},
                    ensure_ascii=False, default=str), encoding='utf-8')
                print(f"{p['id']}: generado en {seg:.1f} s", flush=True)
            del dit, lm
            torch.cuda.empty_cache()

    import soundfile as sf
    for p in pedidos:
        x = np.load(crudo(p).with_suffix('.npy')).astype(np.float64)
        info = json.loads(crudo(p).with_suffix('.json').read_text(encoding='utf-8'))
        rango = grupos.get(p['grupo'], {}).get('rango')
        pico_crudo, cortes = float(np.abs(x).max()), recortes(x)
        y, lufs, quitado, cortado = terminar(x, info.pop('sr'), p, rango)
        sf.write(SALIDA / f"{p['id']}.wav", y, SR, subtype='PCM_16')
        info |= {'pedido': p, 'rango': rango, 'crudo': {'pico_dbfs': round(20 * np.log10(pico_crudo), 2),
                                                         'recortes': cortes, 'archivo': crudo(p).name},
                 'silencio_quitado_al_inicio_s': round(quitado, 2), 'cortado_al_maximo': cortado,
                 'lufs': round(lufs, 2), 'pico_real_db': round(20 * np.log10(pico_real(y)), 2),
                 'duracion': round(len(y) / SR, 3)}
        (SALIDA / f"{p['id']}.json").write_text(json.dumps(info, ensure_ascii=False, indent=1, default=str),
                                                encoding='utf-8')
        print(f"{p['id']}: {info['duracion']} s{' (cortada)' if cortado else ''}, {info['lufs']} LUFS, "
              f"pico {info['pico_real_db']} dBTP, recortes {cortes}")


if __name__ == '__main__':
    main()
