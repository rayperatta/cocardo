#!/usr/bin/env python3
"""Golpes de una pista de música para que los cortes del montaje caigan a tiempo (plantilla F07: musica.desde y bpm).

Uso: python3 tools/video/formatos/F07/ritmo.py <tema|drama|calma|victoria|archivo.wav> [bpm] [--desde-min 4.4]
Con un tipo, lee dist/estudio/musica/elegidas.json (archivo, bpm medido e inicio del bucle). Busca el tempo (±3 %) y la fase de la rejilla
de golpes que más coincide con los ataques (flujo espectral) en el cuerpo de la pista y da `desde`: el primer golpe a
partir de --desde-min (por defecto, el inicio del bucle), para usarlo como musica.desde (el golpe cae en t = 0).
Solo usa numpy (python3 del sistema).
"""
import json
import sys
import wave
from pathlib import Path

import numpy as np

RAIZ = Path(__file__).resolve().parents[4]


def leer(ruta):
    w = wave.open(str(ruta))
    sr, n, ch, sw = w.getframerate(), w.getnframes(), w.getnchannels(), w.getsampwidth()
    raw = w.readframes(n)
    if sw == 3:
        a = np.frombuffer(raw, np.uint8).reshape(-1, 3).astype(np.int32)
        x = a[:, 0] | (a[:, 1] << 8) | (a[:, 2] << 16)
        x = np.where(x >= 1 << 23, x - (1 << 24), x).astype(np.float32) / (1 << 23)
    else:
        dt = {2: np.int16, 4: np.int32}[sw]
        x = np.frombuffer(raw, dt).astype(np.float32) / np.iinfo(dt).max
    return x.reshape(-1, ch).mean(1), sr


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args:
        print(__doc__)
        sys.exit(1)
    desde_min = None
    if '--desde-min' in sys.argv:
        desde_min = float(sys.argv[sys.argv.index('--desde-min') + 1])
        args = [a for a in args if a != sys.argv[sys.argv.index('--desde-min') + 1]]
    fuente, bpm = args[0], float(args[1]) if len(args) > 1 else None
    if fuente in ('tema', 'drama', 'calma', 'victoria'):
        e = json.loads((RAIZ / 'dist/estudio/musica/elegidas.json').read_text())[fuente]
        ruta = RAIZ / e['archivo']
        bpm = bpm or e.get('bpm_medido') or e['bpm']
        if desde_min is None:
            desde_min = (e.get('bucle') or {}).get('inicio', 0)
    else:
        ruta = Path(fuente)
    if not bpm:
        sys.exit('falta el bpm')
    desde_min = desde_min or 0
    x, sr = leer(ruta)
    hop, win = 256, 1024
    frames = np.lib.stride_tricks.sliding_window_view(x, win)[::hop] * np.hanning(win)
    spec = np.log1p(np.abs(np.fft.rfft(frames, axis=1)) * 10)
    flux = np.concatenate([[0], np.maximum(0, np.diff(spec, axis=0)).sum(1)])
    t = np.arange(len(flux)) * hop / sr
    # tempo y fase a la vez (el bpm medido de elegidas.json puede ir un poco corrido): ±3 % en pasos de 0,1
    m = (t >= desde_min) & (t < min(t[-1], desde_min + 25))
    mejor = (0, -1, bpm)
    for b in np.arange(round(bpm * 0.97, 1), bpm * 1.03, 0.1):
        p = 60 / b
        for fase in np.arange(0, p, 0.005):
            d = np.abs(t[m] - fase - np.round((t[m] - fase) / p) * p)
            puntos = (flux[m] * np.exp(-(d / 0.02) ** 2)).sum()
            if puntos > mejor[1]:
                mejor = (fase, puntos, b)
    fase, bpm = mejor[0], float(mejor[2])
    periodo = 60 / bpm
    desde = fase + np.ceil((desde_min - fase) / periodo) * periodo
    print(json.dumps({'archivo': str(ruta.relative_to(RAIZ)) if ruta.is_relative_to(RAIZ) else str(ruta),
                      'bpm': round(bpm, 3), 'golpe_s': round(periodo, 5), 'fase': round(float(fase), 3),
                      'desde': round(float(desde), 4)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
