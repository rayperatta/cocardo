# F02 · Acertijo #N: ¿A, B o C?

El último movimiento de una partida real: tablero congelado con tres opciones marcadas, cuenta de 3 s con voz, las dos
que fallan (✗ y rebobinado) y la ganadora (cámara lenta solo en su golpe, ✔, confeti). Videos del calendario: D01-3
(el primero, hecho con esta plantilla), D07-3, D14-3, D16-3, D25-2 y D28-3.

| Archivo | Qué hace |
|---|---|
| `generar.cjs` | Lee la ficha (nivel, semilla, política) o un tablero fijo, elige la ganadora y dos que se quedan a 1, lo comprueba con el motor (cuántas jugadas de todo el tablero ganan: «la única» o «de estas tres») y escribe `tools/video/videos/<id>/acertijo.json`. |
| `tomas/acertijo.cjs` | Toma de una opción: `--var tools/video/videos/<id>/acertijo.json:A`. Rehace la partida del bot dentro de la página (o el tablero fijo), juega la opción y falla si el juego no da lo mismo que el motor. |
| `plantilla.js` | El montaje. Calcula todos los tiempos a partir de las voces y de los sonidos de las tomas. |

## Hacer un video del formato

```bash
ID=D07-3
# 1) datos (sale con 1 si algo no cuadra; --seco solo comprueba; --respuesta B para cambiar la letra ganadora)
node tools/video/formatos/F02/generar.cjs $ID --guion
# 2) tomas: los 3 comandos que imprime (uno a la vez), p. ej.
node tools/video/capturar.cjs tools/video/formatos/F02/tomas/acertijo.cjs dist/cap/$ID-A --var tools/video/videos/$ID/acertijo.json:A
# 3) voces: completa tools/video/videos/$ID/guion.json (ver «Guion») y genera
python3 tools/video/voz/voz.py tools/video/videos/$ID/guion.json --revisar --salida dist/estudio/voz/$ID > dist/estudio/voz/$ID.json
# 4) montaje: copia tools/video/videos/D01-3/montaje.js y cambia los parámetros; render y revisión
node tools/video/grabar.cjs "tools/video/montaje.html?m=videos/$ID/montaje.js" dist/videos-mes/$ID-acertijo-N.mp4 --cap dist/cap --volumen ganancia --fotos 0
node tools/video/revisar.cjs dist/videos-mes/$ID-acertijo-N.mp4 --breve --dir dist/estudio/revision/$ID
~/.local/share/cocardo-estudio/voz-whisper/bin/python tools/video/voz/revisar_voz.py dist/videos-mes/$ID-acertijo-N.mp4 --guion dist/estudio/voz/$ID.json
```

## Guion (`guion.json`, lote de `voz.py`)

Cada línea lleva `hueco`, que dice dónde va. La plantilla la coloca sola:

| hueco | Cuándo suena | Subtítulo |
|---|---|---|
| `gancho`, `pide`, `apuesta` | Desde 0,15 s, sobre el tablero congelado (la víctima pide ayuda, el villano apuesta) | sí, en la franja del tablero sin opciones |
| `cuenta3`, `cuenta2`, `cuenta1` | Con cada número de la cuenta («Tres.», «Dos.», «Uno.») | no (el número va gigante) |
| `falla` | Tras el ✗ de cada opción que falla, en orden (la risa o burla del villano) | sí |
| `gana` | 0,45 s después de la victoria (la víctima libre, el villano furioso) | sí, abajo |
| `cierre` | Tras `gana`: «¿Acertaste? Comenta tu letra aquí abajo.» | no («¿Acertaste?» en grande) |

Líneas cortas, de `js/story.js` (vale un fragmento; con `escena`) o marcadas `nueva`. Revisa que cada una pase
(WER ≤ 0,15 y ritmo): «¿Acertaste? Comenta tu letra.» no pasa el ritmo (la pausa tras la pregunta); la versión de
arriba sí. La voz del narrador es Qwen: la emoción no le cambia nada, hay que cambiar la redacción.

## Parámetros de `window.F02({...})`

