#!/usr/bin/env python3
"""Casting de voces: diseña las referencias, genera 2 frases reales por candidato, las revisa con whisper y arma
dist/estudio/casting/ (index.html para escuchar y elegir, casting.json y un WAV por candidato).

Uso (cualquier Python 3.9+; los modelos corren en sus venvs con el candado de la GPU):
  casting.py todo              referencias + frases + audición con el calendario + página (lo hecho sale de la caché)
  casting.py referencias       solo diseña (o rediseña) las referencias que falten o no pasen la revisión
  casting.py frases            genera y revisa las frases de todos los candidatos
  casting.py calendario        audición con el guion: cada candidato dice todas las líneas de su personaje en el
                               calendario de videos (una toma, sin repetir) y whisper las revisa. Afina la
                               recomendación y deja esas líneas en la caché para la producción
  casting.py pagina            rehace casting.json e index.html y pone en voces.json el mejor de cada personaje
Para aplicar lo que la dueña marque en la página: voz.py --aplicar elegidas.json
"""
import html
import json
import os
import sys
import wave
from pathlib import Path

sys.dont_write_bytecode = True  # sin __pycache__ dentro del repo
sys.path.insert(0, str(Path(__file__).resolve().parent))
import voz  # noqa: E402

SALIDA = voz.RAIZ / 'dist/estudio/casting'
PAUSA_S = 0.7
TANDA = 60  # líneas por llamada al motor en la audición: suelta el candado de la GPU entre tandas

# Dos frases reales por personaje (js/story.js y docs/PERSONAJES.md), con el ánimo con que se dicen en el guion.
# El oficial Sandía casi no habla en la serie: «¿Tenemos orden?» y «¿Cuántas unidades?» son suyas
# (docs/investigacion/verificacion.json) y «Ya pasó todo…» se la atribuyen dos fuentes de la biblia.
# Las del narrador salen de las tarjetas del guion y del gancho del video 9; las de la reportera (temporada 3, edición
# noticiero del Reto), de docs/CALENDARIO.md y del calendario de videos. A Don Piña no se le pone «Creí que eras
# un hombre de palabra»: suena igual que «creí que era su nombre…» y whisper no las distingue.
FRASES = {
    'cocardo': [('No está viejo, está experimentado.', 'burlon'),
                ('¡Mi congelador no! ¡Costó cuatro mil pesos!', 'asustado')],
    'cereza': [('Tú haces el helado, yo te ayudo a convertir esto en un imperio.', 'coqueta'),
               ('No me hizo socia. Yo vi una oportunidad.', 'burlon')],
    'lima': [('Cocardo, hoy vendemos menos de lo que cuesta prender las luces.', 'triste'),
             ('Gracias, ayudante. Sin ti seguiríamos en el congelador.', 'feliz')],
    'pina': [('Necesito 500 litros para empezar… 500 por sabor. Consígueme 5 y tenemos un trato.', 'feliz'),
             ('Me preocupa que mañana tengo pedidos y nadie que los produzca.', 'enojado')],
    'banano': [('Así que tú eres Cocardo… ¿Dónde está mi hermana?', 'furioso'),
               ('Esta pulsera se la regalé yo… Hermana, estuviste aquí.', 'sorprendido')],
    'banana': [('Pensé que no iba a volver a verte… Gracias por venir por mí.', 'llorando'),
               ('¡Libre! ¿Dónde está mi hermano?', 'feliz')],
    'fresa': [('Vine a ver a mi prima Lima, no me responde desde ayer.', 'nervioso'),
              ('¡Sácanos de aquí, cabeza de coco!', 'enojado')],
    'durazna': [('¿Helado gratis de por vida? ¡Claro que sí!', 'feliz'),
                ('¡Aquí ya nadie se vuelve a congelar!', 'enojado')],
    'uva': [('Llegué hace unos días… sigo buscando trabajo.', 'feliz'),
            ('Ayúdame, por favor… un hombre me encerró en un congelador.', 'asustado')],
    'naranja': [('Vecina, te traje panecitos calientitos.', 'feliz'),
                ('¡Gracias, ayudante! Te guardé un panecito… medio congelado.', 'feliz')],
    'limon': [('El coco y la cereza tienen algo grande escondido en los congeladores.', 'normal'),
              ('Tiene que ver con su nieve.', 'burlon')],
    'policia_fresa': [('Dime que no estás haciendo otra vez lo que creo que estás haciendo.', 'enojado'),
                      ('Sin una orden no entro. Tráeme más pruebas.', 'normal')],
    'policia_sandia': [('¿Tenemos orden? ¿Cuántas unidades?', 'sorprendido'),
                       ('Ya pasó todo. Arrestamos al culpable.', 'normal')],
    'guardaespaldas': [('Entonces tendrás que sacármelas.', 'enojado'),
                       ('¿No le preocupa lo que encontraron?', 'normal')],
    'reportera': [('Es hora de contar la verdad.', 'normal'),
                  ('Última hora desde la heladería.', 'noticia')],
    'narrador': [('Cherry descubrió el secreto… y todo cambió.', 'narracion'),
                 ('Mientras tanto, en la cárcel…', 'narracion')],
}


