# Videos para TikTok e Instagram (plan vivo)

Ideas de videos cortos del juego que Claude produce de principio a fin (captura, sonido, textos, MP4 final). La persona
dueña de la cuenta solo los publica. Se apoya en `docs/PERSONAJES.md` (aspecto y nombres) y en
`docs/investigacion/biblia.json` (frases, cronología y contexto de la serie).

## 0. Reglas que no se rompen

- **Nunca "oficial".** Muchas cuentas copia dicen ser la oficial; nosotros somos un juego de fans y lo decimos en el texto
  del post: «Juego de fans, no oficial. Inspirado en La Nieve de Lima». Nada de «Parte 14» ni de hacerse pasar por la
  creadora.
- **Ángulo de rescate, no de "comerse a las frutas".** La cuenta original cayó entre denuncias por «canibalismo» y hay
  avisos sobre niños y frutinovelas. En los videos se **descongela y rescata**; Cocardo y Cherry son villanos cómicos.
  Nada de raspar víctimas, sangre ni sustos.
- **Cero bulos.** Nada de «Cocardo murió», funerales falsos ni datos inventados. Cada cifra que salga en pantalla viene
  de nuestras simulaciones con el motor.
- **Arte y sonido 100 % nuestros.** Ni fotogramas ni audio de la serie. Personajes en el SVG del juego y sonidos de
  `js/audio.js`.
- **Nombres canónicos:** Cocardo, Lima, Cherry, Don Piña, Banano (el hermano investigador), Banana, Fresa, Durazna, Uva,
  Naranja.

## 1. Formato técnico

- MP4 vertical **1080×1920**, 30 fps, H.264 + AAC, sin marca de agua (Reels castiga la de TikTok), así que el mismo
  archivo sirve para las dos redes.
- **Gancho en el primer segundo** con texto grande. Nada de logos ni intros.
- Duración de 7 a 20 s casi siempre; los finales **enlazan con el inicio** para que el video se vea en bucle.
- Texto fuera de las zonas que tapa la interfaz: el 25 % de abajo y la franja derecha (unos 160 px).
- Subtítulos quemados en español latino (mucha gente ve sin sonido).
- Hashtags base: `#cocardo #frutinovela #lanievedelima #cocardoylanievedelima #cocosscoops #match3 #juegosindie`.

## 2. Cómo se fabrican (`tools/video/`)

Ya existe:

- `tools/video/grabar.cjs`: graba una escena a MP4 1080×1920 30 fps. Dibuja cada fotograma con reloj fijo, sintetiza el
  audio, lo normaliza (-14 LUFS, pico -2 dBFS) y codifica H.264 + AAC. Uso:
  `node tools/video/grabar.cjs tools/video/sonidos.html dist/videos/01-sonidos.mp4 [--fotos 0,5.5]`
  (`--fotos` guarda PNG de esos segundos para revisar o para la portada; `dist/` no se sube al repo).
- `tools/video/video.js`: utilidades de las escenas (colores de marca, texto tipo sticker, toldo, osciloscopio, barras,
  render y mezcla de audio, WAV).
- Una escena es un `.html` en `tools/video/` que define `window.Escena = { duracion, fps, preparar(), dibujar(t) }`.

Falta construir:

1. **Buscador de jugadas** (Node + `js/core/engine.js`): prueba miles de semillas y jugadas y guarda las mejores
   (cascadas largas, combos, casi-derrotas, finales con muchos movimientos sobrantes).
2. **Grabador** (Playwright + Chromium): abre el juego con semilla y jugadas fijas, controla el reloj de la página
   (`page.clock` o `requestAnimationFrame` sustituido) y captura cada fotograma del canvas. Como el motor es
   determinista, el video sale idéntico cada vez.
3. **Banda sonora sin grabar nada:** `Cocardo.Audio._render([[nombre, opts, segundo], …])` y `_renderMusic()` generan
   el WAV exacto a partir de la lista de eventos del motor, sincronizado al fotograma.
4. **Montaje** con `ffmpeg`: textos, zooms y tarjeta de «CONTINUARÁ...». De cada video salen 2 o 3 variantes de gancho
   para probar cuál funciona mejor.

**Límites:** no hay voz en off (no hay síntesis de voz en el entorno; la voz de texto a voz de TikTok o una voz humana
se agregan al subir). La música de moda con licencia también se agrega en la app al subir. Las métricas solo las puedo
ver si me las pasan.

