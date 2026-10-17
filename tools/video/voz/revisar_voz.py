#!/usr/bin/env python3
"""Revisa voces con faster-whisper (GPU): WER contra el texto, idioma, ritmo y recortes.

Corre en el venv voz-whisper. Toma el candado de la GPU él solo (no lo envuelvas en flock).
Uso:
  revisar_voz.py linea.wav --texto "No está viejo, está experimentado."
  revisar_voz.py --lote resultado.json        salida de voz.py ({"lineas": [{ruta, texto}, …]}) o lista igual
  revisar_voz.py video.mp4 --guion guion.json  audio mezclado o video terminado contra el guion completo
                                               (guion = lote de voz.py, lista de textos o .txt con una línea por renglón)
Imprime un JSON por archivo y termina con código 1 si alguno falla:
WER > 0,15, idioma distinto de «es», ritmo fuera de 1,8–4,5 palabras por segundo (en líneas de 4 palabras o más)
o recortes.
"""
import argparse
import fcntl
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.dont_write_bytecode = True  # sin __pycache__ dentro del repo
sys.path.insert(0, str(AQUI))
import texto_es  # noqa: E402

ESTUDIO = Path.home() / '.local/share/cocardo-estudio'
CANDADO = ESTUDIO / 'gpu.lock'
# Whisper large-v3 turbo en CTranslate2 (MIT). El alias «turbo» de faster-whisper apunta a este repositorio
MODELO, REVISION = 'dropbox-dash/faster-whisper-large-v3-turbo', '0a363e9161cbc7ed1431c9597a8ceaf0c4f78fcf'
WER_MAX, RITMO_MIN, RITMO_MAX = 0.15, 1.8, 4.5
# Con menos palabras el ritmo no mide el paso de la voz sino cuánto se alarga una palabra («Luces.», «Una menos.»):
# se informa, pero no cuenta como fallo
RITMO_MIN_PALABRAS = 4


def preparar_cuda():
    """CTranslate2 busca cuBLAS y cuDNN en LD_LIBRARY_PATH: si faltan, apunta a los del venv y se relanza."""
    if os.environ.get('_VOZ_CUDA_LISTO'):
        return
    import nvidia.cublas.lib
    import nvidia.cudnn.lib
    libs = [list(nvidia.cublas.lib.__path__)[0], list(nvidia.cudnn.lib.__path__)[0]]
    env = dict(os.environ, _VOZ_CUDA_LISTO='1', HF_HOME=os.environ.get('HF_HOME', str(ESTUDIO / 'hf')),
               LD_LIBRARY_PATH=':'.join(libs + [os.environ.get('LD_LIBRARY_PATH', '')]).rstrip(':'))
    os.execve(sys.executable, [sys.executable] + sys.argv, env)


def leer_audio(ruta):
    """Cualquier audio o video → float32 mono 16 kHz para whisper, más el pico y los recortes del original."""
    import numpy as np
    crudo = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(ruta), '-vn', '-ac', '1', '-f', 'f32le', '-'],
                           capture_output=True, check=True).stdout
    x = np.frombuffer(crudo, dtype=np.float32)
    sr_orig = int(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries',
                                  'stream=sample_rate', '-of', 'csv=p=0', str(ruta)],
                                 capture_output=True, text=True).stdout.strip() or 48000)
    pico = float(np.max(np.abs(x))) if x.size else 0.0
    # Recorte = 3 o más muestras seguidas pegadas al techo (|x| ≥ 0,999)
    alto = np.abs(x) >= 0.999
    recortes = 0
    if alto.any():
        bordes = np.diff(np.concatenate(([0], alto.astype(np.int8), [0])))
        largos = np.flatnonzero(bordes == -1) - np.flatnonzero(bordes == 1)
        recortes = int(np.sum(largos >= 3))
    a16 = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(ruta), '-vn', '-ac', '1', '-ar', '16000',
                          '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(a16, dtype=np.float32), len(x) / sr_orig, pico, recortes