def candidatos(cfg, pid):
    return [vid for vid, v in cfg['voces'].items() if v['personaje'] == pid]


def referencias(cfg, intentos=4):
    """Diseña las referencias que faltan y rediseña (otra semilla) las que whisper no entiende bien. La que pasa una
    vez queda «aprobada» y ya no se rediseña sola aunque cambien los criterios de la revisión (cambiaría la voz del
    candidato y toda su caché): si deja de pasar, solo se avisa."""
    faltan = [vid for vid, v in cfg['voces'].items() if not voz.ruta_ref(v['referencia']).exists()]
    if faltan:
        voz.disenar(cfg, faltan)
    for n in range(intentos):
        cfg = voz.leer_voces()
        items = [{'ruta': str(voz.ruta_ref(v['referencia'])), 'texto': v['diseno']['texto'], 'voz': vid}
                 for vid, v in cfg['voces'].items()]
        res = voz.revisar(cfg, items)
        for i, r in zip(items, res):
            d = cfg['voces'][i['voz']]['diseno']
            d['revision'] = {'wer': r['wer'], 'palabras_por_s': r['palabras_por_s'], 'idioma': r['idioma'], 'ok': r['ok']}
            if r['ok']:
                d['aprobada'] = True
        voz.guardar_voces(cfg)
        malas = [i['voz'] for i, r in zip(items, res) if not r['ok']]
        rehacer = [vid for vid in malas if not cfg['voces'][vid]['diseno'].get('aprobada')]
        if len(rehacer) < len(malas):
            voz.log(f'[casting] aprobadas antes que hoy no pasan (no se tocan; para rehacerlas: voz.py --disenar): '
                    f'{[vid for vid in malas if vid not in rehacer]}')
        if not rehacer:
            voz.log('[casting] referencias listas')
            return
        if n == intentos - 1:
            voz.log(f'[casting] referencias que siguen fallando: {rehacer}')
            return
        voz.log(f'[casting] rediseño {len(rehacer)} referencia(s): {rehacer}')
        for vid in rehacer:
            cfg['voces'][vid]['diseno']['semilla'] += 1
        voz.guardar_voces(cfg)
        voz.disenar(cfg, rehacer)