### Prueba de concepto (14 oct 2026)

Con el motor actual, en 1.500 tableros 7×7 de 4 colores (como el nivel 1) se probaron 29.598 jugadas de apertura:

| Cascadas | Jugadas |
|---|---|
| 6 o más (sale «¡¡TELENOVELA!!») | 1.640 (≈ 1 de cada 18) |
| 10 o más | 123 (≈ 1 de cada 240) |
| 18 (la mejor) | 1 |

La mejor: **semilla 347, cambiar r2c2 ↔ r3c2**. Hace 18 cascadas, 128 piezas y 7 especiales. Con 5 y 6 colores el
máximo baja a 13 y 10. Hay que repetir la búsqueda cuando exista `js/core/levels.js`, porque el tablero depende de la
definición exacta del nivel.

## 3. Ideas

Estado: **Ya** = se puede hacer con lo que existe (motor y audio). **Arte** = necesita `js/art.js` y
`js/art-characters.js`. **Juego** = necesita el tablero jugable completo (`render.js`, `fx.js`, `game.js`).

### A. Satisfactorios (la base de cualquier match-3 viral)

| # | Idea | Gancho (primer segundo) | Qué se ve | Estado |
|---|---|---|---|---|
| A1 | **La jugada de 18 cascadas** | «La mejor jugada entre 30.000» o «¿Cuántas cascadas hace? Comenta antes de que acabe» | La jugada de la semilla 347. Los «pops» suben de tono en cada cascada y los textos escalan de «¡Rico!» a «¡¡TELENOVELA!!». La cara de Cocardo pasa de burlón a nervioso, furioso y llorando. | Juego |
| A2 | **¡Helado Final!** | «Cuando te sobran 12 movimientos» | Cada movimiento sobrante se vuelve Paleta y explota en cadena; confeti. | Juego |
| A3 | **Copa + Copa** | «Así se descongela TODO» | El tablero entero se limpia de golpe; hielo y congelador crujen. Es la jugada más rara y espectacular. | Juego |

### B. Telenovela (el formato que hizo viral a la serie)

| # | Idea | Gancho | Qué se ve | Estado |
|---|---|---|---|---|
| B1 | **«Si La Nieve de Lima fuera un videojuego»** | Acorde «tan-tan-TAAAN» con el letrero de Coco's Scoops | Tráiler de 20 s: Cocardo, el congelador viejo, Lima atrapada, jugada espectacular y rescate. Cierra con tres zooms a la cara de Cherry y «CONTINUARÁ...». | Arte (versión fija), Juego (con jugadas) |
| B2 | **Capítulos del juego en serie** | «Capítulo 1: La heladería en quiebra (versión juego)» | Un video por capítulo: el nivel jefe jugado y la tarjeta de cliffhanger al final. Se publican en orden, como las 13 partes, para que la gente vuelva al siguiente. | Juego |
| B3 | **Zoom dramático (meme)** | Situación del juego + tres zooms y «tan-tan-TAAAN» | Clips de 5 a 7 s: «Cuando sale la Copa Arcoíris en el último movimiento», «Cocardo al ver que rompiste su congelador». Baratos de hacer y se pueden sacar muchos. | Arte |

### C. Participación (los comentarios empujan el algoritmo)

| # | Idea | Gancho | Qué se ve | Estado |
|---|---|---|---|---|
| C1 | **¿Qué jugada rescata a Lima?** | «Solo 1 jugada la salva. ¿Cuál?» | Tablero congelado con opciones A, B y C, cuenta de 3 s y respuesta. El motor comprueba que solo una gana. Invita a comentar y a volver a verlo. Serie diaria. | Arte |
| C2 | **Ustedes deciden** | «¿A quién dibujo después?» | Encuestas en comentarios (personaje que se revela, nombre de un nivel, nueva burla de Cocardo) y respuesta en video al comentario ganador. | Ya (texto) / Arte |
| C3 | **Reto Diario** | «Reto #N: ¿me superas?» | El resultado en emojis (⬜🟨🟧🟥🍦) y la jugada clave. Es el efecto Wordle: la gente pega su resultado en comentarios. | Juego + `daily.js` |

### D. Así se hace (sirve ya, antes de que el juego esté listo)

