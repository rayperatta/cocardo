#!/usr/bin/env python3
"""Elige la música por defecto de cada grupo y arma la página para cambiarla.

Solo usa la biblioteca estándar: corre con el python3 del sistema o con el venv. Lee dist/estudio/musica/musica.json
(lo escribe revisar.py, que llama a esto al terminar) y deja ahí mismo:
  elegidas.json  { tema, drama, victoria, calma }: la pista de cada grupo, la ruta para «audio.musicaArchivo» y su
                 bucle. Lo elegido a mano («a_mano») se respeta mientras la pista siga pasando la revisión.
  index.html     la página para escuchar y elegir (plantilla.html con los datos dentro).
Uso:
  elegir.py                           elige por las medidas los grupos que no estén elegidos a mano
  elegir.py tema=tema-4 calma=calma-2   fija esas a mano
  elegir.py --aplicar elegidas.json   aplica el archivo que se descargó o copió de la página
  elegir.py --medidas                 olvida lo elegido a mano y vuelve a elegir todo por las medidas
Por las medidas gana la de menor puntaje (ver puntaje()); en elegidas.json queda el desglose de cada candidata.
"""
import argparse
import datetime
import json
import sys
from pathlib import Path

sys.dont_write_bytecode = True

AQUI = Path(__file__).resolve().parent
REPO = AQUI.parents[2]
SALIDA = REPO / 'dist/estudio/musica'
GRUPOS = ('tema', 'drama', 'victoria', 'calma')
NOTA = ('Música elegida para los montajes (tools/video/musica/elegir.py). «archivo» va tal cual en '
        'audio.musicaArchivo: en tema, drama y calma es la versión larga (la pista hasta «bucle.inicio» y vueltas del '
        'bucle hasta pasar 75 s, con el mismo cruce que se oye en «Bucle ×3» de la página); sin tramos suena desde 0 '
        'hasta el final del video. «original» es la pista sin alargar. «bucle» (s; valen en las dos): al llegar a '
        '«fin» vuelve a «inicio» con un fundido cruzado de «fundido_cruzado» s. «tramo» es una vuelta ya hecha, para '
        'repetir tal cual. «a_mano»: la eligió la dueña en la página; si no, ganó por las medidas («puntaje», menos '
        'es mejor; «comparadas» trae a las demás).')

# Penalizaciones del puntaje (menos es mejor). Cada aviso de revisar.py pide oído humano; la voz cuenta por cuánto le
# falta margen frente a una pista limpia (−45 dB); el bucle importa donde la música se repite.
PESO_AVISO, VOZ_LIMPIA_DB = 2.0, -45.0
CON_BUCLE = ('tema', 'calma', 'drama')

# Si un montaje necesita la pista original en bucle (por ejemplo, un video de más de 75 s), estos tramos de
# audio.musica hacen el mismo cruce con los fundidos lineales de kit.js (e = una entrada de elegidas.json):
#   function musicaEnBucle(e, t0, t1, fadeOut) {
#     var b = e.bucle, X = b.fundido_cruzado || 0.04, out = [], t = t0, desde = 0;
#     for (;;) {
#       var hasta = t + b.fin - desde, ultimo = hasta >= t1;
#       out.push({ t0: t, t1: ultimo ? t1 : hasta, desde: desde, fadeIn: out.length ? X : 0.02,
#                  fadeOut: ultimo ? (fadeOut || 0.8) : X });
#       if (ultimo) return out;
#       t = hasta - X; desde = b.inicio - X;   // la vuelta siguiente entra X s antes, mientras esta se apaga
#     }
#   }
#   audio: { musicaArchivo: e.original, musica: musicaEnBucle(e, 0, 90) }


def puntaje(p):
    """Penalización de una pista y su desglose (texto para personas)."""
    partes, total = [], 0.0

    def suma(v, txt):
        nonlocal total
        if abs(v) >= 0.005:
            total += v
            partes.append(f'{txt}: {v:+.2f}')
    suma(PESO_AVISO * len(p.get('avisos') or []), f"{len(p.get('avisos') or [])} aviso(s) de revisar.py")
    vdb = (p.get('voz') or {}).get('voz_db')
    if vdb is not None:
        suma(max(0.0, vdb - VOZ_LIMPIA_DB) / 10, f'pista de voz separada a {vdb} dB')
    b, g = p.get('bucle'), p['grupo']
    if g in CON_BUCLE and b:
        suma(2 * b['distancia'], f"costura del bucle (parecido {b['distancia']})")
        suma(2 * max(0.0, b.get('golpe_costura', 0) - 1), f"golpe en la costura ({b.get('golpe_costura')})")
        if g == 'tema':  # el tema va debajo de videos largos: cuanto más largo el bucle, menos se nota que se repite
            suma(-0.5 * b['largo'] / p['duracion'], f"bucle de {b['largo']:.1f} s de {p['duracion']:.1f}")
    if g == 'tema' and p.get('bpm_medido'):
        suma(5 * abs(p['bpm_medido'] / p['bpm_pedido'] - 1),
             f"{p['bpm_medido']} bpm medidos ({p['bpm_pedido']} pedidos)")
    if g == 'victoria' and p.get('cortado_al_maximo'):
        suma(1.0, 'cortada con fundido (no termina sola)')
    return round(total, 3), partes


def relativa(ruta):
    return (SALIDA / ruta).relative_to(REPO).as_posix()


