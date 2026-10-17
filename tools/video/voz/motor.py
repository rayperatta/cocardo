"""Trabajador de voz.py: corre dentro del venv de un motor, carga el modelo una vez y genera todas sus líneas.

  python motor.py trabajos.json resultado.json
trabajos.json = {"motor": "chatterbox"|"qwen"|"qwen-diseno", "modo": "generar"|"disenar"|"descargar",
                 "config": {...motor de voces.json}, "trabajos": [{"id", "texto", "p": {...}, "wav", "meta"?}]}
No lo llames a mano: voz.py lo lanza con el candado de la GPU y el HF_HOME del estudio.
"""
import json
import os
import random
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import numpy as np
import soundfile as sf

LUFS, TECHO_DB = -16.0, -1.0       # objetivo de las líneas finales
LUFS_REF = -18.0                    # las referencias quedan un poco más bajas (solo las escucha el modelo)


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def semilla(n):
    import torch
    random.seed(n)
    np.random.seed(n)
    torch.manual_seed(n)
    torch.cuda.manual_seed_all(n)


def recortar(x, sr, umbral_rel_db=-45.0, antes=0.01, despues=0.025):
    """Quita el silencio de las puntas: ventanas de 10 ms por debajo de (pico − 45 dB) o de −60 dBFS."""
    hop = max(1, int(sr * 0.01))
    n = len(x) // hop
    if n < 3:
        return x
    rms = np.sqrt(np.mean(x[:n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms)
    umbral = max(db.max() + umbral_rel_db, -60.0)
    voz = np.flatnonzero(db > umbral)
    if not len(voz):
        return x
    ini = max(0, voz[0] * hop - int(sr * antes))
    fin = min(len(x), (voz[-1] + 1) * hop + int(sr * despues))
    return x[ini:fin]


def sonoridad(x, sr):
    import pyloudnorm
    try:
        v = pyloudnorm.Meter(sr).integrated_loudness(x)
        if np.isfinite(v):
            return float(v)
    except ValueError:
        pass
    # Clip más corto que un bloque de 400 ms: aproximación por RMS
    return float(20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12) - 0.691)


def ffmpeg(entrada, salida, filtros):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(entrada), '-af', filtros, '-c:a', 'pcm_f32le',
                    str(salida)], check=True)


