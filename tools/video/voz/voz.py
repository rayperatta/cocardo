#!/usr/bin/env python3
"""Voces de personajes para los videos: texto → WAV 48 kHz mono, sin silencios en las puntas, a −16 LUFS.

Este archivo solo usa la biblioteca estándar: reparte el trabajo y le pasa cada motor a motor.py, que corre en el
venv de ese motor (Chatterbox o Qwen3-TTS) con el candado de la GPU. Reparto y parámetros: voces.json.

Uso:
  voz.py --quien cocardo --texto "No está viejo, está experimentado." [--emocion burlon]
  voz.py lote.json [--salida carpeta]        lote = [{"quien", "texto", "emocion"?, "voz"?, "id"?}, …]
  voz.py lote.json --revisar [--tomas 3]     además pasa cada línea por whisper y repite con otra semilla las que
                                             fallan (WER, idioma o ritmo); se queda con la mejor toma
  voz.py --calendario [cal.json] --video D01-2 [--rama 1]
                                             el lote son las parametros.lineas de ese video (o de su alternativa);
                                             sin --video, todas las líneas distintas del calendario
  voz.py --elegir cocardo cocardo-b          cambia la voz por defecto de un personaje y la deja fija (el casting ya
                                             no la toca); con «auto» la suelta y vuelve a mandar la recomendada
  voz.py --aplicar elegidas.json             aplica lo que se eligió en la página del casting ({"cocardo": "cocardo-b", …})
  voz.py --disenar cocardo-a [lima-b …]      (re)crea la voz de referencia con Qwen3-TTS VoiceDesign
  voz.py --descargar [motor …]               baja los modelos (sin usar la GPU)
  voz.py --listar                            reparto actual
Imprime en la salida estándar un JSON con la ruta y la duración de cada línea (el montaje lo usa para colocar voces
y subtítulos). Lo demás va a stderr. Caché por hash en dist/estudio/voz-cache/.
"""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True  # sin __pycache__ dentro del repo
sys.path.insert(0, str(Path(__file__).resolve().parent))
import texto_es  # noqa: E402

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[2]
ESTUDIO = Path.home() / '.local/share/cocardo-estudio'
CACHE = RAIZ / 'dist/estudio/voz-cache'
CANDADO = ESTUDIO / 'gpu.lock'
VOCES = AQUI / 'voces.json'
# Súbelo si cambia el posproceso (recorte, volumen, formato): invalida la caché entera
VERSION_POST = 3


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def leer_voces():
    return json.loads(VOCES.read_text(encoding='utf-8'))


def guardar_voces(cfg):
    VOCES.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def calendario_actual():
    """El calendario de videos más reciente (tools/video/calendario/AAAA-MM-DD.json)."""
    cals = sorted((RAIZ / 'tools/video/calendario').glob('20*.json'))
    if not cals:
        raise SystemExit('No hay calendario en tools/video/calendario/')
    return cals[-1]


def lineas_calendario(ruta, video=None, rama=0):
    """parametros.lineas del calendario. Con video: las de ese video en orden (rama 0 = el plan normal, 1, 2… = sus
    alternativas). Sin video: todas las líneas distintas de todos los videos y ramas, con la lista de videos donde salen."""
    cal = json.loads(Path(ruta).read_text(encoding='utf-8'))
    def ramas(v):
        alt = v.get('alternativa')
        return [v] + (alt if isinstance(alt, list) else [alt] if alt else [])
    def de(r):
        return [dict(l) for l in (r.get('parametros') or {}).get('lineas') or []]
    if video:
        v = next((v for v in cal['videos'] if v['id'] == video), None)
        if v is None:
            raise SystemExit(f'No existe el video {video} en {ruta}')
        rs = ramas(v)
        if rama >= len(rs):
            raise SystemExit(f'{video} tiene {len(rs) - 1} alternativa(s): usa --rama 0 a {len(rs) - 1}')
        lineas = de(rs[rama])
        if not lineas:
            raise SystemExit(f'{video} (rama {rama}) no trae parametros.lineas')
        return lineas
    unicas = {}
    for v in cal['videos']:
        for k, r in enumerate(ramas(v)):
            for l in de(r):
                c = (l['quien'], l['texto'], l.get('emocion') or 'normal')
                u = unicas.setdefault(c, {'quien': c[0], 'texto': c[1], 'emocion': c[2], 'videos': []})
                etiqueta = v['id'] + (f' (rama {k})' if k else '')
                if etiqueta not in u['videos']:
                    u['videos'].append(etiqueta)
    return list(unicas.values())