def entrada(p, a_mano=False):
    """Lo que va en elegidas.json para una pista."""
    b = p.get('bucle')
    total, partes = puntaje(p)
    larga = b.get('larga') if b else None
    return {'id': p['id'], 'archivo': relativa(larga or p['archivo']),
            'duracion': b['larga_s'] if larga else p['duracion'],
            'original': relativa(p['archivo']), 'duracion_original': p['duracion'],
            'bpm': p['bpm_pedido'], 'bpm_medido': p.get('bpm_medido'), 'tonalidad': p.get('tonalidad', ''),
            'bucle': {k: b[k] for k in ('inicio', 'fin', 'largo', 'compases', 'fundido_cruzado')} if b else None,
            'tramo': relativa(b['tramo']) if b and b.get('tramo') else None,
            'descripcion': p.get('descripcion', ''), 'a_mano': a_mano, 'puntaje': total, 'desglose': partes}


def leer_json(ruta):
    try:
        return json.loads(Path(ruta).read_text(encoding='utf-8'))
    except FileNotFoundError:
        return None


def elegir(datos, previas=None, fijas=None, medidas=False):
    """{grupo: entrada}. fijas = {grupo: id} elegidas a mano ahora; previas = elegidas.json anterior."""
    pistas = {p['id']: p for p in datos['pistas']}
    for grupo, pid in (fijas or {}).items():
        if grupo not in GRUPOS or pid not in pistas or pistas[pid]['grupo'] != grupo:
            sys.exit(f'{grupo}={pid}: no hay una pista «{pid}» del grupo «{grupo}» en musica.json')
    salida = {'nota': NOTA, 'generado': datetime.datetime.now().isoformat(timespec='seconds')}
    for g in GRUPOS:
        cands = [p for p in datos['pistas'] if p['grupo'] == g]
        if not cands:
            continue
        ranking = sorted(cands, key=lambda p: (not p.get('ok'), puntaje(p)[0]))
        elegida, a_mano = ranking[0], False
        prev = (previas or {}).get(g) or {}
        if fijas and g in fijas:
            elegida, a_mano = pistas[fijas[g]], True
        elif not medidas and prev.get('a_mano') and prev.get('id') in pistas and pistas[prev['id']].get('ok'):
            elegida, a_mano = pistas[prev['id']], True
        if not elegida.get('ok'):
            print(f'{g}: ninguna pasa la revisión; queda {elegida["id"]} hasta que haya otra', file=sys.stderr)
        salida[g] = entrada(elegida, a_mano) | {
            'comparadas': {p['id']: (puntaje(p)[0] if p.get('ok') else 'no pasa') for p in ranking}}
    return salida


def pagina(datos, elegidas):
    """index.html: la plantilla con musica.json, las elegidas y la entrada de cada pista (para cambiar de elegida
    sin repetir aquí la lógica en JavaScript)."""
    entradas = {p['id']: entrada(p, True) for p in datos['pistas']}
    html = (AQUI / 'plantilla.html').read_text(encoding='utf-8')
    for marca, valor in (('DATOS', datos), ('ELEGIDAS', elegidas), ('ENTRADAS', entradas)):
        incrustado = json.dumps(valor, ensure_ascii=False).replace('</', '<\\/')  # que no cierre el <script>
        html = html.replace(f'/*{marca}*/null', incrustado)
    (SALIDA / 'index.html').write_text(html, encoding='utf-8')


def armar(fijas=None, medidas=False):
    datos = leer_json(SALIDA / 'musica.json')
    if not datos:
        sys.exit(f'Falta {SALIDA / "musica.json"}: corre revisar.py')
    # Lo que revisar.py no copia a musica.json pero sirve para elegir (sale del <id>.json de generar.py)
    for p in datos['pistas']:
        info = leer_json(SALIDA / f"{p['id']}.json") or {}
        p.setdefault('cortado_al_maximo', info.get('cortado_al_maximo'))
    elegidas = elegir(datos, leer_json(SALIDA / 'elegidas.json'), fijas, medidas)
    (SALIDA / 'elegidas.json').write_text(json.dumps(elegidas, ensure_ascii=False, indent=1), encoding='utf-8')
    pagina(datos, elegidas)
    for g in GRUPOS:
        if g in elegidas:
            e = elegidas[g]
            print(f"{g}: {e['id']} ({'a mano' if e['a_mano'] else 'por las medidas'}, puntaje {e['puntaje']})")
    print(f"Elegidas: {SALIDA / 'elegidas.json'}\nPágina: {SALIDA / 'index.html'}")
    return elegidas


def main():
    ap = argparse.ArgumentParser(description='Elige la música por defecto (ver encabezado).')
    ap.add_argument('fijar', nargs='*', help='grupo=id, por ejemplo tema=tema-4')
    ap.add_argument('--aplicar', help='elegidas.json descargado de la página (o { grupo: id })')
    ap.add_argument('--medidas', action='store_true', help='olvida lo elegido a mano')
    a = ap.parse_args()
    fijas = {}
    if a.aplicar:
        d = leer_json(a.aplicar)
        if d is None:
            sys.exit(f'No encuentro {a.aplicar}')
        for g in GRUPOS:
            v = d.get(g)
            if isinstance(v, str):
                fijas[g] = v
            elif isinstance(v, dict) and v.get('id') and v.get('a_mano'):  # lo demás sigue por las medidas
                fijas[g] = v['id']
    for f in a.fijar:
        g, _, pid = f.partition('=')
        if not pid:
            sys.exit(f'«{f}»: va grupo=id, por ejemplo tema=tema-4')
        fijas[g] = pid
    armar(fijas, a.medidas)


if __name__ == '__main__':
    main()