def posproceso(wav, sr, destino, velocidad=1.0, tono=0.0, sr_final=48000, lufs=LUFS, subtipo='PCM_16'):
    """Recorte → (velocidad y tono con rubberband) → 48 kHz → ganancia a −16 LUFS → limitador → pico ≤ −1 dBFS."""
    x = recortar(np.asarray(wav, dtype=np.float32).reshape(-1), sr)
    with tempfile.TemporaryDirectory(prefix='voz-post-') as tmp:
        a, b, c = (Path(tmp) / f'{n}.wav' for n in 'abc')
        sf.write(a, x, sr, subtype='FLOAT')
        cadena = []
        if abs(velocidad - 1.0) > 1e-3 or abs(tono) > 1e-3:
            cadena.append(f'rubberband=tempo={velocidad:.4f}:pitch={2 ** (tono / 12):.5f}:formant=preserved')
        cadena.append(f'aresample={sr_final}:resampler=soxr')
        ffmpeg(a, b, ','.join(cadena))
        y, _ = sf.read(b, dtype='float32')
        ganancia = lufs - sonoridad(y, sr_final)
        # Ganancia + limitador con anticipación a −1,5 dBFS. El limitador baja un poco la sonoridad en voces con
        # golpes fuertes, así que se corrige la ganancia hasta quedar a ±0,3 LU del objetivo (3 vueltas como mucho)
        for _ in range(3):
            ffmpeg(b, c, f'volume={ganancia:.2f}dB,alimiter=limit=0.8414:attack=1:release=60:level=disabled:latency=1')
            y, _ = sf.read(c, dtype='float32')
            falta = lufs - sonoridad(y, sr_final)
            if abs(falta) < 0.3:
                break
            ganancia += falta
    techo = 10 ** (TECHO_DB / 20)
    pico = float(np.max(np.abs(y))) if y.size else 0.0
    if pico > techo:
        y = y * (techo / pico)
    # Rampas cortas para que el corte no haga clic
    for n, lado in ((int(sr_final * 0.004), 'ini'), (int(sr_final * 0.012), 'fin')):
        n = min(n, len(y) // 4)
        if n > 0:
            r = np.linspace(0, 1, n, dtype=np.float32)
            if lado == 'ini':
                y[:n] *= r
            else:
                y[-n:] *= r[::-1]
    destino = Path(destino)
    destino.parent.mkdir(parents=True, exist_ok=True)
    sf.write(destino, y, sr_final, subtype=subtipo)
    pico = float(np.max(np.abs(y))) if y.size else 0.0
    return {'duracion': round(len(y) / sr_final, 3), 'lufs': round(sonoridad(y, sr_final), 2),
            'pico_dbfs': round(float(20 * np.log10(pico)), 2) if pico > 0 else None}


# ---------- motores ----------

def bajar(repo, revision, patrones=None):
    from huggingface_hub import snapshot_download
    return Path(snapshot_download(repo_id=repo, revision=revision, allow_patterns=patrones))


class Chatterbox:
    """Chatterbox Multilingual V3 con el ajuste fino de español latino (ResembleAI/…-es-mx-latam, MIT)."""

    def __init__(self, cfg, descargar=False):
        base = bajar(cfg['base'], cfg['base_revision'], ['ve.pt', 'conds.pt', 'grapheme_mtl_merged_expanded_v1.json'])
        latam = bajar(cfg['modelo'], cfg['revision'], [cfg['t3'], cfg['s3gen']])
        if descargar:
            return
        import torch
        from safetensors.torch import load_file
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
        from chatterbox.models.t3 import T3
        from chatterbox.models.t3.modules.t3_config import T3Config
        from chatterbox.models.s3gen import S3Gen
        from chatterbox.models.voice_encoder import VoiceEncoder
        from chatterbox.models.tokenizers import MTLTokenizer
        dev = 'cuda'
        ve = VoiceEncoder()
        ve.load_state_dict(torch.load(base / 've.pt', map_location='cpu', weights_only=True))
        t3_cfg = T3Config.multilingual()
        estado = load_file(latam / cfg['t3'])
        if 'model' in estado:
            estado = estado['model'][0]
        t3_cfg.text_tokens_dict_size = estado['text_emb.weight'].shape[0]
        t3 = T3(t3_cfg)
        t3.load_state_dict(estado)
        s3 = S3Gen()
        faltan, sobran = s3.load_state_dict(load_file(latam / cfg['s3gen']), strict=False)
        # Los búferes del tokenizador (filtros mel y ventana) se calculan al crear el modelo: no vienen en el archivo
        faltan = [k for k in faltan if k not in getattr(s3, 'ignore_state_dict_missing', ())]
        if faltan or sobran:
            log(f'[chatterbox] S3Gen v3: faltan {faltan[:5]}…, sobran {sobran[:5]}…')
        tok = MTLTokenizer(str(base / 'grapheme_mtl_merged_expanded_v1.json'))
        self.m = ChatterboxMultilingualTTS(t3.to(dev).eval(), s3.to(dev).eval(), ve.to(dev).eval(), tok, dev)
        self.sr = self.m.sr
        self.conds = {}

    def generar(self, texto, p):
        if p['ref_sha'] not in self.conds:
            self.m.prepare_conditionals(p['referencia'], exaggeration=p['exageracion'])
            self.conds[p['ref_sha']] = self.m.conds
        self.m.conds = self.conds[p['ref_sha']]
        semilla(p['semilla'])
        w = self.m.generate(texto, language_id='es', exaggeration=p['exageracion'], cfg_weight=p['cfg'],
                            temperature=p['temperatura'])
        return w.squeeze(0).cpu().numpy(), self.sr


class Qwen:
    """Qwen3-TTS 12 Hz 1.7B (Apache-2.0): Base clona desde la referencia; VoiceDesign crea la voz desde un texto."""

    def __init__(self, cfg, descargar=False):
        ruta = bajar(cfg['modelo'], cfg['revision'])
        if descargar:
            return
        import torch
        from qwen_tts import Qwen3TTSModel
        self.m = Qwen3TTSModel.from_pretrained(str(ruta), device_map='cuda:0', dtype=torch.bfloat16,
                                               attn_implementation='sdpa')
        self.prompts = {}

    def _extra(self, texto, p):
        # Tope de tokens (12 por segundo) para que una generación desbocada no siga 3 minutos
        return dict(temperature=p.get('temperatura', 0.9), max_new_tokens=int(48 + 14 * len(texto.split())))

    def generar(self, texto, p):
        semilla(p['semilla'])
        if 'referencia' in p:
            if p['ref_sha'] not in self.prompts:
                self.prompts[p['ref_sha']] = self.m.create_voice_clone_prompt(ref_audio=p['referencia'],
                                                                              ref_text=p['ref_texto'])
            wavs, sr = self.m.generate_voice_clone(text=texto, language='Spanish',
                                                   voice_clone_prompt=self.prompts[p['ref_sha']],
                                                   **self._extra(texto, p))
        else:
            wavs, sr = self.m.generate_voice_design(text=texto, language='Spanish', instruct=p['instruccion'],
                                                    **self._extra(texto, p))
        return np.asarray(wavs[0], dtype=np.float32), sr


def versiones():
    out = {'python': sys.version.split()[0]}
    for paquete in ('torch', 'torchaudio', 'transformers', 'chatterbox-tts', 'qwen-tts', 'resemble-perth'):
        try:
            from importlib.metadata import version
            out[paquete] = version(paquete)
        except Exception:
            pass
    try:
        import torch
        out['cuda'] = torch.version.cuda
        out['gpu'] = torch.cuda.get_device_name(0)
    except Exception:
        pass
    return out


def main():
    entrada, salida = Path(sys.argv[1]), Path(sys.argv[2])
    job = json.loads(entrada.read_text(encoding='utf-8'))
    motor, modo, cfg = job['motor'], job['modo'], job['config']
    clase = Chatterbox if motor == 'chatterbox' else Qwen
    t0 = time.time()
    if modo == 'descargar':
        clase(cfg, descargar=True)
        salida.write_text(json.dumps({'trabajos': [], 'descarga_s': round(time.time() - t0, 1)}), encoding='utf-8')
        return
    os.environ.setdefault('HF_HUB_OFFLINE', '1')  # con el candado puesto no se baja nada
    import torch
    m = clase(cfg)
    torch.cuda.synchronize()
    carga = time.time() - t0
    log(f'[{motor}] modelo cargado en {carga:.1f} s')
    res = []
    for t in job['trabajos']:
        r = {'id': t['id']}
        try:
            torch.cuda.synchronize()
            t1 = time.time()
            wav, sr = m.generar(t['texto'], t['p'])
            torch.cuda.synchronize()
            r['gpu_s'] = round(time.time() - t1, 2)
            if modo == 'disenar':
                med = posproceso(wav, sr, t['wav'], sr_final=24000, lufs=LUFS_REF)
            else:
                med = posproceso(wav, sr, t['wav'], velocidad=t['p'].get('velocidad', 1.0),
                                 tono=t['p'].get('tono', 0))
            med['gpu_s'] = r['gpu_s']
            med['x_tiempo_real'] = round(r['gpu_s'] / max(med['duracion'], 1e-3), 2)
            r.update(med, ok=True)
            if t.get('meta'):
                Path(t['meta']).write_text(json.dumps({'voz': t.get('voz'), 'texto': t['texto'], 'p': {
                    k: v for k, v in t['p'].items() if k != 'referencia'}, 'medidas': med,
                    'fecha': time.strftime('%Y-%m-%d %H:%M')}, ensure_ascii=False, indent=1), encoding='utf-8')
            log(f"[{motor}] {t.get('voz') or t['id']}: {med['duracion']} s de audio en {r['gpu_s']} s")
        except Exception as e:  # una línea mala no tumba el lote; voz.py decide
            r.update(ok=False, error=f'{type(e).__name__}: {e}')
            log(f"[{motor}] ERROR {t['id']}: {r['error']}")
        res.append(r)
    resumen = {'trabajos': res, 'carga_s': round(carga, 1), 'total_s': round(time.time() - t0, 1),
               'vram_pico_mb': round(torch.cuda.max_memory_allocated() / 2 ** 20),
               'vram_reservada_mb': round(torch.cuda.max_memory_reserved() / 2 ** 20), 'versiones': versiones()}
    salida.write_text(json.dumps(resumen, ensure_ascii=False), encoding='utf-8')


if __name__ == '__main__':
    main()