def unir(rutas, destino):
    """Junta WAV de 48 kHz mono con una pausa corta entre frases (biblioteca estándar)."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(destino), 'wb') as w:
        for k, r in enumerate(rutas):
            with wave.open(r, 'rb') as x:
                if k == 0:
                    w.setparams(x.getparams())
                else:
                    w.writeframes(b'\x00\x00' * int(x.getframerate() * PAUSA_S))
                w.writeframes(x.readframes(x.getnframes()))


def frases(cfg):
    lineas = []
    for pid, lista in FRASES.items():
        for vid in candidatos(cfg, pid):
            for k, (texto, emo) in enumerate(lista):
                lineas.append({'quien': pid, 'voz': vid, 'texto': texto, 'emocion': emo, 'id': f'{vid}#{k + 1}'})
    salida, resumen = voz.generar_revisado(cfg, lineas, tomas=3)
    por_voz = {}
    for item in salida:
        por_voz.setdefault(item['voz'], []).append(item)
    for vid, items in por_voz.items():
        unir([i['ruta'] for i in items], SALIDA / cfg['voces'][vid]['personaje'] / f'{vid}.wav')
    (SALIDA / 'frases.json').write_text(json.dumps({'lineas': salida, 'motores': resumen}, ensure_ascii=False,
                                                   indent=1), encoding='utf-8')
    return salida, resumen


def calendario(cfg):
    """Cada candidato dice, en una sola toma, las líneas de su personaje en el calendario; whisper las revisa."""
    unicas = voz.lineas_calendario(voz.calendario_actual())
    trabajos = []
    for n, l in enumerate(unicas):
        for vid in candidatos(cfg, l['quien']):
            trabajos.append(dict(l, voz=vid, id=f'{vid}|cal{n + 1}'))
    # Por motor y en tandas: cada tanda carga el modelo una vez y suelta el candado al terminar
    trabajos.sort(key=lambda t: cfg['voces'][t['voz']]['motor'])
    salida, resumen = [], {}
    for k in range(0, len(trabajos), TANDA):
        tanda = trabajos[k:k + TANDA]
        items, res = voz.generar(cfg, tanda)
        for item, r in zip(items, voz.revisar(cfg, items)):
            item['revision'] = {c: r[c] for c in ('ok', 'wer', 'idioma', 'prob_idioma', 'palabras_por_s',
                                                 'transcripcion', 'fallos')}
            salida.append(item)
        for m, r in res.items():
            resumen.setdefault(m, []).append(r)
        voz.log(f'[casting] audición: {len(salida)} de {len(trabajos)} líneas')
    (SALIDA / 'calendario.json').write_text(json.dumps({'lineas': salida, 'motores': resumen}, ensure_ascii=False,
                                                       indent=1), encoding='utf-8')
    return salida


def puntaje(c):
    """Menor es mejor, en este orden: que pasen las frases del casting; la parte de las líneas del calendario que pasa
    a la primera toma; el WER medio de todo, con castigo si el ritmo sale de lo cómodo (2,3–3,5 palabras/s); cuántas
    tomas de más pidió el casting; y, por último, la cercanía al centro del ritmo cómodo (2,9 palabras/s)."""
    lejos = max(0.0, 2.3 - c['ritmo_medio'], c['ritmo_medio'] - 3.5)
    cal = c.get('calendario') or {}
    tasa = cal['pasan'] / cal['lineas'] if cal.get('lineas') else 1.0
    tomas = sum(f['toma'] for f in c['frases'])
    return (not c['ok'], -round(tasa, 2), round(c['wer_medio'] + 0.04 * lejos, 3), tomas,
            round(abs(c['ritmo_medio'] - 2.9), 2))


def pagina(cfg):
    datos = json.loads((SALIDA / 'frases.json').read_text(encoding='utf-8'))
    por_voz, por_voz_cal = {}, {}
    for item in datos['lineas']:
        por_voz.setdefault(item['voz'], []).append(item)
    aud = SALIDA / 'calendario.json'
    for item in (json.loads(aud.read_text(encoding='utf-8'))['lineas'] if aud.exists() else []):
        por_voz_cal.setdefault(item['voz'], []).append(item)
    reparto = {}
    for pid, lista in FRASES.items():
        cands = []
        for vid in candidatos(cfg, pid):
            v, items = cfg['voces'][vid], por_voz.get(vid, [])
            if not items:
                continue
            revs = [i['revision'] for i in items]
            cal = [i['revision'] for i in por_voz_cal.get(vid, [])]
            todas = revs + cal  # WER y ritmo medios con las frases del casting y las del calendario
            c = {'voz': vid, 'motor': v['motor'], 'descripcion': v['descripcion'],
                 'archivo': f'{pid}/{vid}.wav', 'ok': all(r['ok'] for r in revs),
                 'wer_medio': round(sum(r['wer'] for r in todas) / len(todas), 3),
                 'ritmo_medio': round(sum(r['palabras_por_s'] for r in todas) / len(todas), 2),
                 'wer_frases': round(sum(r['wer'] for r in revs) / len(revs), 3),
                 'ritmo_frases': round(sum(r['palabras_por_s'] for r in revs) / len(revs), 2),
                 'frases': [{'texto': i['texto'], 'emocion': i['emocion'], 'toma': i.get('toma', 0),
                             'duracion': i['duracion'], 'gpu_s': i.get('gpu_s'), 'wer': i['revision']['wer'],
                             'palabras_por_s': i['revision']['palabras_por_s'], 'idioma': i['revision']['idioma'],
                             'transcripcion': i['revision']['transcripcion'], 'fallos': i['revision']['fallos']}
                            for i in items]}
            if cal:
                malas = [i for i in por_voz_cal[vid] if not i['revision']['ok']]
                c['calendario'] = {'lineas': len(cal), 'pasan': len(cal) - len(malas),
                                   'wer_medio': round(sum(r['wer'] for r in cal) / len(cal), 3),
                                   'ritmo_medio': round(sum(r['palabras_por_s'] for r in cal) / len(cal), 2),
                                   'fallan': [{'texto': i['texto'], 'emocion': i['emocion'], 'ruta': i['ruta'],
                                               'transcripcion': i['revision']['transcripcion'],
                                               'fallos': i['revision']['fallos']} for i in malas]}
            cands.append(c)
        cands.sort(key=puntaje)
        if cands:
            cands[0]['recomendada'] = True
            if not cfg['personajes'][pid].get('fija'):  # lo que se eligió a mano no se toca
                cfg['personajes'][pid]['voz'] = cands[0]['voz']
        reparto[pid] = {'nombre': cfg['personajes'][pid]['nombre'], 'direccion': cfg['personajes'][pid]['direccion'],
                        'candidatos': cands}
    voz.guardar_voces(cfg)
    resumen = {'personajes': reparto, 'motores': datos.get('motores', {}),
               'elegidas_por_defecto': {pid: cfg['personajes'][pid]['voz'] for pid in reparto}}
    (SALIDA / 'casting.json').write_text(json.dumps(resumen, ensure_ascii=False, indent=1), encoding='utf-8')
    (SALIDA / 'index.html').write_text(html_pagina(reparto, resumen['elegidas_por_defecto']), encoding='utf-8')
    voz.log(f'[casting] listo: {SALIDA / "index.html"}')


def relativa(ruta):
    """Ruta de un WAV de la caché vista desde la página (dist/estudio/casting/ → ../voz-cache/…)."""
    return os.path.relpath(ruta, SALIDA)


def html_pagina(reparto, defecto):
    e = html.escape
    bloques = []
    for pid, per in reparto.items():
        filas = []
        for c in per['candidatos']:
            fr = ''.join(f'<li><q>{e(f["texto"])}</q> <span class="emo">{e(f["emocion"])}</span>'
                         f'<span class="oido">whisper oyó: «{e(f["transcripcion"])}»</span></li>' for f in c['frases'])
            estado = 'pasa' if c['ok'] else 'no pasa'
            cal, aud = c.get('calendario'), ''
            if cal:
                det = ''.join(f'<li><q>{e(f["texto"])}</q> <span class="emo">{e(f["emocion"])}</span>'
                              f'<span class="oido">whisper oyó: «{e(f["transcripcion"])}» · {e(", ".join(f["fallos"]))}'
                              f'</span><audio controls preload="none" src="{e(relativa(f["ruta"]))}"></audio></li>'
                              for f in cal['fallan'])
                aud = (f'<p class="med">Guion del calendario: {cal["pasan"]} de {cal["lineas"]} líneas pasan a la '
                       f'primera · WER {cal["wer_medio"]:.2f} · {cal["ritmo_medio"]:.1f} palabras/s</p>'
                       + (f'<details><summary>Las que no pasan</summary><ol>{det}</ol></details>' if det else ''))
            filas.append(f'''
      <article class="cand{' rec' if c.get('recomendada') else ''}" data-pid="{pid}" data-voz="{c['voz']}">
        <header><b>{e(c['voz'])}</b> <span class="motor">{e(c['motor'])}</span>
          {'<span class="sello">recomendada</span>' if c.get('recomendada') else ''}</header>
        <p class="desc">{e(c['descripcion'])}</p>
        <audio controls preload="none" src="{e(c['archivo'])}"></audio>
        <p class="med">Sus frases: <span class="{'bien' if c['ok'] else 'mal'}">{estado}</span> ·
          WER {c['wer_frases']:.2f} · {c['ritmo_frases']:.1f} palabras/s</p>
        <ol>{fr}</ol>{aud}
        <button type="button" class="elegir">Elegir esta voz</button>
      </article>''')
        bloques.append(f'''
    <section id="{pid}">
      <h2>{e(per['nombre'])} <small>{e(pid)}</small></h2>
      <p class="dir">{e(per['direccion'])}</p>
      <div class="cands">{''.join(filas)}</div>
    </section>''')
    # De entrada, el reparto de voces.json: la recomendada o la que ya se eligió a mano
    recomendadas = {pid: next((c['voz'] for c in per['candidatos'] if c.get('recomendada')), None)
                    for pid, per in reparto.items()}
    return (PLANTILLA.replace('/*DEFECTO*/{}', json.dumps(defecto, ensure_ascii=False))
            .replace('/*RECOMENDADAS*/{}', json.dumps(recomendadas, ensure_ascii=False))
            .replace('<!--BLOQUES-->', ''.join(bloques)))


PLANTILLA = '''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Casting de voces</title>
<style>
  :root { --fondo:#fff7fb; --tinta:#2b1d24; --suave:#6e5a64; --tarjeta:#ffffff; --borde:#efd3e0;
          --marca:#d23c7a; --bien:#1f7a4d; --mal:#b3261e; --elegida:#fde6f0; }
  @media (prefers-color-scheme: dark) {
    :root { --fondo:#1b1418; --tinta:#f6e9ef; --suave:#bfa9b4; --tarjeta:#261c22; --borde:#43303a;
            --marca:#ff6fa8; --bien:#6fd39f; --mal:#ff8a80; --elegida:#3a2230; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--fondo); color:var(--tinta);
         font:16px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width:1100px; margin:0 auto; padding:24px 16px 120px; }
  h1 { margin:0 0 4px; font-size:28px; }
  .intro { color:var(--suave); margin:0 0 24px; }
  section { margin:32px 0; }
  h2 { margin:0; font-size:22px; } h2 small { color:var(--suave); font-weight:400; font-size:14px; }
  .dir { margin:4px 0 12px; color:var(--suave); }
  .cands { display:grid; gap:12px; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); }
  .cand { background:var(--tarjeta); border:1px solid var(--borde); border-radius:12px; padding:12px; }
  .cand.elegida { background:var(--elegida); border-color:var(--marca); box-shadow:0 0 0 2px var(--marca) inset; }
  .cand header { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
  .motor { font-size:12px; padding:1px 8px; border-radius:99px; border:1px solid var(--borde); color:var(--suave); }
  .sello { font-size:12px; padding:1px 8px; border-radius:99px; background:var(--marca); color:#fff; }
  .desc { margin:8px 0; }
  audio { width:100%; }
  .med { margin:6px 0; font-size:14px; color:var(--suave); }
  .bien { color:var(--bien); font-weight:600; } .mal { color:var(--mal); font-weight:600; }
  ol { margin:6px 0 10px; padding-left:20px; font-size:14px; }
  .emo { font-size:12px; color:var(--marca); margin-left:4px; }
  .oido { display:block; color:var(--suave); font-size:12px; }
  q { quotes: '«' '»'; }
  details { margin:0 0 10px; font-size:14px; } summary { cursor:pointer; color:var(--suave); }
  button { font:inherit; cursor:pointer; border-radius:8px; border:1px solid var(--marca);
           background:transparent; color:var(--marca); padding:6px 12px; }
  .cand.elegida button { background:var(--marca); color:#fff; }
  #resultado { position:sticky; bottom:0; background:var(--tarjeta); border-top:1px solid var(--borde);
               padding:12px 16px; margin:0 -16px; }
  textarea { width:100%; min-height:60px; height:60px; resize:vertical; font:13px/1.4 ui-monospace, Menlo, monospace; background:var(--fondo);
             color:var(--tinta); border:1px solid var(--borde); border-radius:8px; padding:8px; }
  .fila { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:6px; }
</style>
</head>
<body>
<main>
  <h1>Casting de voces</h1>
  <p class="intro">Escucha cada candidato con audífonos y marca la voz que más te guste de cada personaje.
    Las cifras son objetivas (whisper): WER = palabras mal entendidas (0 es perfecto), y el ritmo en palabras por
    segundo. Además de sus dos frases, cada candidato dijo en una sola toma todas las líneas de su personaje en el
    calendario de videos. «Recomendada» = la mejor según esas cifras; el acento y la actuación solo los juzga tu oído.
    Tu elección se guarda en este navegador. Al final copia el JSON y guárdalo como elegidas.json para aplicarlo con
    <code>voz.py --aplicar elegidas.json</code>.</p>
<!--BLOQUES-->
  <div id="resultado">
    <div class="fila"><b>Tu reparto</b> <button type="button" id="copiar">Copiar JSON</button>
      <button type="button" id="reiniciar">Volver a las recomendadas</button> <span id="aviso"></span></div>
    <textarea id="json" readonly></textarea>
  </div>
</main>
<script>
  var DEFECTO = /*DEFECTO*/{};            // reparto actual de voces.json
  var RECOMENDADAS = /*RECOMENDADAS*/{};  // la mejor de cada personaje según WER y ritmo
  var CLAVE = 'cocardo-casting-voces';
  function leer() { try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch (e) { return {}; } }
  function guardar(o) { try { localStorage.setItem(CLAVE, JSON.stringify(o)); } catch (e) {} }
  var elegidas = Object.assign({}, DEFECTO, leer());
  function pintar() {
    document.querySelectorAll('.cand').forEach(function (c) {
      var si = elegidas[c.dataset.pid] === c.dataset.voz;
      c.classList.toggle('elegida', si);
      c.querySelector('.elegir').textContent = si ? 'Elegida' : 'Elegir esta voz';
    });
    document.getElementById('json').value = JSON.stringify(elegidas, null, 2);
  }
  document.querySelectorAll('.elegir').forEach(function (b) {
    b.addEventListener('click', function () {
      var c = b.closest('.cand');
      elegidas[c.dataset.pid] = c.dataset.voz;
      guardar(elegidas); pintar();
    });
  });
  // Al reproducir un candidato se pausan los demás
  document.addEventListener('play', function (ev) {
    document.querySelectorAll('audio').forEach(function (a) { if (a !== ev.target) a.pause(); });
  }, true);
  function avisar(texto) { document.getElementById('aviso').textContent = texto; }
  function copiarViejo(t) {
    t.select();
    try { avisar(document.execCommand('copy') ? 'Copiado' : 'Selecciónalo y cópialo a mano'); }
    catch (e) { avisar('Selecciónalo y cópialo a mano'); }
  }
  document.getElementById('copiar').addEventListener('click', function () {
    var t = document.getElementById('json');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t.value).then(function () { avisar('Copiado'); }, function () { copiarViejo(t); });
    } else copiarViejo(t);
  });
  document.getElementById('reiniciar').addEventListener('click', function () {
    elegidas = Object.assign({}, RECOMENDADAS); guardar(elegidas); pintar();
  });
  pintar();
</script>
</body>
</html>
'''


def main():
    paso = sys.argv[1] if len(sys.argv) > 1 else 'todo'
    cfg = voz.leer_voces()
    if paso in ('todo', 'referencias'):
        referencias(cfg)
        cfg = voz.leer_voces()
    if paso in ('todo', 'frases'):
        frases(cfg)
    if paso in ('todo', 'calendario'):
        calendario(voz.leer_voces())
    if paso in ('todo', 'pagina', 'frases', 'calendario'):
        pagina(voz.leer_voces())


if __name__ == '__main__':
    main()