| # | Idea | Gancho | Qué se ve | Estado |
|---|---|---|---|---|
| D1 | **Así suena Cocardo** | «Hice la risa de Cocardo sin grabar ni un sonido» | Forma de onda en vivo: el «ja-ja-ja» de Cocardo, el «ji-ji-ji» de Cherry, el golpe del congelador, el hielo crujiendo y el acorde de telenovela. Todo es síntesis de `js/audio.js`. | **Ya** |
| D2 | **Diario de desarrollo** | «Día 1 haciendo el juego de Cocardo» | Avances reales: pruebas del motor pasando, el primer tablero, el primer personaje en SVG. Formato serie («Día N»). | **Ya** |
| D3 | **Simulé miles de partidas** | «El nivel más difícil de Cocardo según 100.000 partidas» | Datos reales del bot (`tools/sim.js`): porcentaje de victorias por nivel y la jugada más rara. Curiosidad «nerd» que se comparte. | Ya (cascadas) / `levels.js` (niveles) |
| D4 | **El sonido propio** | — | Subir el «tan-tan-TAAAN» y el loop de cumbia como **audio original**: si otros lo usan en sus videos, cada uso lleva al nuestro. | Ya |

### E. Personajes

| # | Idea | Gancho | Qué se ve | Estado |
|---|---|---|---|---|
| E1 | **Así se ve Cherry en el juego** | «Le di vida a Cherry» | De la ficha de texto al retrato final, con parpadeo y cambios de humor. Uno por personaje (10 videos). | Arte |
| E2 | **¿Cuál es tu sabor?** | «Elige tu sabor y te digo quién eres» | Las 6 víctimas como fichas del tablero. Encuesta en comentarios. | Arte |
| E3 | **Cocardo viendo tu partida** | «Cocardo viendo cómo rescatas a Lima» | Solo la cara de Cocardo reaccionando a una partida: burlón, nervioso, furioso y llorando. Sirve como plantilla de meme. | Arte |

## 4. Orden recomendado

1. **Ahora:** D1, D2 y D4. Empezar a publicar ya, porque la serie fue tendencia a finales de septiembre y el interés
   baja; el spin-off de la creadora volvió a mencionar Coco's Scoops el 14 oct y mantiene vivo el tema.
2. **Con el arte:** E1 (uno por personaje), B3 y C1, más B1 en versión fija.
3. **Con el juego jugable:** A1 como video estrella, luego A2, A3, B2 (serie por capítulos) y C3 con el enlace para
   jugar en la bio.

Ritmo: 1 o 2 videos al día, el mismo archivo en TikTok y Reels. Repetir lo que funcione en variantes (otra semilla,
otro gancho) en vez de cambiar de idea.

## 5. Decisiones (14 oct 2026)

- **Plataforma:** el juego sale primero como página web HTML (gratis). Si le va bien, se publica en Play Store. Los
  videos invitan a jugar «gratis en la web» con el enlace en la bio.
- **Creadora:** por ahora no se menciona; el parecido con la serie se ve solo. Se mantiene «juego de fans, no
  oficial».
- **Edición:** Claude entrega cada video terminado (MP4 listo para subir, portada y texto del post). Quien publica no
  edita nada: sube el archivo y pega el texto. No hace falta agregar música de TikTok: el sonido propio es parte del
  video.
- **Pendiente:** ¿cuenta nueva solo para el juego o la personal?

## 6. Videos listos

Todos en 1080×1920, 30 fps, H.264 + AAC (≈ -14 LUFS; el ASMR queda en -17 por sus silencios), sin marca de agua. Los de juego usan el juego real grabado
fotograma a fotograma; ninguna jugada es falsa (las encuentra `tools/video/plan.cjs` con el mismo motor).