Obligatorios: `datos` (ruta del acertijo.json), `guion` (JSON de voz.py), `gancho: ['texto de arriba', '¿A, B o C?']`.

| Parámetro | Para qué | Por defecto |
|---|---|---|
| `tomas` | `{ A, B, C }` carpetas de `dist/cap/` si no son `<id>-A…` | las de acertijo.json |
| `serie` | Pastilla de arriba del gancho («ACERTIJO #2 · NIVEL 13») | sin pastilla |
| `textos` | Por letra, lista de `{ evento, texto, palabras?, size?, color?, retraso? }`; `evento` es un sonido de la toma (`special`, `freezerHit`, `paleta`, `bomba`, `rescue`, `match`…) o `lose`/`win`/`inicio` | las que fallan: «¡Le faltó UNO!» |
| `lento` | Sonido de la ganadora que va en cámara lenta (`paleta`, `bomba`, `rescue`…); `lentoDur`, `lentoVel` | la victoria; 0,45 s a 0,33× |
| `zoom` | `{ x, y, z }` (px de la toma) a donde se acerca la cámara en la cámara lenta | centro, 1,08 |
| `focoPalabra` | `{ congelador: 'congelador', victima: '…' }`: el anillo de ese foco sale cuando la voz dice la palabra | anillo a 0,35 s |
| `contadorMin` | Piezas desde las que sale el contador «N piezas» de la ganadora (sube con cada cascada) | 12 |
| `cta` | Texto del botón de la tarjeta | «JUEGA GRATIS» en niveles 1-10, si no «EMPIEZA GRATIS» |
| `musicaTipo` / `musicaArchivo`, `victoria` | Música (de `elegidas.json`) y golpe de victoria encima | drama + victoria |
| `t0`, `pasoCuenta`, `rebobinado`, `tarjeta` | Primer audio, segundos por número, rebobinado y tarjeta | 0,15 · 0,75 · 0,35 · 1,0 |
| `tapa` | Región de la burbuja del villano en el HUD que se tapa (la burla de inicio es al azar y alguna está vetada); `false` la deja | la burbuja de arriba a la izquierda |
| `lado` | `{ C: 'der' }` para mover una letra si tapa algo | izquierda (vertical) o arriba (horizontal) |

## Lista de dopamina (ya viene de serie)

- **Gancho:** cuadro 0 con el tablero, las tres letras y sus flechas, el anillo en la víctima y el reto en grande;
  golpe de congelador en el segundo 0 y la voz desde 0,15 s.
- **Ritmo:** las letras rebotan con pops que suben de tono (0,55 / 0,8 / 1,05 s), anillo con crujido al nombrar el
  foco, cuenta con número gigante, tic, latido, voz y golpe de cámara; cada opción entra con golpe de zoom y whoosh y
  sale con rebobinado VHS.
- **Recompensa:** ✗ con golpe en las que fallan; en la ganadora, temblor en sus golpes, cámara lenta con zoom solo en
  el golpe decisivo, destello suave, ✔, confeti, contador de piezas y el golpe de victoria encima del drama.
- **Tensión y alivio:** la cuenta atrás y dos casi-victorias antes de la buena; el clímax cae hacia el 70 %.
- **Ganas de jugar:** el dedo del tutorial hace cada jugada, «comenta tu letra 👇» y tarjeta JUEGA/EMPIEZA GRATIS.
- **Bucle:** tarjeta de 1 s y corte al cuadro 0 (el tablero con las letras).

## Límites

- `generar.cjs` toma la ganadora de la ficha (`gana_indice` o `gana.a/b`) o la que más piezas rompe, y como
  perdedoras dos que se quedan a 1 lejos de la ganadora. Si una flecha tapa algo, cambia con `--perdedoras i,j`.
- Lo que dice cada texto en pantalla lo escribes tú (`textos`): que sea verdad para esa toma (míralo en la hoja de
  contacto y en las cifras que imprime `generar.cjs`).
- La plantilla no edita el kit: si hace falta algo del kit, rodéalo aquí y apúntalo.