def revisar(modelo, ruta, texto, mezcla=False):
    import numpy as np
    audio, dur, pico, recortes = leer_audio(ruta)
    t0 = time.time()
    segs, info = modelo.transcribe(audio, language=None, beam_size=5, word_timestamps=True,
                                   condition_on_previous_text=False, vad_filter=mezcla)
    segs = list(segs)
    gpu_s = time.time() - t0
    hip = ' '.join(s.text.strip() for s in segs)
    ref_n, hip_n = texto_es.normalizar(texto or ''), texto_es.normalizar(hip)
    # Tiempo de habla: en una línea, de la primera a la última palabra. En un video, lo que el VAD de whisper (Silero)
    # marca como voz, con cortes de más de 0,3 s: no cuentan las pausas ni la música entre líneas (las marcas de
    # tiempo de las palabras no sirven aquí: whisper estira cada palabra hasta la siguiente por encima del silencio)
    con_palabras = [s for s in segs if s.words]
    if mezcla:
        from faster_whisper.vad import VadOptions, get_speech_timestamps
        tramos = get_speech_timestamps(audio, VadOptions(min_silence_duration_ms=300, speech_pad_ms=30))
        habla = sum(t['end'] - t['start'] for t in tramos) / 16000
    # Palabras para el ritmo: las del texto, sin contar las risas…
    limpias = texto_es.limpiar(texto or hip)
    marcas = texto_es.risas(limpias)
    palabras = sum(1 for m in marcas if not m)
    silabas_risa = sum(len(re.findall(r'[jh][aeiou]', p)) for p, m in zip(limpias, marcas) if m)
    if not mezcla:
        pal = [w for s in con_palabras for w in s.words]
        risa = texto_es.risas([''.join(texto_es.limpiar(w.word)) for w in pal])
        dichas = [w for w, r in zip(pal, risa) if not r]
        if not pal:
            habla = dur
        elif any(risa) and dichas:
            # …ni su tiempo, si whisper la oyó como risa
            ini, fin = dichas[0].start, dichas[-1].end
            habla = fin - ini - sum(w.end - w.start for w, r in zip(pal, risa) if r and ini <= w.start and w.end <= fin)
        else:
            # Si la escribió como palabras («Sí, sí, sí»), su tiempo cuenta y cada sílaba de risa vale una palabra
            habla = pal[-1].end - pal[0].start
            palabras += silabas_risa
    ritmo = palabras / habla if habla > 0 else 0.0
    r = {'ruta': str(ruta), 'texto': texto, 'transcripcion': hip, 'wer': round(texto_es.wer(ref_n, hip_n), 3),
         'idioma': info.language, 'prob_idioma': round(info.language_probability, 3), 'duracion': round(dur, 3),
         'habla_s': round(habla, 3), 'palabras': palabras, 'palabras_por_s': round(ritmo, 2),
         'pico_dbfs': round(float(20 * np.log10(pico)), 2) if pico > 0 else None, 'recortes': recortes,
         'whisper_s': round(gpu_s, 2)}
    fallos = []
    if texto and r['wer'] > WER_MAX:
        fallos.append(f"WER {r['wer']} > {WER_MAX}")
    if info.language != 'es':
        fallos.append(f'idioma {info.language}')
    r['ritmo_cuenta'] = mezcla or palabras >= RITMO_MIN_PALABRAS
    if r['ritmo_cuenta'] and not (RITMO_MIN <= ritmo <= RITMO_MAX):
        fallos.append(f'ritmo {ritmo:.2f} palabras/s')
    if recortes:
        fallos.append(f'{recortes} recorte(s)')
    r['fallos'], r['ok'] = fallos, not fallos
    return r


def leer_guion(ruta):
    p = Path(ruta)
    if p.suffix == '.json':
        d = json.loads(p.read_text(encoding='utf-8'))
        d = d.get('lineas', d) if isinstance(d, dict) else d
        return ' '.join(x if isinstance(x, str) else x['texto'] for x in d)
    return ' '.join(l.strip() for l in p.read_text(encoding='utf-8').splitlines() if l.strip())


def main():
    ap = argparse.ArgumentParser(description='Revisión objetiva de voces (ver encabezado).')
    ap.add_argument('audio', nargs='*')
    ap.add_argument('--texto')
    ap.add_argument('--guion', help='guion completo de un audio mezclado o video terminado')
    ap.add_argument('--lote', help='JSON de voz.py con ruta y texto de cada línea')
    ap.add_argument('--modelo', default=MODELO, help='repo de HF o carpeta local de un modelo de faster-whisper')
    ap.add_argument('--descargar', action='store_true', help='solo baja el modelo (sin GPU)')
    a = ap.parse_args()
    if a.descargar:
        from huggingface_hub import snapshot_download
        os.environ.setdefault('HF_HOME', str(ESTUDIO / 'hf'))
        print(snapshot_download(a.modelo, revision=REVISION if a.modelo == MODELO else None))
        return
    preparar_cuda()
    trabajos = []
    if a.lote:
        d = json.loads(Path(a.lote).read_text(encoding='utf-8'))
        for x in (d.get('lineas', d) if isinstance(d, dict) else d):
            trabajos.append((x['ruta'], x['texto'], False))
    for ruta in a.audio:
        if a.guion:
            trabajos.append((ruta, leer_guion(a.guion), True))
        else:
            trabajos.append((ruta, a.texto, False))
    if not trabajos:
        ap.error('falta un audio o --lote')

    from faster_whisper import WhisperModel
    CANDADO.parent.mkdir(parents=True, exist_ok=True)
    with open(CANDADO, 'a') as candado:
        fcntl.flock(candado, fcntl.LOCK_EX)  # mismo candado que «flock gpu.lock …»
        modelo = WhisperModel(a.modelo, device='cuda', compute_type='float16', local_files_only=True,
                              revision=REVISION if a.modelo == MODELO else None)
        res = [revisar(modelo, *t) for t in trabajos]
        del modelo
    malos = [r for r in res if not r['ok']]
    print(json.dumps({'revisados': len(res), 'fallan': len(malos), 'resultados': res}, ensure_ascii=False, indent=1))
    sys.exit(1 if malos else 0)


if __name__ == '__main__':
    main()
