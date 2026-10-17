# F03 · Perdí por uno

El último movimiento de una partida real de mi bot: la jugada que se queda a 1 (con la carcajada del villano y su
voz), la pausa «¿Qué jugada harías TÚ?», el rebobinado y la jugada que gana. Videos del calendario: D02-2 (el primero,
hecho con esta plantilla), D08-2, D20-2 y D29-2.

| Archivo | Qué hace |
|---|---|
| `generar.cjs` | Lee la ficha (nivel, semilla, política, `pierde.indice`, `gana_indice`), corre `plan.cjs casi`, comprueba con el motor lo que dice la ficha (perdedora a 1, ganadora, cuántas jugadas de TODO el tablero ganan, prefijo, cifras) y escribe `tools/video/videos/<id>/casi.json`: las dos jugadas, las metas tras cada cascada, lo que quedó sin hacer (para el anillo), el texto «¡FALTÓ UN HIELO!», «La ÚNICA que ganaba» o «Había N que ganaban», los villanos y el CTA. Con `--guion` y `--montaje` deja los borradores; con `--texto`, el post. |
| `tomas/casi.cjs` | Toma de una jugada: `--var <nivel>:<semilla>:<politica>:<pierde\|gana>:<indice>`. Rehace la partida sin grabar, comprueba que el tablero de la página es el del motor con 1 movimiento, esconde la burbuja del villano y graba 1,5 s de tablero vivo (30 fps), la jugada con el dedo del tutorial (60 fps) y la pantalla final. Falla si el juego no da lo mismo que el motor. |
| `plantilla.js` | El montaje (`window.F03({...})`). Todos los tiempos salen de los sonidos de las tomas y de las voces. |

## Hacer un video del formato

```bash
ID=D08-2
node tools/video/formatos/F03/generar.cjs $ID --guion --montaje      # sale con 1 si algo no cuadra (--seco: solo mira)
# tomas: los dos comandos que imprime (uno a la vez, ~1,5 min y ~0,3 GB cada una)
node tools/video/capturar.cjs tools/video/formatos/F03/tomas/casi.cjs dist/cap/$ID-pierde --var 20:5:experto:pierde:1
node tools/video/capturar.cjs tools/video/formatos/F03/tomas/casi.cjs dist/cap/$ID-gana --var 20:5:experto:gana:0
# voces (revisa guion.json: textos de js/story.js, emoción «carcajada»)
python3 tools/video/voz/voz.py tools/video/videos/$ID/guion.json --revisar --salida dist/estudio/voz/$ID > dist/estudio/voz/$ID.json
# render, revisión y post
node tools/video/grabar.cjs "tools/video/montaje.html?m=videos/$ID/montaje.js" dist/videos-mes/$ID-<slug>.mp4 --cap dist/cap --volumen ganancia --revisar --fotos 0,3.6
node tools/video/revisar.cjs dist/videos-mes/$ID-<slug>.mp4 --breve --dir dist/estudio/revision/$ID
~/.local/share/cocardo-estudio/voz-whisper/bin/python tools/video/voz/revisar_voz.py dist/videos-mes/$ID-<slug>.mp4 --guion dist/estudio/voz/$ID.json
node tools/video/formatos/F03/generar.cjs $ID --texto > dist/videos-mes/$ID-<slug>.txt
```

Notas por ficha: D08-2 trae `burlas` de Cocardo y Cherry (dos huecos «burla»: cada retrato sale por un lado). D20-2 no
fija la perdedora: `generar.cjs` toma la que se queda a 1 con más piezas (pierde[9], 3 cascadas). D29-2 enseña la
perdedora del combo (pierde[1]) y una ganadora sencilla (gana[1]); la pastilla ya sale «Había 3 que ganaban» (del
motor) y el `cierre` puede decir «…y ninguna era el combo» (nunca «la única»: `generar.cjs` lo vigila en la ficha). Si la gente pide otro nivel (`alimentado_por`):
`node tools/video/plan.cjs casi <nivel>` y `generar.cjs $ID --nivel N --semilla S --politica P`.

## Guion (`guion.json`, lote de `voz.py`)

Cada línea lleva `hueco` (si no, es «burla»):

| hueco | Cuándo suena | Subtítulo |
|---|---|---|
| `gancho` | Desde 0,1 s, sobre el último movimiento | no |
| `burla` | Tras la derrota, en orden, con el retrato de quien habla (emoción = ánimo del retrato; «carcajada» si no es uno de los 12) y la risa del juego de ese villano | sí |
| `pausa` | En la pausa (la alarga si hace falta; mejor ≤ 1 s) | no (la pregunta va en grande) |
| `gana` | 0,55 s tras la victoria | sí |
| `cierre` | Tras `gana` | sí |

## Parámetros de `window.F03({...})`

