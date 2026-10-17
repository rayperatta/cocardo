#!/usr/bin/env python3
"""Revisa las pistas de generar.py y arma la página para elegir.

Corre en el venv de música (mejor con el lanzador musica.sh). Usa la GPU para separar la voz y para whisper, y toma
el candado él solo (no lo envuelvas en flock).
Uso:
  tools/video/musica/musica.sh revisar [pedidos.json] [--solo tema-1,calma-2]
Por pista mide duración, LUFS, pico real, recortes, silencios, bpm (librosa), voz y el punto de bucle más limpio.
Voz: whisper sobre la mezcla alucina («Thank you.», «Legenda por…»), así que primero htdemucs separa la pista de voz;
tiene voz si esa pista suena fuerte frente a la mezcla o si whisper saca de ella palabras con confianza.
Escribe en dist/estudio/musica/: musica.json, bucles/<id>-tramo.wav (una vuelta del bucle, lista para repetir),
bucles/<id>-bucle.wav (tres vueltas seguidas, para oír la costura) y bucles/<id>-larga.wav (la pista con vueltas
del bucle hasta pasar 75 s, para audio.musicaArchivo; no en la victoria). Al final llama a elegir.py, que deja
elegidas.json (la mejor de cada grupo, o la elegida a mano) e index.html.
Termina con código 1 si alguna pista falla.
"""
import argparse
import fcntl
import json
import os
import sys
import time
from pathlib import Path

import numpy as np

sys.dont_write_bytecode = True  # sin __pycache__ en tools/ (importa elegir.py)
AQUI = Path(__file__).resolve().parent
REPO = AQUI.parents[2]
ESTUDIO = Path.home() / '.local/share/cocardo-estudio'
CANDADO = ESTUDIO / 'gpu.lock'
SALIDA = REPO / 'dist/estudio/musica'
# El mismo whisper que tools/video/voz/revisar_voz.py (large-v3 turbo en CTranslate2, MIT)
WHISPER, REVISION = 'dropbox-dash/faster-whisper-large-v3-turbo', '0a363e9161cbc7ed1431c9597a8ceaf0c4f78fcf'
PROB_PALABRA, MIN_PALABRAS = 0.5, 3     # 3 o más palabras con prob ≥ 0,5 en la pista de voz = tiene voz
# Energía de la pista de voz frente a la mezcla. Calibrado con controles hechos con el mismo modelo: cumbia cantada
# −11,7 dB, cumbia con gritos −17,4 dB; instrumentales limpias entre −60 y −28 dB
VOZ_DB, VOZ_DUDA_DB = -20.0, -30.0      # ≥ −20 dB = tiene voz; de −30 a −20 = escúchala (coro, eco o fuga)
SILENCIO_DB, SILENCIO_MAX = -50.0, 1.0  # dBFS en ventanas de 50 ms; más de 1 s seguido = hueco
# Largo mínimo del bucle (fracción de la pista) y de cuántos en cuántos compases crece (4 = frases enteras, para
# que la armonía de los dos lados del corte coincida)
BUCLE = {'tema': (0.3, 4), 'drama': (0.3, 4), 'calma': (0.3, 4), 'victoria': (0.3, 1)}
FUNDIDO_CRUZADO = 0.04  # s de fundido en la costura del bucle
COSTURA_DUDOSA = 0.6    # «distancia» log-mel de los dos lados del corte desde la que conviene escucharlo
# Versión larga (inicio de la pista + vueltas del bucle) para usar tal cual en audio.musicaArchivo: los videos duran
# hasta 60 s. La victoria es un remate corto: no se alarga.
LARGA_MIN, SIN_LARGA = 75.0, ('victoria',)


def preparar_cuda():
    """CTranslate2 busca cuBLAS y cuDNN en LD_LIBRARY_PATH: si faltan, apunta a los del venv y se relanza."""
    if os.environ.get('_MUSICA_CUDA_LISTO'):
        return
    import nvidia.cublas.lib
    import nvidia.cudnn.lib
    libs = [list(nvidia.cublas.lib.__path__)[0], list(nvidia.cudnn.lib.__path__)[0]]  # paquetes sin __init__
    env = dict(os.environ, _MUSICA_CUDA_LISTO='1', PYTHONDONTWRITEBYTECODE='1',
               HF_HOME=os.environ.get('HF_HOME', str(ESTUDIO / 'hf')),
               LD_LIBRARY_PATH=':'.join(libs + [os.environ.get('LD_LIBRARY_PATH', '')]).rstrip(':'))
    os.execve(sys.executable, [sys.executable] + sys.argv, env)