| # | Archivo | Gancho (primer segundo) | Dur. | Montaje |
|---|---|---|---|---|
| 1 | `01-asi-suena-cocardo.mp4` | «Así suena mi juego de Cocardo (sin grabar ni un sonido)» | 20 s | `sonidos.html` |
| 2 | `02-trailer.mp4` | «¿Cocardo… en VIDEOJUEGO?» sobre las 18 cascadas, luego tráiler de cine | 32 s | `trailer.js` |
| 3 | `03-mejor-jugada.mp4` | «Probé 472.206 jugadas… y esta fue la MEJOR» | 24 s | `cascada.js` |
| 4 | `04-acertijo-abc.mp4` | «Solo 1 jugada rescata a Lima. ¿A, B o C?» | 23 s | `acertijo.js` |
| 5 | `05-perdi-por-uno.mp4` | «Perdí por UN hielo… esto debí hacer» | 26 s | `casi.js` |
| 6 | `06-congelador.mp4` | «Le rompí el congelador a Cocardo en 8 jugadas» | 26 s | `congelador.js` |
| 7 | `07-personajes.mp4` | «Hice a TODOS los personajes de Cocardo para mi juego» | 25 s | `personajes.js` |
| 8 | `08-combos.mp4` | «Todos los combos de Cocardo, del PEOR al MEJOR» | 19 s | `combos.js` |
| 9 | `09-traicion-cherry.mp4` | «Cherry descubrió el secreto… y todo cambió» | 29 s | `cherry.js` |
| 10 | `10-ultimo-movimiento.mp4` | «NIVEL ⚠️ ¡DRAMA! quedan 4 movimientos» | 17 s | `clutch.js` |
| 11 | `11-rescate-6-de-6.mp4` | «Rescaté a TODAS: las 6 frutas congeladas» | 20 s | `rescates.js` |
| 12 | `12-asmr-hielo.mp4` | «ASMR 🧊 rompiendo hielo (sube el volumen)» | 16 s | `hielo.js` |
| 13 | `13-nivel-final.mp4` | «El NIVEL FINAL de mi juego de Cocardo» | 38 s | `final.js` |

### Textos para publicar (TikTok e Instagram)

Cada texto: frase gancho, pregunta para comentar, aviso de juego de fans y 5-6 etiquetas. Sin mencionar a la creadora.

1. **Sonidos.** Hice TODOS los sonidos de mi juego de Cocardo sin grabar nada: cada uno es puro código 🥥🍦 La risa de
   Cherry me da miedo… ¿qué sonido le falta? 👇 Juego de fans (no oficial), gratis en la web: link en el perfil.
   `#cocardo #frutinovela #lanievedelima #cocosscoops #juegosindie #gamedev`
2. **Tráiler.** La frutinovela… ¡ahora se juega! 🥥🍦 Cocardo: ¡Rescate Helado! — 30 niveles, 16 personajes y Cherry
   tramando algo. Gratis en la web, link en el perfil. ¿Lo jugarías? 👇 Juego de fans (no oficial).
   `#cocardo #frutinovela #lanievedelima #cocosscoops #juegosindie #videojuegos`
3. **Mejor jugada.** Probé 472.206 jugadas en mi juego de Cocardo y esta fue la mejor: 18 cascadas seguidas… y faltó UN
   hielo 😭 ¿Cuál es tu récord? 👇 Juego de fans (no oficial), gratis en la web.
   `#cocardo #frutinovela #satisfying #match3 #juegosindie #lanievedelima`
4. **Acertijo.** Último movimiento: solo UNA jugada rescata a Lima. ¿A, B o C? Comenta ANTES de ver la respuesta 👇
   Juego de fans (no oficial), gratis en la web.
   `#cocardo #frutinovela #acertijo #reto #match3 #lanievedelima`
5. **Perdí por uno.** Perdí por UN hielo 😭 y Cocardo se rió en mi cara. Rebobiné y esto es lo que debí hacer… ¿te ha
   pasado? 👇 Juego de fans (no oficial), gratis en la web.
   `#cocardo #frutinovela #casi #match3 #juegosindie #lanievedelima`
6. **Congelador.** «¡Mi congelador no! ¡Costó cuatro mil pesos!» 🥶 Le rompí el congelador viejo a Cocardo en 8
   jugadas y liberé a Lima. ¿A quién rescato después? 👇 Juego de fans (no oficial), gratis en la web.
   `#cocardo #frutinovela #lanievedelima #lima #match3 #juegosindie`
7. **Personajes.** Hice a los 16 personajes de Cocardo para mi juego 🥥🍒🍌 ¿Quién es tu favorito? 👇 Juego de fans (no
   oficial), gratis en la web.
   `#cocardo #frutinovela #lanievedelima #cherry #fanart #juegosindie`
8. **Combos.** Todos los combos de mi juego de Cocardo, del PEOR al MEJOR 🍦 El #1 se lleva TODO el tablero. ¿Cuál es
   tu favorito? 👇 Juego de fans (no oficial), gratis en la web.
   `#cocardo #frutinovela #satisfying #match3 #combos #lanievedelima`