Obligatorios: `datos` (casi.json), `guion` (JSON de voz.py) y `gancho: ['línea 1', 'línea 2']` (la 1.ª en crema, la 2.ª
en dorado; las dos se leen en el cuadro 0).

| Parámetro | Para qué | Por defecto |
|---|---|---|
| `falto` | Texto de la derrota | el de casi.json («¡FALTÓ UN HIELO!») |
| `pregunta` / `laVes` | La pausa y el tablero quieto tras el rebobinado | «¿Qué jugada harías TÚ?» / «¿La ves? 👀» |
| `frase` | Pastilla verde al arrancar la ganadora | «La ÚNICA que ganaba» o «Había N que ganaban» (del motor) |
| `cierre` | `['pregunta', 'sub']` tras ganar | `['¿La viste antes que yo?', 'comenta 👇']` |
| `serie`, `ultimo` | Pastilla de arriba del gancho («PERDÍ POR UNO #2») y la de «ÚLTIMO MOVIMIENTO» | sin serie |
| `contadorPierde` | Contador de cascadas también en la perdedora (sube de nuevo en la ganadora) | sí si hace 3 o más |
| `velPierde`, `velGana`, `lentoVel`, `lentoAntes`, `lentoDespues` | Velocidades: perdedora tras el cambio, ganadora a media cascada y cámara lenta alrededor de la victoria | 1,35 · 1,6 · 0,45 · 0,4 · 0,2 |
| `congela` | s de la toma tras la derrota en que se congela el cuadro (la burla va sobre él) | 0,75 («¡Sin movimientos!» y «Te falta 1» del juego ya salieron) |
| `pausa`, `rebobinado`, `rebobinadoVel`, `respira` | Pausa, tope del rebobinado (s), velocidad mínima y tablero quieto antes del dedo | 0,8 · 1,1 · 3 · 0,4 |
| `zoomFalta`, `zoomLento` | Acercamiento a lo que faltó y en la cámara lenta | 1,1 · 1,12 |
| `climaxMax` | La victoria cae antes de esta fracción del video (si no, la cola sigue en la pantalla de victoria) | 0,77 |
| `retratoTam`, `retratoY`, `moodFinal` | Retrato de la burla y el del villano al final (`false` lo quita) | 400 · 445 · «llorando» |
| `metaX`, `metaY`, `metaSize`, `selloX`, `selloY`, `subY`, `confetiY` | Posiciones | — |
| `musicaTipo` / `musicaArchivo`, `victoria`, `musicaGain`, `victoriaGain`, `ducking` | Música (de `elegidas.json`): drama hasta la victoria y el golpe de victoria encima | drama + victoria |
| `tarjeta` | `{ cta, sub, pie, moodCocardo, moodCherry, dur }` | EMPIEZA/JUEGA GRATIS según el nivel · 1 s |

## Lista de dopamina (ya viene de serie)

1. **Gancho:** cuadro 0 = último movimiento con el dedo del bot sobre la pieza, «1 MOVS» con anillo rojo, fondo que
   late en rojo con latido y el gancho entero; la jugada sale a los 0,25 s.
2. **Ritmo:** derrota en ~2,8 s (×1,35 tras el cambio), metas que se tachan, contador, «¡FALTÓ…!», ✗, anillo, retrato
   con golpes de zoom y voz, rayón + pausa con latido, rebobinado VHS, flecha + dedo, especiales con empujón de cámara.
3. **Recompensa:** contador dorado → rosa → rojo, pops propios pasada la cascada 10, temblor creciente, «Fresa ✔»,
   cámara lenta solo en el golpe final, ✔, destello suave, confeti y golpe de victoria sobre el drama.
4. **Tensión y alivio:** casi-pérdida, carcajada, pregunta; la victoria cae antes del 77 % (el D02-2, al 77 %).
5. **Ganas de jugar:** «¿Qué jugada harías TÚ?», el tablero quieto con la flecha de la jugada y el dedo del tutorial,
   «¿La viste antes que yo? comenta 👇» y la tarjeta JUEGA/EMPIEZA GRATIS · link en el perfil · cocardo.app.
6. **Bucle:** tarjeta de 1 s cuyos últimos 0,2 s suben y dejan el cuadro 0 tal cual (mismo fotograma, dedo y gancho).

## Límites

- Lo que dicen `falto`, `frase` y `cierre` tiene que ser verdad para esas tomas: míralo en lo que imprime
  `generar.cjs` (cascadas, piezas, qué falta, cuántas ganan) y en la hoja de contacto.
- Si una burla tapa algo del tablero, mueve el retrato con `retratoY` o cambia `congela` (con 0 se congela antes de que
  salga «¡Sin movimientos!»).
- La plantilla no edita el kit: lo que haga falta del kit se rodea aquí.