def separar_voz(demucs, x, sr):
    """htdemucs separa la pista de voz: la devuelve en mono a 16 kHz junto con su energía frente a la mezcla (dB)."""
    import librosa
    import torch
    from demucs.apply import apply_model
    x44 = librosa.resample(x.T, orig_sr=sr, target_sr=demucs.samplerate)
    with torch.no_grad():  # shifts=0: sin desplazamiento al azar, mismo resultado cada vez
        est = apply_model(demucs, torch.tensor(x44, dtype=torch.float32)[None].cuda(), shifts=0, split=True,
                          overlap=0.25)[0]
    v = est[demucs.sources.index('vocals')].mean(0).cpu().numpy()
    db = 10 * np.log10(np.sum(v ** 2) / (np.sum(x44.mean(0) ** 2) + 1e-12) + 1e-12)
    return librosa.resample(v, orig_sr=demucs.samplerate, target_sr=16000).astype(np.float32), float(db)


def voz(whisper, voz16, db):
    """Whisper sobre la pista de voz separada (con VAD, que ahí sí funciona) más la energía de esa pista."""
    segs, info = whisper.transcribe(voz16, language=None, beam_size=5, word_timestamps=True,
                                    condition_on_previous_text=False, vad_filter=True)
    segs = list(segs)
    seguras = [w for s in segs for w in (s.words or []) if w.probability >= PROB_PALABRA]
    tiene = db >= VOZ_DB or len(seguras) >= MIN_PALABRAS
    return {'voz_db': round(db, 1), 'texto': ' '.join(s.text.strip() for s in segs).strip(),
            'idioma': info.language, 'palabras_seguras': len(seguras),
            'muestra': ' '.join(w.word.strip() for w in seguras[:12]),
            'tiene_voz': tiene, 'dudosa': not tiene and db >= VOZ_DUDA_DB}