9. **Cherry.** Cherry descubrió el secreto de Cocardo… y todo cambió 🍒 «No me hizo socia. Yo vi una oportunidad.»
   ¿Team Cocardo o Team Cherry? 👇 Juego de fans (no oficial), gratis en la web.
   `#cocardo #cherry #frutinovela #lanievedelima #telenovela #juegosindie`
10. **Último movimiento.** Nivel ⚠️ ¡DRAMA!: 4 movimientos, Cherry llenando todo de cajas… y lo gané en el ÚLTIMO 😮‍💨
    ¿Cuál es tu nivel más difícil? 👇 Juego de fans (no oficial), gratis en la web.
    `#cocardo #frutinovela #clutch #match3 #juegosindie #lanievedelima`
11. **Rescates.** Rescaté a las 6 frutas congeladas 🧊 Lima, Fresa, Durazna, Naranja, Banana… y Uva en el último
    movimiento. ¿Cuál es tu favorita? 👇 Juego de fans (no oficial), gratis en la web.
    `#cocardo #frutinovela #lanievedelima #rescate #match3 #juegosindie`
12. **ASMR.** ASMR de hielo 🧊🔊 (sube el volumen). Cada crujido está hecho con código. ¿Otro? 👇 Juego de fans (no
    oficial), gratis en la web.
    `#asmr #satisfying #cocardo #frutinovela #icebreaking #juegosindie`
13. **Final.** ⚠️ SPOILER: así termina mi juego de Cocardo. El congelador rosa de Cherry, Uva en el último movimiento… y
    «¿segunda temporada?» 😭 ¿La quieres? 👇 Juego de fans (no oficial), gratis en la web.
    `#cocardo #frutinovela #lanievedelima #final #cherry #juegosindie`

### Orden de publicación sugerido (2 por día: 13-14 h y 19-21 h, hora de México)

| Día | Mediodía | Noche |
|---|---|---|
| 1 | 2 Tráiler (fijarlo en el perfil) | 4 Acertijo |
| 2 | 3 Mejor jugada | 7 Personajes |
| 3 | 6 Congelador | 5 Perdí por uno |
| 4 | 8 Combos | 9 Cherry |
| 5 | 12 ASMR | 10 Último movimiento |
| 6 | 1 Sonidos | 11 Rescates |
| 7 | 13 Nivel final | — |

El 4 y el 9 piden comentar (A/B/C, Team Cocardo o Team Cherry): responder comentarios con video es lo que más alarga
la vida de esos posts.

## 7. Cómo se rehacen

Las capturas pesan (unos 300 KB por fotograma), así que no se suben al repositorio; se regeneran idénticas:

```bash
# 1) tomas (lista completa en el encabezado de cada archivo de tools/video/tomas/)
node tools/video/capturar.cjs tools/video/tomas/cascada.cjs cap/cascada
node tools/video/capturar.cjs tools/video/tomas/acertijo.cjs cap/acertijo2-C --var C
node tools/video/capturar.cjs tools/video/tomas/historia.cjs cap/hist-pre10 --var pre10
node tools/video/capturar.cjs tools/video/tomas/nivel.cjs cap/hielo12 --var 12:1:0:8:60
# 2) montaje → MP4 (las carpetas de cap/ se llaman como en `tomas:` de cada montaje)
node tools/video/grabar.cjs "tools/video/montaje.html?m=montajes/cascada.js" dist/videos/03-mejor-jugada.mp4 --cap cap
```

Tomas que usa cada montaje: `cascada` (cascada); `acertijo2-A/B/C` (acertijo); `casi-pierde`, `casi-gana` (casi13);
`congelador10`, `hist-pre10`, `hist-post10`; `combo-pp/bb/pb/cp/cb/cc`; `hielo12` (nivel 12:1:0:8:60); `clutch23`
(nivel 23:31:22:26:60); `cherry17` (nivel 17:1:3:6:30), `rosa25` (nivel 25:19:9:11:60), `hist-cliff15`,
`hist-pre16`, `hist-pre17`, `hist-cliff25`; `rescate15`, `rescate19` (rescate 15/19), `final30`, `hist-pre30`,
`hist-ending`; `portada`, `hist-pre2`.

Detalles que importan: la captura usa el juego sin «movimiento reducido» (efectos completos) y suaviza solo en video
el destello blanco del juego, que al acelerar o ralentizar se encadena y además dispara avisos de fotosensibilidad.
La portada del juego trae un pie con el nombre de la creadora: en el tráiler queda fuera de cuadro.