def ruta_ref(rel):
    """Las referencias viven en referencias/ (si pesan poco) o en ~/.local/share/cocardo-estudio/voz-referencias/."""
    p = Path(os.path.expanduser(rel))
    return p if p.is_absolute() else AQUI / p


def sha_archivo(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for bloque in iter(lambda: f.read(1 << 20), b''):
            h.update(bloque)
    return h.hexdigest()[:16]


def python_de(cfg, motor):
    venv = cfg['motores'][motor]['venv']
    return str(Path(os.path.expanduser(venv)) / 'bin/python')


def parametros(cfg, voz_id, emocion):
    """Junta voz + emoción en los parámetros finales que recibe el motor (y que entran en el hash)."""
    v = cfg['voces'][voz_id]
    emo = cfg['emociones'].get(emocion or 'normal') or cfg['emociones']['normal']
    p = {'motor': v['motor'], 'modelo': cfg['motores'][v['motor']]['modelo'],
         'semilla': v.get('semilla', 1), 'temperatura': v.get('temperatura', 0.8),
         'velocidad': v.get('velocidad', 1.0) * emo.get('velocidad', 1.0), 'tono': v.get('tono', 0)}
    if v['motor'] == 'chatterbox':
        # La emoción mueve la exageración y el cfg alrededor del punto propio de cada voz (0,5 = neutro)
        p['exageracion'] = round(min(1.6, max(0.25, v.get('exageracion', 0.5) + emo.get('exageracion', 0.5) - 0.5)), 3)
        p['cfg'] = round(min(1.0, max(0.2, v.get('cfg', 0.5) + emo.get('cfg', 0.5) - 0.5)), 3)
    if v['motor'] == 'qwen-diseno':
        p['instruccion'] = (v['diseno']['instruccion'] + ' ' + emo.get('instruccion', '')).strip()
    if v['motor'] in ('chatterbox', 'qwen'):
        ref = ruta_ref(v['referencia'])
        if not ref.exists():
            raise SystemExit(f'Falta la referencia de {voz_id}: {ref}. Créala con: voz.py --disenar {voz_id}')
        p['referencia'] = str(ref)
        p['ref_sha'] = sha_archivo(ref)
        p['ref_texto'] = texto_es.para_tts(v['diseno']['texto'])
    return p


def clave(p, texto):
    datos = json.dumps({'post': VERSION_POST, 'p': {k: v for k, v in p.items() if k != 'referencia'}, 't': texto},
                       sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(datos.encode('utf-8')).hexdigest()[:20]


def correr_motor(cfg, motor, trabajos, modo='generar'):
    """Corre motor.py en el venv del motor, con el candado de la GPU, y devuelve su resumen."""
    with tempfile.TemporaryDirectory(prefix='voz-') as tmp:
        entrada, salida = Path(tmp) / 'trabajos.json', Path(tmp) / 'resultado.json'
        entrada.write_text(json.dumps({'motor': motor, 'modo': modo, 'config': cfg['motores'][motor],
                                       'trabajos': trabajos}, ensure_ascii=False), encoding='utf-8')
        env = dict(os.environ, HF_HOME=str(ESTUDIO / 'hf'), TOKENIZERS_PARALLELISM='false', TQDM_DISABLE='1')
        cmd = [python_de(cfg, motor), str(AQUI / 'motor.py'), str(entrada), str(salida)]
        if modo != 'descargar':
            CANDADO.parent.mkdir(parents=True, exist_ok=True)
            cmd = ['flock', str(CANDADO)] + cmd
        log(f'[voz] {motor}: {len(trabajos)} línea(s)…')
        r = subprocess.run(cmd, env=env, stdout=sys.stderr)
        if r.returncode != 0 or not salida.exists():
            raise SystemExit(f'[voz] falló el motor {motor} (código {r.returncode})')
        return json.loads(salida.read_text(encoding='utf-8'))


def generar(cfg, lineas, sin_cache=False):
    """lineas: [{quien, texto, emocion?, voz?, id?}] → misma lista con ruta, duración y si salió de la caché."""
    CACHE.mkdir(parents=True, exist_ok=True)
    pendientes, salida, resumen = {}, [], {}
    for i, l in enumerate(lineas):
        quien = l.get('quien') or 'narrador'
        if quien not in cfg['personajes']:
            raise SystemExit(f'Personaje desconocido: {quien}')
        voz_id = l.get('voz') or cfg['personajes'][quien]['voz']
        texto = texto_es.para_tts(l['texto'])
        p = parametros(cfg, voz_id, l.get('emocion'))
        if l.get('toma'):
            p['semilla'] += 1000 * l['toma']  # otra toma = otra semilla, misma voz
        h = clave(p, texto)
        wav, meta = CACHE / f'{h}.wav', CACHE / f'{h}.json'
        item = {'id': l.get('id', i + 1), 'quien': quien, 'voz': voz_id, 'texto': l['texto'],
                'emocion': l.get('emocion') or 'normal', 'toma': l.get('toma', 0), 'ruta': str(wav)}
        # Lo demás de la línea (hueco, escena, nueva… del calendario) pasa tal cual para el montaje
        for k, v in l.items():
            item.setdefault(k, v)
        if wav.exists() and meta.exists() and not sin_cache:
            item.update(json.loads(meta.read_text(encoding='utf-8'))['medidas'], cache=True)
        else:
            pendientes.setdefault(p['motor'], []).append(
                {'id': h, 'texto': texto, 'p': p, 'wav': str(wav), 'meta': str(meta), 'voz': voz_id})
            item['cache'] = False
        salida.append(item)
    for motor, trabajos in pendientes.items():
        res = correr_motor(cfg, motor, trabajos)
        resumen[motor] = {k: v for k, v in res.items() if k != 'trabajos'}
        for t in res['trabajos']:
            if not t.get('ok'):
                raise SystemExit(f"[voz] {t['id']}: {t.get('error')}")
    for item in salida:
        if not item['cache']:
            meta = Path(item['ruta']).with_suffix('.json')
            item.update(json.loads(meta.read_text(encoding='utf-8'))['medidas'])
    return salida, resumen


def revisar(cfg, items):
    """Pasa las líneas por revisar_voz.py (venv de whisper) y devuelve un resultado por línea, en orden."""
    with tempfile.TemporaryDirectory(prefix='voz-rev-') as tmp:
        lote = Path(tmp) / 'lote.json'
        lote.write_text(json.dumps([{'ruta': i['ruta'], 'texto': i['texto']} for i in items], ensure_ascii=False),
                        encoding='utf-8')
        py = str(Path(os.path.expanduser(cfg['revision']['venv'])) / 'bin/python')
        r = subprocess.run([py, str(AQUI / 'revisar_voz.py'), '--lote', str(lote)], capture_output=True, text=True,
                           env=dict(os.environ, HF_HOME=str(ESTUDIO / 'hf')))
        if r.returncode not in (0, 1):
            raise SystemExit(f'[voz] falló revisar_voz.py:\n{r.stderr[-2000:]}')
        return json.loads(r.stdout)['resultados']


def generar_revisado(cfg, lineas, tomas=3, sin_cache=False):
    """Genera, revisa y repite las líneas que fallan hasta «tomas» veces; deja la mejor toma de cada una."""
    # El id se fija aquí: al repetir solo las que fallan, la posición en la sublista ya no es la del lote
    lineas = [dict(l, id=l.get('id', i + 1)) for i, l in enumerate(lineas)]
    nuevas, resumen = generar(cfg, lineas, sin_cache)
    pendientes = list(range(len(lineas)))  # índices de las líneas que se acaban de generar
    mejor = [None] * len(lineas)
    for intento in range(tomas):
        for k, item, r in zip(pendientes, nuevas, revisar(cfg, nuevas)):
            item['revision'] = {c: r[c] for c in ('ok', 'wer', 'idioma', 'prob_idioma', 'palabras_por_s',
                                                 'transcripcion', 'fallos')}
            # Gana la toma que pasa; entre iguales, la de menor WER
            if mejor[k] is None or (not r['ok'], r['wer']) < (not mejor[k]['revision']['ok'], mejor[k]['revision']['wer']):
                mejor[k] = item
        pendientes = [k for k, m in enumerate(mejor) if not m['revision']['ok']]
        if not pendientes or intento == tomas - 1:
            break
        log(f'[voz] {len(pendientes)} línea(s) no pasan la revisión: otra toma…')
        for k in pendientes:
            lineas[k]['toma'] = lineas[k].get('toma', 0) + 1
        nuevas, r2 = generar(cfg, [lineas[k] for k in pendientes], sin_cache)
        for m, r in r2.items():
            resumen.setdefault(f'{m}-toma{intento + 2}', r)
    return mejor, resumen


def disenar(cfg, voces):
    """Crea la voz de referencia de cada voz con Qwen3-TTS VoiceDesign (descripción en texto → audio)."""
    trabajos = []
    for vid in voces:
        v = cfg['voces'][vid]
        d = v['diseno']
        destino = ruta_ref(v.get('referencia') or f'referencias/{vid}.flac')
        trabajos.append({'id': vid, 'texto': texto_es.para_tts(d['texto']), 'wav': str(destino),
                         'p': {'instruccion': d['instruccion'], 'semilla': d.get('semilla', 1),
                               'temperatura': d.get('temperatura', 0.9)}})
    res = correr_motor(cfg, 'qwen-diseno', trabajos, modo='disenar')
    destinos = {t['id']: t['wav'] for t in trabajos}
    for t in res['trabajos']:
        if not t.get('ok'):
            raise SystemExit(f"[voz] diseño {t['id']}: {t.get('error')}")
        v = cfg['voces'][t['id']]
        final = Path(destinos[t['id']])
        # Las referencias pesadas no se versionan: van a la carpeta del estudio
        if final.stat().st_size > 500 * 1024 and AQUI in final.parents:
            fuera = ESTUDIO / 'voz-referencias' / final.name
            fuera.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(final, fuera)
            final = fuera
        v['referencia'] = (str(final.relative_to(AQUI)) if AQUI in final.parents
                           else '~/' + str(final.relative_to(Path.home())))
        v['diseno'].pop('aprobada', None)  # voz nueva: la revisión del casting la vuelve a aprobar
    guardar_voces(cfg)
    return res


def main():
    ap = argparse.ArgumentParser(description='Voces de personajes (ver encabezado del archivo).')
    ap.add_argument('lote', nargs='?', help='JSON con la lista de líneas (o - para leerla de la entrada estándar)')
    ap.add_argument('--quien'), ap.add_argument('--texto'), ap.add_argument('--emocion')
    ap.add_argument('--voz', help='fuerza una voz concreta (para probar candidatos)')
    ap.add_argument('--calendario', nargs='?', const='', metavar='CALENDARIO_JSON',
                    help='toma las líneas de parametros.lineas del calendario (sin ruta: el más reciente)')
    ap.add_argument('--video', help='con --calendario: solo las líneas de ese video (p. ej. D01-2)')
    ap.add_argument('--rama', type=int, default=0, help='con --video: 0 = plan normal, 1, 2… = su alternativa')
    ap.add_argument('--salida', help='copia los WAV a esta carpeta como 01-quien.wav, 02-…')
    ap.add_argument('--sin-cache', action='store_true')
    ap.add_argument('--revisar', action='store_true', help='revisa con whisper y repite las líneas que fallan')
    ap.add_argument('--tomas', type=int, default=3, help='máximo de tomas por línea con --revisar')
    ap.add_argument('--elegir', nargs=2, metavar=('PERSONAJE', 'VOZ'), help='VOZ = auto suelta la elección')
    ap.add_argument('--aplicar', metavar='ELEGIDAS_JSON')
    ap.add_argument('--disenar', nargs='+', metavar='VOZ')
    ap.add_argument('--descargar', nargs='*', metavar='MOTOR', help='baja los modelos (todos o los que digas)')
    ap.add_argument('--listar', action='store_true')
    a = ap.parse_args()
    cfg = leer_voces()

    if a.listar:
        for pid, per in cfg['personajes'].items():
            v = cfg['voces'][per['voz']]
            print(f"{pid:15} {per['voz']:18} {v['motor']:11} {'fija ' if per.get('fija') else ''}{v['descripcion']}")
        return
    if a.elegir or a.aplicar:
        elegidas = dict([a.elegir]) if a.elegir else json.loads(Path(a.aplicar).read_text(encoding='utf-8'))
        for pid, vid in elegidas.items():
            if pid not in cfg['personajes'] or (vid not in cfg['voces'] and vid != 'auto'):
                raise SystemExit(f'No existe {pid} o {vid} en voces.json')
            per = cfg['personajes'][pid]
            if vid == 'auto':
                # Suelta la elección: el próximo «casting.py pagina» pone la recomendada según WER y ritmo
                per.pop('fija', None)
                log(f"[voz] {pid}: sigue con {per['voz']} hasta que casting.py pagina ponga la recomendada")
                continue
            # «fija»: elegida a mano, el casting ya no la cambia
            per['voz'], per['fija'] = vid, True
            log(f'[voz] {pid} → {vid}')
        guardar_voces(cfg)
        return
    if a.descargar is not None:
        for motor in a.descargar or cfg['motores']:
            correr_motor(cfg, motor, [], modo='descargar')
        return
    if a.disenar:
        voces = list(cfg['voces']) if a.disenar == ['todas'] else a.disenar
        print(json.dumps(disenar(cfg, voces), ensure_ascii=False, indent=1))
        return

    if a.texto:
        lineas = [{'quien': a.quien or 'narrador', 'texto': a.texto, 'emocion': a.emocion, 'voz': a.voz}]
    elif a.lote:
        datos = json.load(sys.stdin if a.lote == '-' else open(a.lote, encoding='utf-8'))
        lineas = datos['lineas'] if isinstance(datos, dict) else datos
    elif a.calendario is not None:
        lineas = lineas_calendario(a.calendario or calendario_actual(), a.video, a.rama)
    else:
        ap.error('falta --texto, un lote o --calendario')
    if a.voz and not a.texto:
        for l in lineas:
            l['voz'] = a.voz
    if a.revisar:
        salida, resumen = generar_revisado(cfg, lineas, a.tomas, a.sin_cache)
    else:
        salida, resumen = generar(cfg, lineas, a.sin_cache)
    if a.salida:
        carpeta = Path(a.salida)
        carpeta.mkdir(parents=True, exist_ok=True)
        for n, item in enumerate(salida, 1):
            destino = carpeta / f"{n:02d}-{item['quien']}.wav"
            shutil.copyfile(item['ruta'], destino)
            item['ruta'] = str(destino)
    print(json.dumps({'lineas': salida, 'motores': resumen}, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