def silencios(mono, sr, fin):
    """El hueco más largo bajo SILENCIO_DB (sin contar el fundido final) y cuánto tarda en sonar."""
    v, h = int(0.05 * sr), int(0.025 * sr)
    n = 1 + max(0, (len(mono) - v) // h)
    rms = np.array([np.sqrt(np.mean(mono[i * h:i * h + v] ** 2) + 1e-12) for i in range(n)])
    db = 20 * np.log10(rms)
    t = np.arange(n) * h / sr
    callado = (db < SILENCIO_DB) & (t < fin)
    mayor, ini, largo = 0.0, None, 0
    for i, c in enumerate(callado):
        largo = largo + 1 if c else 0
        if largo * h / sr > mayor:
            mayor, ini = largo * h / sr, t[i - largo + 1]
    arranque = float(t[np.argmax(db > -40)]) if (db > -40).any() else None
    return round(mayor, 2), (round(float(ini), 2) if ini is not None else None), arranque


def rejillas(mono, sr, bpm, hop=256):
    """Dos rejillas de pulsos: la que sigue librosa y una exacta al bpm pedido (en la música sin golpes claros el
    seguidor se pierde; el modelo recibió ese bpm, así que la exacta suele calzar)."""
    import librosa
    _, seguida = librosa.beat.beat_track(y=mono, sr=sr, start_bpm=bpm, units='time', tightness=200)
    env = librosa.onset.onset_strength(y=mono, sr=sr, hop_length=hop)
    periodo = 60.0 / bpm
    fases = np.linspace(0, periodo, 48, endpoint=False)
    k = np.arange(int(len(mono) / sr / periodo) + 1) * periodo
    fuerza = [env[np.minimum((np.round((f + k) * sr / hop)).astype(int), len(env) - 1)].sum() for f in fases]
    fija = fases[int(np.argmax(fuerza))] + k
    return {'seguida': np.asarray(seguida), 'fija': fija[fija < len(mono) / sr]}


def bucle(mono, sr, grillas, grupo, fin):
    """Busca inicio y fin sobre pulsos, a N compases, donde la música alrededor de los dos puntos (un pulso antes y
    uno después) suene más parecida: log-mel normalizado, 0 = idéntico, ≈ 1,1 = sin relación."""
    import librosa
    largo_min, paso = BUCLE.get(grupo, (0.45, 2))
    hop = 256
    mel = librosa.power_to_db(librosa.feature.melspectrogram(y=mono, sr=sr, n_fft=2048, hop_length=hop, n_mels=64))
    mel = (mel - mel.mean(axis=1, keepdims=True)) / (mel.std(axis=1, keepdims=True) + 1e-6)
    cuadro = lambda t: int(round(t * sr / hop))  # noqa: E731
    mejor = None
    for nombre, beats in grillas.items():
        if len(beats) < 8:
            continue
        pulso = float(np.median(np.diff(beats)))
        w = max(4, cuadro(pulso))
        for i, s in enumerate(beats):
            if s < 0.3 or cuadro(s) - w < 0:
                continue
            for j in range(i + 4 * paso, len(beats), 4 * paso):
                e = beats[j]
                if e > fin - pulso or cuadro(e) + w > mel.shape[1]:
                    break
                if e - s < largo_min * (len(mono) / sr):
                    continue
                d = float(np.mean(np.abs(mel[:, cuadro(s) - w:cuadro(s) + w] - mel[:, cuadro(e) - w:cuadro(e) + w])))
                puntaje = d - 0.02 * (j - i) / (4 * paso)  # a igual parecido, gana el bucle más largo
                if mejor is None or puntaje < mejor[0]:
                    mejor = (puntaje, d, s, e, (j - i) / 4, nombre)
    if mejor is None:
        return None
    _, d, s, e, compases, nombre = mejor
    return {'inicio': round(s, 4), 'fin': round(e, 4), 'largo': round(e - s, 3), 'compases': compases,
            'distancia': round(d, 3), 'rejilla': nombre, 'fundido_cruzado': FUNDIDO_CRUZADO}


def tramo_de_bucle(x, sr, b):
    """El tramo listo para repetir: sus últimos 40 ms se funden (potencia constante) con los 40 ms previos al inicio,
    así al volver al inicio no hay escalón."""
    si, ei, c = int(round(b['inicio'] * sr)), int(round(b['fin'] * sr)), int(FUNDIDO_CRUZADO * sr)
    t = x[si:ei].copy()
    a = np.linspace(0, np.pi / 2, c)[:, None]
    t[-c:] = x[ei - c:ei] * np.cos(a) + x[si - c:si] * np.sin(a)
    return t


def costura(t, sr, grilla, inicio):
    """Golpe en la costura frente al golpe típico en los pulsos del tramo (≈ 1 o menos = no salta)."""
    import librosa
    hop = 256
    tres = np.concatenate([t] * 3).mean(axis=1)
    env = librosa.onset.onset_strength(y=tres, sr=sr, hop_length=hop)
    pico = lambda seg: float(env[max(0, int(seg * sr / hop) - 2):int(seg * sr / hop) + 3].max())  # noqa: E731
    pulsos = [g - inicio for g in grilla if 0.2 < g - inicio < len(t) / sr - 0.2]
    tipico = float(np.median([pico(g) for g in pulsos])) + 1e-9
    return round(max(pico(len(t) / sr), pico(2 * len(t) / sr)) / tipico, 2)


def revisar(p, info, x, sr, whisper, demucs, grupo):
    import pyloudnorm as pyln
    from scipy.signal import resample_poly
    mono = x.mean(axis=1)
    dur = len(x) / sr
    fin = dur - max(0.3, float(p.get('fundido', 0))) - 0.1
    grillas = rejillas(mono, sr, float(p['bpm']))
    seguida = grillas['seguida']
    bpm = 60.0 / float(np.median(np.diff(seguida))) if len(seguida) > 2 else None
    r = {'id': p['id'], 'grupo': p['grupo'], 'archivo': f"{p['id']}.wav", 'descripcion': p.get('descripcion', ''),
         'estilo': p['estilo'], 'semilla': p['semilla'], 'tonalidad': p.get('tonalidad', ''),
         'bpm_pedido': p['bpm'], 'bpm_medido': round(bpm, 1) if bpm else None,
         'duracion': round(dur, 3), 'rango': grupo.get('rango'),
         'lufs': round(pyln.Meter(sr).integrated_loudness(x), 2),
         'pico_real_db': round(20 * np.log10(np.abs(resample_poly(x, 4, 1, axis=0)).max()), 2),
         'recortes': info.get('crudo', {}).get('recortes'), 'modelo': info.get('modelo'),
         'segundos_gpu': info.get('segundos_gpu')}
    r['silencio_max_s'], r['silencio_en'], r['arranque_s'] = silencios(mono, sr, fin)
    r['voz'] = voz(whisper, *separar_voz(demucs, x, sr))
    r['bucle'] = b = bucle(mono, sr, grillas, p['grupo'], fin)
    if b:
        b['golpe_costura'] = costura(tramo_de_bucle(x, sr, b), sr, grillas[b['rejilla']], b['inicio'])
    fallos, avisos, v = [], [], r['voz']
    if v['tiene_voz']:
        fallos.append(f"voz: pista de voz a {v['voz_db']} dB, {v['palabras_seguras']} palabras ({v['muestra']})")
    elif v['dudosa']:
        avisos.append(f"pista de voz a {v['voz_db']} dB: escucha si hay coro o eco de voz")
    if r['recortes']:
        fallos.append(f"{r['recortes']} recortes")
    if r['silencio_max_s'] > SILENCIO_MAX:
        fallos.append(f"silencio de {r['silencio_max_s']} s en {r['silencio_en']} s")
    lo, hi = grupo.get('rango', (p['duracion'] - 0.5, p['duracion'] + 0.5))
    if not lo - 0.05 <= dur <= hi + 0.05:
        fallos.append(f'dura {dur:.1f} s (va de {lo} a {hi})')
    if r['pico_real_db'] > -1.0 or abs(r['lufs'] + 16) > 0.5:
        fallos.append(f"nivel {r['lufs']} LUFS, pico {r['pico_real_db']} dBTP")
    # bpm: si el grupo fija un rango (el tema) es obligatorio; si no, se avisa (vale el doble o la mitad)
    if 'bpm' in grupo and not (bpm and grupo['bpm'][0] <= bpm <= grupo['bpm'][1]):
        fallos.append(f"bpm {bpm and round(bpm, 1)} fuera de {grupo['bpm'][0]}–{grupo['bpm'][1]}")
    elif bpm and min(abs(bpm * k / p['bpm'] - 1) for k in (0.5, 1, 2)) > 0.04:
        avisos.append(f"librosa oye {bpm:.0f} bpm (se pidieron {p['bpm']}): sin pulso marcado")
    if not b:
        (avisos if p['grupo'] == 'victoria' else fallos).append('sin punto de bucle')
    elif b['distancia'] > COSTURA_DUDOSA or b['golpe_costura'] > 2:
        avisos.append(f"costura del bucle dudosa (parecido {b['distancia']}, golpe {b['golpe_costura']}): escúchala")
    r['fallos'], r['avisos'], r['ok'] = fallos, avisos, not fallos
    return r


def escribir_bucle(r, x, sr):
    """bucles/<id>-tramo.wav (una vuelta, lista para repetir), <id>-bucle.wav (tres vueltas, para oír la costura) y
    <id>-larga.wav (la pista hasta «inicio» y vueltas hasta pasar LARGA_MIN s: suena igual que el bucle ×3)."""
    import soundfile as sf
    if not r['bucle']:
        return
    (SALIDA / 'bucles').mkdir(exist_ok=True)
    t = tramo_de_bucle(x, sr, r['bucle'])
    sf.write(SALIDA / 'bucles' / f"{r['id']}-tramo.wav", t, sr, subtype='PCM_16')
    sf.write(SALIDA / 'bucles' / f"{r['id']}-bucle.wav", np.concatenate([t] * 3), sr, subtype='PCM_16')
    r['bucle'] |= {'tramo': f"bucles/{r['id']}-tramo.wav", 'archivo': f"bucles/{r['id']}-bucle.wav"}
    if r['grupo'] not in SIN_LARGA:
        si = int(round(r['bucle']['inicio'] * sr))
        vueltas = int(np.ceil((LARGA_MIN * sr - si) / len(t)))
        sf.write(SALIDA / 'bucles' / f"{r['id']}-larga.wav", np.concatenate([x[:si]] + [t] * vueltas), sr,
                 subtype='PCM_16')
        r['bucle'] |= {'larga': f"bucles/{r['id']}-larga.wav", 'larga_s': round((si + vueltas * len(t)) / sr, 3)}


def main():
    ap = argparse.ArgumentParser(description='Revisión objetiva de la música (ver encabezado).')
    ap.add_argument('pedidos', nargs='?', default=str(AQUI / 'pedidos.json'))
    ap.add_argument('--solo', help='ids separados por coma (las demás se toman del musica.json anterior)')
    a = ap.parse_args()
    preparar_cuda()
    import soundfile as sf
    datos = json.loads(Path(a.pedidos).read_text(encoding='utf-8'))
    pedidos = datos['pedidos'] if isinstance(datos, dict) else datos
    grupos = datos.get('grupos', {}) if isinstance(datos, dict) else {}
    previo = {}
    if (SALIDA / 'musica.json').exists():
        previo = {r['id']: r for r in json.loads((SALIDA / 'musica.json').read_text(encoding='utf-8'))['pistas']}
    solo = set(a.solo.split(',')) if a.solo else None
    trabajos = []
    for p in pedidos:
        wav = SALIDA / f"{p['id']}.wav"
        if solo and p['id'] not in solo and p['id'] in previo:
            continue
        if not wav.exists():
            print(f"{p['id']}: falta {wav.name} (corre generar.py)", file=sys.stderr)
            continue
        x, sr = sf.read(wav, always_2d=True)
        info = json.loads((SALIDA / f"{p['id']}.json").read_text(encoding='utf-8'))
        trabajos.append((p, info, x, sr))

    os.environ.setdefault('TORCH_HOME', str(ESTUDIO / 'musica/torch-hub'))  # pesos de htdemucs
    from demucs.pretrained import get_model
    from faster_whisper import WhisperModel
    nuevos = {}
    CANDADO.parent.mkdir(parents=True, exist_ok=True)
    with open(CANDADO, 'a') as candado:
        fcntl.flock(candado, fcntl.LOCK_EX)  # mismo candado que «flock gpu.lock …»
        whisper = WhisperModel(WHISPER, device='cuda', compute_type='float16', revision=REVISION)
        demucs = get_model('htdemucs').cuda().eval()
        for p, info, x, sr in trabajos:
            t0 = time.time()
            nuevos[p['id']] = r = revisar(p, info, x, sr, whisper, demucs, grupos.get(p['grupo'], {}))
            escribir_bucle(r, x, sr)
            estado = 'ok' if r['ok'] else 'FALLA ' + '; '.join(r['fallos'])
            print(f"{p['id']}: {estado}{' (ojo: ' + '; '.join(r['avisos']) + ')' if r['avisos'] else ''} "
                  f"({time.time() - t0:.1f} s)", flush=True)
        del whisper, demucs

    pistas = [nuevos.get(p['id']) or previo.get(p['id']) for p in pedidos]
    pistas = [r for r in pistas if r]
    salida = {'nota': 'Medido por tools/video/musica/revisar.py. Bucle: suena desde 0 y al llegar a «fin» vuelve a '
                      '«inicio» (s), con un fundido cruzado de «fundido_cruzado» s (los últimos de antes de «fin» con '
                      'los de antes de «inicio»); bucles/<id>-tramo.wav ya lo trae hecho y se repite tal cual. '
                      '«distancia» 0 = idéntico, ≈ 1,1 = sin relación; «golpe_costura» ≈ 1 o menos = no salta. '
                      'Que no se note solo se confirma escuchando bucles/<id>-bucle.wav.',
              'normalizacion': {'lufs': -16, 'pico_real_db': -1, 'formato': 'WAV 48 kHz estéreo 16 bits'},
              'grupos': grupos, 'pistas': pistas}
    (SALIDA / 'musica.json').write_text(json.dumps(salida, ensure_ascii=False, indent=1), encoding='utf-8')
    malos = [r['id'] for r in pistas if not r['ok']]
    print(f"{len(pistas)} pistas, fallan {len(malos)}: {', '.join(malos) or '—'}")
    import elegir
    elegir.armar()
    sys.exit(1 if malos else 0)


if __name__ == '__main__':
    main()
