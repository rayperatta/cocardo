# F07 · Telenovela (plantilla)

Episodios con voces y CONTINUARÁ…, «Lo que no viste» y el tráiler. Primer video hecho con ella: D01-2
(`tools/video/videos/D01-2/montaje.js`, el tráiler). Un video nuevo se hace cambiando solo parámetros.

| Archivo | Para qué |
|---|---|
| `plantilla.js` | `F07({ voz, tomas, musica, gancho, planos })`: arma la línea de tiempo (cada plano dura sus compases, sus segundos o lo que tarde su voz, siempre al golpe de la música), voces con subtítulos, textos pop, contador, eventos del juego con temblor y confeti, CONTINUARÁ…, tarjeta de 1 s y bucle. API completa en su encabezado. |
| `guion.cjs` | `node tools/video/formatos/F07/guion.cjs <id> [--rama N] [--montaje]`: escribe `videos/<id>/guion.json` (las `parametros.lineas` de la ficha: el lote de `voz.py`), lista las tomas que faltan y los comandos; con `--montaje`, el esqueleto de `montaje.js` con un plano por línea y el segundo exacto de cada línea en su toma `hist-<escena>`. |
| `ritmo.py` | `python3 tools/video/formatos/F07/ritmo.py tema\|drama`: tempo y `desde` (primer golpe del cuerpo de la pista) para `musica.bpm` y `musica.desde`. Hoy: tema 103,3 BPM desde 4,9517; drama 90 BPM desde 6,63. |
| `fotos.cjs` | Vista rápida sin grabar: dibuja los segundos pedidos, hace una tira y, con `--wav`, deja la mezcla. Imprime la línea de tiempo (planos y voces). |

## Un video nuevo (episodio o «Lo que no viste»)

1. `node tools/video/formatos/F07/guion.cjs D03-3 --montaje` (si es condicional, mira antes `plan.condiciones` y usa `--rama`).
2. Captura las tomas que lista (`hist-<escena>` con `tools/video/tomas/historia.cjs`, el nivel con `nivel.cjs`), en
   `dist/cap/<id>-…` si no existen ya. Busca el tramo de juego con `tools/video/plan.cjs`.
3. Voces: `python3 tools/video/voz/voz.py tools/video/videos/<id>/guion.json --revisar --salida dist/estudio/voz/<id> > dist/estudio/voz/<id>.json`.
4. Ajusta el esqueleto con `fotos.cjs`: cámaras (los retratos quedan arriba del cuadro tapado con `historia: true`),
   el tramo de juego (`tramos`, `contador`, `textos` con `en: { evento: 'rescue' }`, `efectos`), el clímax antes del 80 %.
5. Render con `grabar.cjs … --volumen ganancia --revisar --fotos …`, `revisar.cjs` y `revisar_voz.py` (WER ≤ 0,2).

## Lo que trae de serie (lista de dopamina)

- Cuadro 0: el gancho ya escrito (sin pop) sobre la acción, con la placa «Ep. N» (`rotulo`). Nada de negro ni logos.
- Un estímulo por golpe: whoosh en cada corte, pulso de cámara en cada compás, textos pop con un «pop» que sube de tono.
- Escalada: contador que sube con los eventos del juego, textos en los rescates, temblor, confeti y un solo destello suave.
- Voces cortas con la música agachada (ducking del kit) y sin los «blip» del cuadro de diálogo.
- Tarjeta final de 1 s (`EMPIEZA GRATIS`; `JUEGA GRATIS` solo en niveles 1-10) y bucle: la música de la tarjeta es la
  que va justo antes del cuadro 0, así al repetirse no salta.

## Cuidado

- Las tomas de historia que siguen hasta el mapa (cliff15 desde 21,9 s) enseñan el capítulo 7 y su fecha: corta antes.
  El mapa de `portada` lleva `tapa` sobre el aviso de abajo y una cámara que lo deja fuera.
- La portada del juego trae un pie con texto que no va en los videos: encuadre con z ≥ 1,12 y y ≤ 830.
- Escenas con voz: `historia: true` (tapa el cuadro); sin voz, `tapa: false` deja leer el cuadro del juego.
- «Anteriormente» (resumen) se arma con los mismos planos y tomas de los episodios y solo la voz del narrador: el kit
  no lee MP4 como toma.
