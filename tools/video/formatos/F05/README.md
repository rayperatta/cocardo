# F05 · Reto de hoy #N

El tablero del Reto Diario de ese día (el mismo para todos) y la fila de emojis de mi bot honesto, que no ve las frutas
que van a caer; después, la del bot que sí las ve («se puede con N»). **Nunca se enseña una jugada**: el relleno es
determinista y se podría copiar. Videos del calendario: D02-1 (el primero, hecho con esta plantilla), D05-1, D06-1,
D12-1 (noticiero, condicional), D14-2, D21-2 y D28-2 (salón, condicionales: sin ranking salen como «la semana de mi
bot»), D15-1, D22-1, D26-1 (noticiero condicional; si no, Reto normal) y D30-1.

| Archivo | Qué hace |
|---|---|
| `generar.cjs` | Lee la ficha (o su rama con `--rama N`), juega el Reto de ese día con el bot honesto y con el que ve el relleno (el mismo bot que `validar.cjs`), y en el salón los 7 Retos de la semana. Sale con 1 si una cifra no cuadra con la ficha (un lunes pudo cambiar un nivel). Escribe `tools/video/videos/<id>/reto.json` (solo emojis y resultados, nunca casillas) y, con `--guion`, el borrador de `guion.json`. |
| `tomas/reto.cjs` | Toma del tablero: `--var AAAAMMDD[:segundos]`. Abre el Reto en **práctica** con el nivel y la semilla de `daily.js`, sin tocar ninguna ficha (ningún puntaje llega a `daily/{día}/scores`), graba la caída de las piezas y el tablero quieto, esconde la burbuja del villano, no deja salir la pista y falla si el tablero de la página no es el del motor. |
| `plantilla.js` | El montaje (`window.F05({...})`). Calcula los tiempos con las voces y la fila de emojis. |
| `ejemplos/` | Vistas de las otras ediciones con datos de prueba (`noticiero.js`, `semana.js`, `largo.js`: 24 emojis y el bot perdiendo). |

## Hacer un video del formato

```bash
ID=D05-1
# 1) datos (con --rama N en los condicionales; --seco solo comprueba)
node tools/video/formatos/F05/generar.cjs $ID --guion
# 2) toma del tablero (el comando exacto lo imprime generar.cjs)
node tools/video/capturar.cjs tools/video/formatos/F05/tomas/reto.cjs dist/cap/$ID-tablero --var 20261023:9 --fps 30
# 3) voces: revisa tools/video/videos/$ID/guion.json (huecos abajo) y genera
python3 tools/video/voz/voz.py tools/video/videos/$ID/guion.json --revisar --salida dist/estudio/voz/$ID > dist/estudio/voz/$ID.json
# 4) montaje: copia tools/video/videos/D02-1/montaje.js y cambia datos, guion, toma, gancho y reto
node tools/video/formatos/F07/fotos.cjs "tools/video/montaje.html?m=videos/$ID/montaje.js" /tmp/vista 0,1,4,7,9   # vista rápida
node tools/video/grabar.cjs "tools/video/montaje.html?m=videos/$ID/montaje.js" dist/videos-mes/$ID-reto-23.mp4 --cap dist/cap --volumen ganancia --fotos 0.4
node tools/video/revisar.cjs dist/videos-mes/$ID-reto-23.mp4 --breve --dir dist/estudio/revision/$ID
~/.local/share/cocardo-estudio/voz-whisper/bin/python tools/video/voz/revisar_voz.py dist/videos-mes/$ID-reto-23.mp4 --guion dist/estudio/voz/$ID.json
```

Se rinde como mucho 2 días antes (`validar.cjs` avisa si un lunes cambió un nivel del 6 al 25 y con él el Reto).

## Guion (`guion.json`, lote de `voz.py`)

Cada línea lleva `hueco`; la plantilla la coloca sola y le pone el subtítulo del kit:

| hueco | Cuándo suena | Subtítulo |
|---|---|---|
| `gancho` | Desde 0,15 s, sobre el tablero | abajo |
| `burla` | Termina justo cuando cae el último emoji (la cuenta atrás) | abajo |
| `reaccion` | 0,35 s después del sello GANÓ/PERDIÓ (el villano llora o se ríe) | **arriba** (abajo entra el otro bot) |
| `noticia` | Noticiero: encadenadas desde 0,15 s sobre la placa | abajo |
| `presenta` | Semana/salón: encadenadas desde 0,15 s | abajo |
| `cierre` | En el reto final («tu turno») | abajo |

La línea de la ficha (`parametros.linea`) va tal cual; si el calendario trae `parametros.lineas`, esas. Vale sumar una
línea real de `js/story.js` (las burlas `win`/`lose`/`low` de `taunts`) con `escena`. Frases vetadas: las de
`docs/videos/CALENDARIO-VIDEOS.md` §6 (por ejemplo, «Es orgánico» no va ni en voz ni en pantalla: D15-1 lleva
`sin_rotulo_del_nivel`, y la banda de arriba ya tapa el rótulo del HUD). Revisa que cada línea pase (WER ≤ 0,15).

## Parámetros de `window.F05({...})`

Obligatorio: `datos` (ruta del reto.json). Lo demás tiene valor por defecto.

| Parámetro | Para qué | Por defecto |
|---|---|---|
| `guion`, `toma` | JSON de voz.py y carpeta de `dist/cap/` | sin voces · `<id>-tablero` |
| `gancho` | `['RETO DIARIO #N', '¿pregunta?']`: pastilla y texto grande del cuadro 0 (las palabras en MAYÚSCULAS salen en dorado) | sale del `gancho` de la ficha |
| `reto` | `['¿pregunta?', 'Pega tu fila']` del final | la del gancho y «Pega tu fila» |
| `edicion` | `normal`, `noticiero`, `semana` o `salon` | la de reto.json (`salon` sin `apodos` → `semana`) |
| `paso` | Segundos entre emojis | 0,3 (filas largas: la cuenta dura ~5,2 s; noticiero 0,18) |
| `sello`, `selloSub` | Texto del sello y su segunda línea | «¡GANÓ!»/«PERDIÓ» · «con UNO de sobra», «pero se puede»… |
| `vidente: false` | Sin el panel del otro bot (si sacó lo mismo) | con panel |
| `sePuedeTexto` | Golpe final del otro bot | «¡SE PUEDE CON N DE SOBRA!», «¡LO GANÓ EN EL ÚLTIMO!» o «NI ÉL PUDO» |
| `botNombre`, `botSub`, `videnteNombre` | Rótulos de los paneles | «MI BOT», «no ve las frutas que caen», «EL QUE SÍ VE LAS FRUTAS QUE CAEN» |
| `chip` | Pastilla bajo el gancho | «EL MISMO TABLERO PARA TODOS HOY» |
| `tuTurno` | Texto del final | «¡TU TURNO!» |
| `titular`, `titularEn`, `placa`, `cintillo`, `presentadora` | Noticiero: titular que golpea, su hora, placa, cintillo y retrato | sin titular · tras la última noticia · «NOTICIERO DE COCO'S SCOOPS» · Reto, movimientos y resultado · `reportera` |
| `pregunta`, `semanaGancho`, `semanaTitulo`, `apodos`, `itemPaso`, `pega` | Semana/salón: pregunta tras los sellos, gancho del cuadro 0, rótulo, `[{ apodo, texto }]` (solo apodos públicos de quien pidió salir) | — · el gancho de la ficha · «LA SEMANA DE MI BOT» |
| `musicaTipo`, `victoria`, `musica: false` | Música de `elegidas.json` (el tema desde el inicio de su bucle) y el golpe de victoria encima del sello | tema + victoria |
| `cta`, `sub`, `pie`, `tarjeta` | Tarjeta final | «JUEGA GRATIS» (el Reto es gratis) · «link en el perfil» · «cocardo.app» · 0,9 s |

## Lista de dopamina (ya viene de serie)

- **Gancho:** cuadro 0 con el tablero del día, «RETO DIARIO #N» y la pregunta en grande (cifra en dorado); golpe y tic en
  el segundo 0, la pastilla «el mismo tablero para todos hoy» entra a los 0,3 s con latido del texto.
- **Ritmo:** la tarjeta entra con whoosh a los 0,7 s y los emojis caen cada 0,3 s, cada uno con su pop.
- **Recompensa:** los pops suben de tono (la cascada del juego de 1 a 10 y un pop que sube una octava), 🟨 con crujido
  de hielo, 🟧 🟥 🍦 con chispas, temblor y su sonido (especial, bomba, combo); sello con golpe, destello suave único,
  confeti y el golpe de victoria encima del tema; la fila del otro bot en ráfaga y sus estrellas.
- **Tensión y alivio:** el contador «QUEDAN» baja con cada emoji, se pone rojo y late en los 3 últimos; la burla del
  villano termina cuando cae el último; si perdió, carcajada y el alivio de «se puede». Clímax hacia el 60 %.
- **Ganas de jugar:** «el mismo tablero para todos hoy», «¡TU TURNO!» con las piezas del Reto cayendo otra vez,
  «Pega tu fila 👇» y la tarjeta JUEGA GRATIS · link en el perfil · cocardo.app. Nunca una jugada.
- **Bucle:** el final vuelve al tablero completo con la misma pregunta del cuadro 0; tarjeta de 0,9 s y corte al cuadro 0.

## Límites

- La toma no está en `tools/video/datos/tomas.cjs` (ese catálogo solo sabe de `tools/video/tomas/`): el comando de cada
  una lo imprime `generar.cjs`.
- El salón con apodos (`salon` + `apodos`) se armó sin datos reales del ranking: revísalo con la vista rápida cuando haya
  apodos. Sin apodos sale «la semana de mi bot».
- El noticiero dibuja la placa con el retrato de la reportera; si su voz no pasa, presenta el narrador (cambia `quien`
  en el guion; la placa sigue igual).
