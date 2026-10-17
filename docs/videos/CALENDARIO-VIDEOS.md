# Calendario de videos: 90 videos en 30 días

Plan del lunes 19 de octubre al martes 17 de noviembre de 2026: 3 videos al día para TikTok e Instagram Reels (el
mismo MP4 en las dos redes, el mismo día). Público: Latinoamérica, con horas de Ciudad de México. Tú publicas desde
Lisboa: aquí van también tus horas.

Archivos:

- `tools/video/calendario/2026-10-19.json`: los 90 videos con todo lo que hace falta para producirlos (nivel, semilla,
  escenas, lo exacto que se dice en voz, música, texto del post, hashtags, condición y alternativa).
- `tools/video/calendario/formatos.json`: los 16 formatos y cómo se fabrica cada uno con el estudio.
- `tools/video/calendario/validar.cjs`: revisa que todo siga en regla. Córrelo antes de producir cada semana y después
  de cambiar cualquier video:

```bash
node tools/video/calendario/validar.cjs                  # con el motor: vuelve a comprobar cada cifra
node tools/video/calendario/validar.cjs --rapido         # solo estructura, horas, textos y voces
node tools/video/calendario/validar.cjs --voz            # voz estimada de cada video frente a su duración
node tools/video/calendario/validar.cjs --reto 20261021  # datos del Reto de un día (para cambiar un video)
```

## 1. Resumen

- **Base:** el plan pensado para crecer (ganchos con cifras reales, bucles y series), con lo mejor de los planes de
  telenovela y de comunidad: la historia de noche, el Reto Diario como hábito de la mañana y el circuito de comentarios
  (conteos, salón de la fama, respuestas).
- **Los 13 videos que ya existen entran una vez cada uno**, casi todos en la primera semana y rehechos con voces o con
  la tarjeta final nueva. El del nivel final (13) sale el jueves 29, la víspera del estreno, y el 11 (que enseña el
  final del nivel 30) sale después, el jueves 5.
- **Tres franjas con intención distinta:**
  - **Mañana:** para jugar. El Reto de hoy, ASMR, frases cortas y «Conoce a…».
  - **Tarde:** juego con personajes. Cascadas, «Perdí por uno», último movimiento, rescates y respuestas a comentarios.
  - **Noche:** la historia. Telenovela, avances del capítulo, acertijos y encuestas.
- **El Reto Diario sale 11 veces** (la mañana, y el salón de la fama los domingos a las 14:00), nunca más de 2 días
  seguidos ni más de 4 veces en una semana. Nunca enseña la jugada de hoy.
- **La telenovela tiene 13 videos:** el tráiler, la maratón de la temporada 1 antes del estreno (Ep. 1 a 6), dos
  «Anteriormente» los domingos y episodios de noche después del estreno. Si un capítulo nuevo no llega, la reserva «Lo
  que no viste» usa escenas reales de la temporada 1 que no salieron en los episodios.
- **Cada semana trae al menos un rescate** (6 en total), el ángulo del juego.
- **22 videos son condicionales** y cada uno trae su alternativa ya escrita. Cuatro tienen varias ramas para el plan de
  respaldo del capítulo 7 (corrido al viernes 6 de noviembre) y otro, D19-2, es su estreno de respaldo. Ninguno dice
  una fecha si el capítulo no está desplegado oculto.
- **La voz cabe en el video.** Cada video con voces trae en `parametros.lineas` lo exacto que se dice (sirve tal cual
  de lote para `voz.py`), y `validar.cjs` mide que quepa: 11,5 caracteres por segundo, la voz más lenta medida. Los
  episodios dicen de 250 a 330 caracteres, no las escenas enteras.
- **Cada cifra viene del motor:** los 30 Retos del mes, los acertijos con una sola jugada ganadora, las cascadas, los
  rescates y los últimos movimientos se calcularon con el juego real, y `validar.cjs` los vuelve a calcular.

### Por qué funciona

1. **El primer segundo.** Todos los videos arrancan en movimiento, con sonido y con un gancho de 9 palabras o menos,
   casi siempre con un número o una pregunta («472.206 jugadas», «¿A, B o C?», «Reto #23»). La tarjeta final dura 1 s
   o menos para no cortar el bucle.
2. **Bucles y segundas vistas.** Las cascadas con el contador tapado, las frases que vuelven a su primer cuadro, el
   ASMR y los acertijos piden ver otra vez o comentar antes del final.
3. **Series que traen de vuelta.** «Reto #N», «Acertijo #N», la telenovela con «Ep. N» en el primer cuadro y
   CONTINUARÁ…, y las frases como audio original. Cada episodio lleva el comentario fijado «Ep. anterior / Ep.
   siguiente», y el tráiler fijado en el perfil explica el orden. Así la serie se sigue aunque la cuenta todavía no
   pueda crear listas de reproducción (varias guías dicen que piden 10.000 seguidores; no hay una política oficial). Si
   ya puedes, una lista por serie. En todos los videos, un comentario fijado con la pregunta.
4. **Comunidad que se ve.** Cada cara a cara abre con el conteo real de la ronda anterior, el salón de la fama premia a
   quien pegó su resultado y las respuestas convierten un comentario en otro video. Nunca se inventa un comentario.
5. **Atado a los capítulos.** El ciclo de `docs/CALENDARIO.md` §4 (D−2 «ya tiene fecha», D−1 «a medianoche, tu hora»,
   estreno a las 13:00 y D+5 «solo el X %» con el dato de sus primeros 5 días) para el capítulo 7 y para el 8, con un
   plan de respaldo si el 7 se corre una semana.
6. **Honesto.** Sin bulos, sin jugadas falsas y con el ángulo de rescate. Si jugó un bot, el texto dice «mi bot». El
   noticiero se presenta como ficción del juego. «Juega gratis» solo en videos de los niveles 1 a 10 y del Reto; en
   los demás, «Empieza gratis». Nunca «100 % gratis» ni «todo gratis».

### La lista de dopamina

Cada video tiene que dar mucha dopamina y ganas de jugar. La lista completa está en `lista_dopamina` de
`formatos.json`; cada formato dice cómo la cumple en su campo `dopamina` y cada idea del JSON termina con una frase
«Dopamina:» que la aterriza en ese video. En corto:

1. **Gancho en el primer 0,5 s** con la acción ya empezada y un reto, una promesa o una pregunta: «Mi bot perdió por UN
   hielo. ¿Ves la jugada?», «Reto #20: ¿te sobra más de UNO?», «Ep. 1: ¿qué esconde el congelador de Cocardo?». En las
   cascadas el gancho no dice el número que se pide contar.
2. **Ritmo:** un estímulo nuevo cada 1-2 s (corte, zoom, texto pop, sonido) y ningún tiempo muerto de más de 0,7 s. La
   pausa de «Perdí por uno» dura 1 s como máximo y lleva latido.
3. **Recompensa que escala:** contadores a la vista (cascadas, piezas, golpes, «1/16», «1/6»), pops que suben de tono,
   textos del juego de «¡Rico!» a «¡¡TELENOVELA!!», temblor y confeti. Cámara lenta solo en el clímax; destellos suaves,
   nunca más de 3 por segundo.
4. **Tensión y alivio:** contador de movimientos, casi-pérdida o cuenta atrás, y la jugada que lo resuelve. Cada idea
   dice dónde cae su clímax, siempre antes del 80 % del video.
5. **Sensorial:** cada acción con su sonido; voces cortas con la música agachada debajo.
6. **Ganas de jugar:** la mano del tutorial en el cuadro 0 de las cascadas, retos concretos («¿Tú, en menos de 8?»,
   «¿la encuentras en 3 segundos?», «¿llegas al nivel 30 antes?») y cada post con su reto o pregunta y la llamada a
   jugar. El reto nunca pide repetir una jugada exacta: fuera del Reto Diario, el tablero de cada partida es otro.
7. **Bucle:** tarjeta final de 1 s o menos y corte al cuadro 0.
8. **Duración:** de 12 a 25 s salvo que el formato pida otra cosa (frases de 5 a 10 s, Retos de 8 a 14, telenovela de
   25 a 40). Por eso los 16 personajes (D02-3) bajan de 34 a 25 s y los dos «Anteriormente» (D14-1 y D21-1) pasan a
   unos 30 s.

Lo que no se inventa para dar dopamina: cifras, jugadas, comentarios ni fechas. Los videos de obra o de retraso se
quedan honestos y su reto es el Reto Diario.

## 2. Formatos

Detalle técnico (tomas, parámetros, montajes) en `formatos.json`, con el campo `dopamina` de cada formato (gancho,
ritmo, recompensa, tensión, sensorial, ganas de jugar, bucle y duración). ♻ = usa un video que ya existe.

| Id | Formato | Qué es | Voces | Música | Montaje | Videos |
|---|---|---|---|---|---|---|
| F01 | ¿Cuántas cascadas? | Una jugada que encadena cascadas; el contador va tapado y se pide comentar el número. | no | juego | `cascada.js` | 5 ♻ |
| F02 | Acertijo #N: ¿A, B o C? | Último movimiento real, tres opciones, cuenta de 3 s y respuesta. | sí | drama | `acertijo.js` | 6 ♻ |
| F03 | Perdí por uno | La jugada que se queda a 1, la burla del villano, «¿qué harías tú?» y el rebobinado. | sí | drama | `casi.js` | 4 ♻ |
| F04 | Último movimiento | Partida real ganada en la última jugada, con el contador gigante. | sí | drama | `clutch.js` | 4 ♻ |
| F05 | Reto de hoy #N | El tablero del día y los emojis del bot; normal, salón de la fama y noticiero. | sí | tema | `reto.js` (nuevo) | 11 |
| F06 | Reacciona | La cara de un personaje cambiando de humor sobre una jugada. | sí | juego | `reacciona.js` (nuevo) | 4 |
| F07 | Telenovela | Episodios con voces y CONTINUARÁ…, «Lo que no viste» y «Anteriormente». | sí | drama | `cherry.js`, `final.js` + `capitulo.js` (nuevo) | 13 ♻ |
| F08 | Frase de telenovela | Una frase famosa, tres zooms y ¡TAN-TAN-TAAAN!; o «¿Quién lo dijo?». | sí | drama | `frase.js` (nuevo) | 6 |
| F09 | Del peor al mejor | Ranking con datos reales (combos, niveles según el bot). | sí | tema | `combos.js` + `barras.js` (nuevo) | 2 ♻ |
| F10 | ASMR | Solo el crujido del hielo, las cajas o un congelador, sin voz ni música. | no | juego | `hielo.js` | 4 ♻ |
| F11 | Rescate | Una víctima sale del hielo en cámara lenta y dice su línea. | sí | victoria | `rescates.js`, `congelador.js` | 6 ♻ |
| F12 | Conoce a… | Un personaje con sus humores, su frase y un dato. | sí | tema | `personajes.js` | 4 ♻ |
| F13 | Ustedes deciden | Encuestas, cara a cara con conteo y respuestas a comentarios. | sí | tema | `encuesta.js` (nuevo) | 7 |
| F14 | Así lo hice | Detrás de cámaras: sonidos, voces y música, dicho tal cual se hizo. | sí | calma | `sonidos.html` + `devlog.js` (nuevo) | 3 ♻ |
| F15 | Capítulo en obra | Fecha, víspera, estreno, «solo el X %», retraso y avances. | sí | drama | `obra.js` (nuevo) | 8 |
| F16 | POV: eres el ayudante | El personaje te habla a ti y la partida es tu respuesta. | sí | calma | `pov.js` (nuevo) | 3 |

Música: «tema», «drama», «victoria» y «calma» son las pistas del estudio (`tools/video/musica/pedidos.json`, cuatro de
cumbia, dos de tensión, dos de victoria y dos suaves). «juego» es solo el audio del juego, sin pista.

## 3. Día por día

Horas de Ciudad de México (UTC−6 todo el año) y de Lisboa (UTC+1 hasta el sábado 24 de octubre, UTC+0 desde el
domingo 25). Cuando en Lisboa ya es el día siguiente, va la fecha entre paréntesis. ♻ = video que ya existe (rehecho o
con tarjeta nueva). ◆ = condicional (ver §5).

Franjas: de lunes a viernes 07:30, 13:30 y 19:30; sábado 10:00, 14:00 y 20:30; domingo 10:00, 14:00 y 19:00. Los dos
estrenos van a las 13:00. El lunes 16 de noviembre es día de descanso en México: va con horario de domingo.

### Semana 1 · 19 al 25 de octubre: maratón de la temporada 1

| Día | Fecha | CDMX | Lisboa | Formato | Título | Gancho (primer segundo) |
|---|---|---|---|---|---|---|
| D01-1 | lun 19 oct | 07:30 | 14:30 | F01 ¿Cuántas cascadas? | La mejor jugada entre 472.206 ♻ | Probé 472.206 jugadas… y esta fue la MEJOR |
| D01-2 | lun 19 oct | 13:30 | 20:30 | F07 Telenovela | Tráiler: la frutinovela ahora se juega ♻ | ¿Cocardo… en VIDEOJUEGO? Y tú eres el ayudante |
| D01-3 | lun 19 oct | 19:30 | 02:30 (20 oct) | F02 Acertijo #N: ¿A, B o C? | Acertijo #1: solo una salva a Lima ♻ | Solo UNA rescata a Lima: ¿A, B o C? |
| D02-1 | mar 20 oct | 07:30 | 14:30 | F05 Reto de hoy #N | Reto #20: ganó por un movimiento | Reto #20: ¿te sobra más de UNO? |
| D02-2 | mar 20 oct | 13:30 | 20:30 | F03 Perdí por uno | Mi bot perdió por un hielo ♻ | Mi bot perdió por UN hielo. ¿Ves la jugada? |
| D02-3 | mar 20 oct | 19:30 | 02:30 (21 oct) | F12 Conoce a… | Los 16 personajes de mi juego ♻ | ¿Cuántos personajes de Cocardo reconoces? Son 16 |
| D03-1 | mié 21 oct | 07:30 | 14:30 | F10 ASMR | ASMR de hielo ♻ | ASMR 🧊 rompiendo hielo (sube el volumen) |
| D03-2 | mié 21 oct | 13:30 | 20:30 | F11 Rescate | Le rompí el congelador a Cocardo ♻ | Rompí el congelador de Cocardo en 8. ¿Tú, menos? |
| D03-3 | mié 21 oct | 19:30 | 02:30 (22 oct) | F07 Telenovela | Telenovela, Ep. 1: La nieve de Lima | Ep. 1: ¿qué esconde el congelador de Cocardo? |
| D04-1 | jue 22 oct | 07:30 | 14:30 | F08 Frase de telenovela | No está viejo, está experimentado | ¿Le comprarías este congelador a Cocardo? |
| D04-2 | jue 22 oct | 13:30 | 20:30 | F09 Del peor al mejor | Todos los combos, del peor al mejor ♻ | Del PEOR al MEJOR combo: ¿adivinas el #1? |
| D04-3 | jue 22 oct | 19:30 | 02:30 (23 oct) | F04 Último movimiento | Nivel ⚠️: mi bot lo ganó en el último ♻ | Nivel ⚠️ ¡DRAMA!: quedan 4 movimientos |
| D05-1 | vie 23 oct | 07:30 | 14:30 | F05 Reto de hoy #N | Reto #23: Cocardo le ganó a mi bot | Reto #23: mi bot perdió. ¿Tú puedes? |
| D05-2 | vie 23 oct | 13:30 | 20:30 | F01 ¿Cuántas cascadas? | 80 piezas en una jugada | 80 piezas en UNA jugada. ¿Cuántas cascadas? |
| D05-3 | vie 23 oct | 19:30 | 02:30 (24 oct) | F07 Telenovela | Telenovela, Ep. 2: Necesitamos un nuevo sabor | Ep. 2: Lima ya es libre… pero Fresa no |
| D06-1 | sáb 24 oct | 10:00 | 17:00 | F05 Reto de hoy #N | Reto #24: el congelador viejo | Reto #24: hoy TODOS rompen el congelador viejo |
| D06-2 | sáb 24 oct | 14:00 | 21:00 | F11 Rescate | Rescate de Naranja | Naranjita está en el hielo. ¿La sacamos? |
| D06-3 | sáb 24 oct | 20:30 | 02:30 (25 oct) | F07 Telenovela | Telenovela, Ep. 3: Voy a ampliar el menú | Ep. 3: ¿para qué un congelador TAN grande? |
| D07-1 | dom 25 oct | 10:00 | 16:00 | F14 Así lo hice | Así suena mi juego ♻ | Así suena mi juego (sin grabar ni un sonido) |
| D07-2 | dom 25 oct | 14:00 | 20:00 | F06 Reacciona | Cocardo reacciona a 11 cascadas | ¿En qué cascada se rinde Cocardo? Son 11 |
| D07-3 | dom 25 oct | 19:00 | 01:00 (26 oct) | F02 Acertijo #N: ¿A, B o C? | Acertijo #2: la salida de Fresa | Fresa tiene UNA salida. ¿La ves? |

### Semana 2 · 26 de octubre al 1 de noviembre: el capítulo 7 (fecha, víspera, estreno y Halloween)

| Día | Fecha | CDMX | Lisboa | Formato | Título | Gancho (primer segundo) |
|---|---|---|---|---|---|---|
| D08-1 | lun 26 oct | 07:30 | 13:30 | F08 Frase de telenovela | Así ronronea cuando está contento | Cuando tu congelador huele a quemado |
| D08-2 | lun 26 oct | 13:30 | 19:30 | F03 Perdí por uno | Perdí por uno #2: los dos villanos | Los DOS villanos se rieron… hasta que rebobiné |
| D08-3 | lun 26 oct | 19:30 | 01:30 (27 oct) | F07 Telenovela | Telenovela, Ep. 4: Cherry conoce el negocio ♻ | Cherry descubrió el secreto… y todo cambió |
| D09-1 | mar 27 oct | 07:30 | 13:30 | F08 Frase de telenovela | Cherry… interesante | Dos palabras de Don Piña lo cambian todo |
| D09-2 | mar 27 oct | 13:30 | 19:30 | F07 Telenovela | Telenovela, Ep. 5: Banano busca a su hermana ◆ | Ep. 5: ¿dónde está la hermana de Banano? |
| D09-3 | mar 27 oct | 19:30 | 01:30 (28 oct) | F13 Ustedes deciden | Elige tu sabor | Elige tu sabor y te digo quién eres |
| D10-1 | mié 28 oct | 07:30 | 13:30 | F12 Conoce a… | Conoce a Don Piña | 500 litros por sabor: ¿aceptas el trato? |
| D10-2 | mié 28 oct | 13:30 | 19:30 | F04 Último movimiento | Último movimiento: 7 cascadas | Última jugada: ¿alcanza con 7 cascadas? |
| D10-3 | mié 28 oct | 19:30 | 01:30 (29 oct) | F15 Capítulo en obra | El capítulo 7 ya tiene fecha ◆ | Capítulo 7 en 2 días: ¿llegas al nivel 30? |
| D11-1 | jue 29 oct | 07:30 | 13:30 | F12 Conoce a… | Conoce a Cherry | ¿Le confiarías tu heladería a Cherry? |
| D11-2 | jue 29 oct | 13:30 | 19:30 | F11 Rescate | Lima salió con 10 cascadas | Una jugada, 10 cascadas… y Lima libre |
| D11-3 | jue 29 oct | 19:30 | 01:30 (30 oct) | F07 Telenovela | Telenovela, Ep. 6: Se acabó el sabor (final) ♻ ◆ | ⚠️ SPOILER: así termina la temporada 1 |
| D12-1 | vie 30 oct | 07:30 | 13:30 | F05 Reto de hoy #N | Noticiero: Cherry fue vista en la ciudad ◆ | Última hora: Cherry fue vista en la ciudad |
| D12-2 | vie 30 oct | 13:00 | 19:00 | F15 Capítulo en obra | ¡Capítulo 7 abierto! ◆ | ¡Capítulo 7 ABIERTO: Cherry volvió! |
| D12-3 | vie 30 oct | 19:30 | 01:30 (31 oct) | F13 Ustedes deciden | Cherry te responde ◆ | Cherry leyó sus comentarios… y contestó |
| D13-1 | sáb 31 oct | 10:00 | 16:00 | F10 ASMR | ASMR: el congelador rosa de Cherry | ASMR 🍒: 14 golpes al congelador rosa. Cuéntalos |
| D13-2 | sáb 31 oct | 14:00 | 20:00 | F13 Ustedes deciden | Cara a cara: Cocardo contra Cherry | ¿Quién es PEOR villano: Cocardo o Cherry? |
| D13-3 | sáb 31 oct | 20:30 | 02:30 (1 nov) | F06 Reacciona | Cherry reacciona a sus cajas rotas | Los ojos de Cherry cuando rompes sus cajas |
| D14-1 | dom 1 nov | 10:00 | 16:00 | F07 Telenovela | Anteriormente: la temporada 1 en 30 segundos ◆ | Toda la temporada 1 en 30 segundos |
| D14-2 | dom 1 nov | 14:00 | 20:00 | F05 Reto de hoy #N | Salón de la fama del Reto (semana 2) ◆ | ¿Quién le ganó a Cherry en el Reto #31? |
| D14-3 | dom 1 nov | 19:00 | 01:00 (2 nov) | F02 Acertijo #N: ¿A, B o C? | Acertijo #3: una sola jugada gana | Acertijo #3: UNA gana. ¿La encuentras en 3 segundos? |

### Semana 3 · 2 al 8 de noviembre: «solo el X %» y el misterio del capítulo 8

| Día | Fecha | CDMX | Lisboa | Formato | Título | Gancho (primer segundo) |
|---|---|---|---|---|---|---|
| D15-1 | lun 2 nov | 07:30 | 13:30 | F05 Reto de hoy #N | Reto #33: se puede con 9 de sobra | Reto #33: se puede ganar con 9 de sobra |
| D15-2 | lun 2 nov | 13:30 | 19:30 | F13 Ustedes deciden | Te respondo: la duda de la semana ◆ | Respondo la pregunta que más me hicieron |
| D15-3 | lun 2 nov | 19:30 | 01:30 (3 nov) | F07 Telenovela | Temporada 2, Ep. 7: el pedido de Don Piña ◆ | Don Piña quiere su helado… y lo quiere YA |
| D16-1 | mar 3 nov | 07:30 | 13:30 | F16 POV: eres el ayudante | POV: Lima te habla desde el congelador | POV: Lima te pide ayuda desde el congelador |
| D16-2 | mar 3 nov | 13:30 | 19:30 | F09 Del peor al mejor | Mis 30 niveles, del más fácil al más difícil | ¿Adivinas mi nivel más difícil? Lo dice un bot |
| D16-3 | mar 3 nov | 19:30 | 01:30 (4 nov) | F02 Acertijo #N: ¿A, B o C? | Acertijo #4: la jugada de las tres Paletas | Esta jugada suelta TRES Paletas. ¿Cuál es? |
| D17-1 | mié 4 nov | 07:30 | 13:30 | F10 ASMR | ASMR: hielo de tres golpes | ASMR 🧊 hielo triple: tres golpes cada uno |
| D17-2 | mié 4 nov | 13:30 | 19:30 | F04 Último movimiento | Jugada 24 de 24: 60 piezas | Jugada 24 de 24: todo o nada |
| D17-3 | mié 4 nov | 19:30 | 01:30 (5 nov) | F15 Capítulo en obra | Solo el X % pasó este nivel ◆ | Solo el X % pasó este nivel |
| D18-1 | jue 5 nov | 07:30 | 13:30 | F08 Frase de telenovela | ¿Quién lo dijo? «Deja de temblar y piensa» | ¿Quién dijo «Deja de temblar y piensa»? |
| D18-2 | jue 5 nov | 13:30 | 19:30 | F11 Rescate | Rescaté a las 6 frutas ♻ | Rescaté a TODAS: las 6 frutas congeladas |
| D18-3 | jue 5 nov | 19:30 | 01:30 (6 nov) | F15 Capítulo en obra | El capítulo 8 ya tiene fecha ◆ | Se renta local: el capítulo 8 tiene fecha |
| D19-1 | vie 6 nov | 07:30 | 13:30 | F01 ¿Cuántas cascadas? | 9 cascadas contra el congelador grande | ¿Cuántas cascadas aguanta el congelador grande? |
| D19-2 | vie 6 nov | 13:30 | 19:30 | F06 Reacciona | Don Piña reacciona a su pedido ◆ | ¿Llenas el pedido de Don Piña a tiempo? |
| D19-3 | vie 6 nov | 19:30 | 01:30 (7 nov) | F07 Telenovela | Lo que no viste: El expediente de Cherry | El expediente de Cherry… tiene mucho que esconder |
| D20-1 | sáb 7 nov | 10:00 | 16:00 | F14 Así lo hice | Así le di voz a Cocardo | Le di voz a Cocardo sin grabar a nadie |
| D20-2 | sáb 7 nov | 14:00 | 20:00 | F03 Perdí por uno | Perdí por uno #3: Cherry se rio | Cherry se rio… pero rebobiné el último movimiento |
| D20-3 | sáb 7 nov | 20:30 | 02:30 (8 nov) | F13 Ustedes deciden | ¿Quién entra de noche a Coco's Scoops? | ¿Quién entra de noche a la heladería? Adivina |
| D21-1 | dom 8 nov | 10:00 | 16:00 | F07 Telenovela | Anteriormente: el capítulo 7 ◆ | El capítulo 7 en 30 segundos. ¿Llegaste al jefe? |
| D21-2 | dom 8 nov | 14:00 | 20:00 | F05 Reto de hoy #N | Salón de la fama del Reto (semana 3) ◆ | Ellos le ganaron a mi bot. ¿Y tú? |
| D21-3 | dom 8 nov | 19:00 | 01:00 (9 nov) | F16 POV: eres el ayudante | POV: Banano necesita tu ayuda | POV: Banano te pide las pruebas |

### Semana 4 · 9 al 15 de noviembre: el capítulo 8

| Día | Fecha | CDMX | Lisboa | Formato | Título | Gancho (primer segundo) |
|---|---|---|---|---|---|---|
| D22-1 | lun 9 nov | 07:30 | 13:30 | F05 Reto de hoy #N | Reto #40: 7 cascadas no bastaron | Reto #40: 7 cascadas… y mi bot perdió |
| D22-2 | lun 9 nov | 13:30 | 19:30 | F01 ¿Cuántas cascadas? | 10 cascadas en el nivel 3 | ¿Cuántas cascadas caben en el nivel 3? Cuenta |
| D22-3 | lun 9 nov | 19:30 | 01:30 (10 nov) | F07 Telenovela | Lo que no viste: Tenías suerte | «Yo tenía el control antes de que llegaras» |
| D23-1 | mar 10 nov | 07:30 | 13:30 | F12 Conoce a… | Conoce a Limón, el del callejón | ¿Qué vio Limón desde el callejón? |
| D23-2 | mar 10 nov | 13:30 | 19:30 | F13 Ustedes deciden | Dime tu nivel más difícil y lo juego | Dime tu nivel más difícil y lo juego |
| D23-3 | mar 10 nov | 19:30 | 01:30 (11 nov) | F04 Último movimiento | Nivel ⚠️: 46 piezas en el último | Nivel ⚠️ «Deja de temblar»: todo en la última |
| D24-1 | mié 11 nov | 07:30 | 13:30 | F11 Rescate | Durazna salió con la jugada que ganó | El congelador grande cae en UNA jugada |
| D24-2 | mié 11 nov | 13:30 | 19:30 | F06 Reacciona | Lima reacciona al rescate de su prima | Lima viendo cómo rescatas a su prima |
| D24-3 | mié 11 nov | 19:30 | 01:30 (12 nov) | F15 Capítulo en obra | Faltan 2 días para el capítulo 8 ◆ | Faltan 2 días: se renta local |
| D25-1 | jue 12 nov | 07:30 | 13:30 | F08 Frase de telenovela | ¡Ni lo había terminado de pagar! | Cuando ni lo habías terminado de pagar |
| D25-2 | jue 12 nov | 13:30 | 19:30 | F02 Acertijo #N: ¿A, B o C? | Acertijo #5: el congelador de Cherry | Cherry apuesta a que fallas: ¿A, B o C? |
| D25-3 | jue 12 nov | 19:30 | 01:30 (13 nov) | F15 Capítulo en obra | Mañana se abre el capítulo 8 ◆ | Mañana a medianoche, tu hora: se renta local |
| D26-1 | vie 13 nov | 07:30 | 13:30 | F05 Reto de hoy #N | Noticiero: la heladería tiene inquilino ◆ | Última hora: la heladería clausurada tiene inquilino |
| D26-2 | vie 13 nov | 13:00 | 19:00 | F15 Capítulo en obra | ¡Capítulo 8 abierto! ◆ | ¡Capítulo 8 ABIERTO! ¿Quién entraba de noche? |
| D26-3 | vie 13 nov | 19:30 | 01:30 (14 nov) | F13 Ustedes deciden | Segunda vuelta: Team Cocardo o Team Cherry | Segunda vuelta: ¿Team Cocardo o Team Cherry? |
| D27-1 | sáb 14 nov | 10:00 | 16:00 | F01 ¿Cuántas cascadas? | 13 cascadas en el nivel 1 | Esto pasó en el NIVEL 1 |
| D27-2 | sáb 14 nov | 14:00 | 20:00 | F16 POV: eres el ayudante | POV: tu primer día en Coco's Scoops | POV: tu primer día en Coco's Scoops |
| D27-3 | sáb 14 nov | 20:30 | 02:30 (15 nov) | F07 Telenovela | Temporada 2, Ep. 8: Se renta local ◆ | ¿Quién se mudó a la heladería clausurada? |
| D28-1 | dom 15 nov | 10:00 | 16:00 | F10 ASMR | ASMR: las cajas de Cherry | ASMR 📦 rompiendo las cajas de Cherry |
| D28-2 | dom 15 nov | 14:00 | 20:00 | F05 Reto de hoy #N | Salón de la fama del Reto (semana 4) ◆ | Mi bot perdió 4 retos esta semana. ¿Y tú? |
| D28-3 | dom 15 nov | 19:00 | 01:00 (16 nov) | F02 Acertijo #N: ¿A, B o C? | Acertijo #6: comenta antes del 3 | Acertijo #6: comenta tu jugada antes del 3 |

### Cierre · 16 y 17 de noviembre

| Día | Fecha | CDMX | Lisboa | Formato | Título | Gancho (primer segundo) |
|---|---|---|---|---|---|---|
| D29-1 | lun 16 nov | 10:00 | 16:00 | F08 Frase de telenovela | Luces. | La última palabra de la temporada 1 |
| D29-2 | lun 16 nov | 14:00 | 20:00 | F03 Perdí por uno | Perdí por uno #4: el combo no siempre gana | Mi bot hizo COMBO en el último… y perdió |
| D29-3 | lun 16 nov | 19:00 | 01:00 (17 nov) | F14 Así lo hice | Así hice la música de mi juego | Así hice la cumbia de mi juego. ¿Cuál gana? |
| D30-1 | mar 17 nov | 07:30 | 13:30 | F05 Reto de hoy #N | Reto #48: ¿cuál es tu racha? | Reto #48: ¿cuántos días llevas de racha? |
| D30-2 | mar 17 nov | 13:30 | 19:30 | F11 Rescate | Naranja salió con 7 cascadas | 7 cascadas y Naranja sale del hielo |
| D30-3 | mar 17 nov | 19:30 | 01:30 (18 nov) | F15 Capítulo en obra | Avance: Visita en la cárcel ◆ | Hay visita en la comisaría… CONTINUARÁ |

## 4. Reglas de variedad

Las revisa `validar.cjs`, en el plan normal y en cada combinación posible de condiciones (32 escenarios). Son error:

- Un formato dos veces el mismo día.
- Un formato más de 2 días seguidos en la misma franja.
- Dos ganchos iguales, o uno de más de 9 palabras.
- Uno de los 13 videos que ya existen que no sale, o que sale dos veces.

Y dan aviso:

- Un formato que sale 3 días seguidos en cualquier franja, o más de 4 veces en una semana. «Capítulo en obra» queda
  fuera de esta regla: su ciclo D−2, D−1 y D (`docs/CALENDARIO.md` §4) cae en días seguidos a propósito.

Reparto: Telenovela 13, Reto 11, Capítulo en obra 8, Ustedes deciden 7, Acertijo 6, Frase 6, Rescate 6, Cascadas 5, y
de 2 a 4 los demás.

**Reciclar lo que funciona (revisión de cada lunes, 48 h después de publicar):**

- Un video gana si tiene 2 veces o más la mediana de vistas de los últimos 9, o la mejor tasa de video completo de la
  semana con envíos por encima de la mediana.
- La semana siguiente, su formato toma un hueco más en la misma franja, quitándoselo al formato con peor mediana. El
  video nuevo lleva otra variante real (otra semilla, nivel o personaje) y el gancho que ganó.
- Nunca se vuelve a subir el mismo MP4.
- Si un formato tiene 3 videos seguidos por debajo de la mitad de la mediana, descansa una semana.
- Al cambiar algo, corre `validar.cjs`: las reglas de arriba se tienen que seguir cumpliendo.
- Huecos de reciclaje ya marcados: D19-1 y D22-2 (cascadas) y D29-2 («Perdí por uno» con el nivel que pidió la gente
  el martes 10).

**Ganchos A/B.** Algunos videos traen un `gancho_b`. Si tu cuenta de Instagram tiene Trial Reels, sube ahí la versión
B (solo la ven quienes no te siguen) y compara a las 48 h. Si no los tiene, el gancho B se usa días después en el
reciclaje. TikTok no tiene A/B para videos normales.

## 5. Condicionales y plan B

Siete condiciones (en `plan.condiciones` del JSON):

| Id | Se cumple si… |
|---|---|
| `cap7` | El capítulo 7 quedó desplegado oculto el martes 27 de octubre (con `opens` 2026-10-30) y se comprobó en cocardo.app. Hazlo antes de las 13:00 de México (19:00 en Lisboa): a esa hora sale el video que depende de esto. |
| `cap7_3nov` | Plan de respaldo: el 7 no llegó el martes 27, pero quedó desplegado oculto el martes 3 de noviembre (con `opens` 2026-11-06). Solo puede pasar si `cap7` no se cumple. |
| `cap8_3nov` | El capítulo 8 quedó construido, balanceado y desplegado oculto el martes 3 de noviembre (con `opens` 2026-11-13). |
| `cap8` | El capítulo 8 quedó desplegado oculto a más tardar el martes 10 de noviembre, con el 7 ya abierto. |
| `ga4` | El capítulo 7 abrió el viernes 30, GA4 está activo y hay 50 usuarios o más con `level_end` en el nivel desde la apertura (5 días). La regla 0 de `docs/CALENDARIO.md` §3 (7 días) es para decidir la dificultad, no para dar una cifra. |
| `comentarios` | Hay un comentario real que sirva. |
| `ranking` | Hay al menos 3 apodos del ranking del Reto que pidieron salir en el video. |

En el JSON, un video condicional sale tal cual si se cumple su `condicion` (`!cap7_3nov` quiere decir «si no se
cumple»). Si no, sale su `alternativa`: un solo video o una lista de ramas. Cada rama lleva su condición en `si` («a|b»
es «a o b») y la última va sin `si`: es la de los demás casos. Cada rama trae su formato, su hora, su gancho, su texto
del post y sus hashtags.

Qué pasa en cada caso:

- **El capítulo 7 llega a tiempo (lo previsto).** Miércoles 28: «ya tiene fecha». Jueves 29: el final de la temporada 1
  con la tarjeta «Mañana, a medianoche tu hora: capítulo 7». Viernes 30: noticiero en la mañana, estreno a las 13:00 y
  Cherry respondiendo de noche. Miércoles 4: «solo el X %» con el dato de sus primeros 5 días en GA4 (o el del bot si
  no hay muestra).
- **El capítulo 7 no está desplegado el martes 27.** La fecha se corre siete días (regla 1 de `docs/CALENDARIO.md` §2).
  Ese mismo martes a las 13:30 sale el video de 10 s del retraso, en el lugar del Ep. 5, que pasa al miércoles 28 a
  las 19:30. El jueves 29 el final de temporada sale con la tarjeta «La temporada 2 ya está en obra». El viernes 30
  va «Así va la obra». Todos los videos del capítulo 8 pasan a su alternativa (el 8 ya no puede abrir el 13: nunca a
  menos de 14 días del anterior).
  - **Si queda desplegado oculto el martes 3 (`cap7_3nov`):** «ya tiene fecha: viernes 6 de noviembre» el miércoles 4
    (D17-3), «Mañana, a medianoche tu hora: capítulo 7» el jueves 5 (D18-3) y estreno el viernes 6 a las 13:00 (D19-2).
    El domingo 8, «Anteriormente: lo que no viste» cierra con «el capítulo 7 ya está abierto».
  - **Si tampoco llega el martes 3:** «el capítulo 7 sigue en obra» el miércoles 4, «Lo que no viste: ¡Prima, aquí
    estoy!» el jueves 5 (no se habla del 8), Don Piña reacciona el viernes 6 y «el capítulo 7, dos semanas después» el
    viernes 13. Es la regla 8 de `docs/CALENDARIO.md` §3: un post transparente y la cadencia baja un escalón.
- **El capítulo 8 llega el martes 3.** «Ya tiene fecha» el jueves 5, «faltan 2 días» el miércoles 11, víspera el
  jueves 12 y estreno el viernes 13 a las 13:00.
- **El capítulo 8 llega el martes 10.** El jueves 5 va el teaser sin día y el miércoles 11 pasa a ser «ya tiene fecha».
- **El capítulo 8 no llega (con el 7 abierto).** «Sigue en obra» el miércoles 11, «Lo que no viste» el jueves 12 y el
  viernes 13 el jefe del capítulo 7. El avance del martes 17 es del capítulo 8, con su mes.

| Video | Condición | Si se cumple | Si no se cumple |
|---|---|---|---|
| D09-2 (mar 27 oct, 13:30) | `cap7` | Telenovela, Ep. 5: Banano busca a su hermana | F15 · Video de 10 s: el capítulo 7 se retrasa |
| D10-3 (mié 28 oct, 19:30) | `cap7` | El capítulo 7 ya tiene fecha | F07 · El Ep. 5, que cedió su lugar |
| D11-3 (jue 29 oct, 19:30) | `cap7` | Ep. 6 (el 13) con «Mañana, a medianoche tu hora: capítulo 7» | El mismo video con «La temporada 2 ya está en obra» |
| D12-1 (vie 30 oct, 07:30) | `cap7` | Noticiero: Cherry vista en la ciudad… y el capítulo abierto | Noticiero sin el capítulo, con el Reto #30 |
| D12-2 (vie 30 oct, 13:00) | `cap7` | ¡Capítulo 7 abierto! | Así va la obra del capítulo 7 (13:30) |
| D12-3 (vie 30 oct, 19:30) | `comentarios` | Cherry contesta un comentario real del Ep. 4 | Cherry pregunta «¿Me extrañaron, cariño?» |
| D14-1 (dom 1 nov, 10:00) | `cap7` | La temporada 1 en 30 segundos, cerrando con «el capítulo 7 ya está abierto» | El mismo resumen, cerrando con «está en obra» |
| D14-2 (dom 1 nov, 14:00) | `ranking` | Salón de la fama con los apodos | La semana de mi bot (6 ganados y 1 perdido) |
| D15-2 (lun 2 nov, 13:30) | `comentarios` | Respuesta con video al comentario más repetido | Por qué solo la C rescataba a Lima |
| D15-3 (lun 2 nov, 19:30) | `cap7` | Temporada 2, Ep. 7 | Lo que no viste: La fuga de Uva |
| D17-3 (mié 4 nov, 19:30) | `ga4` | Solo el X % pasó este nivel en sus primeros 5 días | Si el 7 abrió: el dato del bot. Si se corrió al 6 (`cap7_3nov`): «ya tiene fecha: viernes 6 de noviembre». Si no: «sigue en obra» |
| D18-3 (jue 5 nov, 19:30) | `cap8_3nov` | El capítulo 8 ya tiene fecha | Si se corrió el 7 (`cap7_3nov`): «Mañana, a medianoche tu hora: capítulo 7». Si el 7 abrió: teaser del 8 sin día. Si no: F07 · Lo que no viste: ¡Prima, aquí estoy! |
| D19-2 (vie 6 nov, 13:30) | `!cap7_3nov` | Don Piña reacciona a su pedido | F15 · Estreno de respaldo del capítulo 7 a las 13:00 |
| D21-1 (dom 8 nov, 10:00) | `cap7` | Anteriormente: el capítulo 7 en 30 s | Anteriormente: lo que no viste, en 30 s (si el 7 abrió el 6, cierra con «ya está abierto») |
| D21-2 (dom 8 nov, 14:00) | `ranking` | Salón de la fama | La semana de mi bot (5 y 2) |
| D24-3 (mié 11 nov, 19:30) | `cap8` | Faltan 2 días (o «ya tiene fecha» si se desplegó el 10) | El capítulo 8 sigue en obra |
| D25-3 (jue 12 nov, 19:30) | `cap8` | Mañana, a medianoche tu hora: se renta local | F07 · Lo que no viste: La pulsera |
| D26-1 (vie 13 nov, 07:30) | `cap8` | Noticiero: la heladería tiene inquilino | Reto #44 normal |
| D26-2 (vie 13 nov, 13:00) | `cap8` | ¡Capítulo 8 abierto! | Si el 7 está abierto: ¿Ya pasaste el jefe del capítulo 7? Si no: «el capítulo 7, dos semanas después» (13:30) |
| D27-3 (sáb 14 nov, 20:30) | `cap8` | Temporada 2, Ep. 8: Se renta local | Lo que no viste: ¡Ya están los 5! |
| D28-2 (dom 15 nov, 14:00) | `ranking` | Salón de la fama | La semana de mi bot (3 y 4) |
| D30-3 (mar 17 nov, 19:30) | `cap8` | Avance del capítulo 9, con lo que diga el mapa | Avance del capítulo 8, con su mes |

**Fechas en redes.** El mapa del juego ya enseña «Se abre el viernes 30 de octubre», pero en redes la fecha solo se dice
desde el despliegue oculto (`docs/CALENDARIO.md` §4, paso 8). Hasta el martes 27, las tomas del mapa se cortan en el
nivel 30 y el aviso inferior («Capítulo 7 en construcción · Se abre el…») se tapa con `K.tapa`. Nunca se enseñan las
temporadas 3 y 4 del mapa. Siempre «a medianoche, tu hora», nunca una hora concreta. En una rama de alternativa, la
fecha solo va si la rama depende de `cap7_3nov`, `cap8` o `cap8_3nov` (`validar.cjs` da error si no).

**Halloween (sábado 31).** Cherry con los ojos rojos de sus humores burlón, enojado y furioso, en la variante normal (la
de huida lleva lentes y no se le ven): en el ASMR de su congelador rosa (D13-1), en el cara a cara (D13-2) y en «Cherry
reacciona» (D13-3). Cero sustos: ni calabazas (tampoco el emoji 🎃) ni Día de Muertos como gancho, tampoco el 1 y el 2
de noviembre.

## 6. Reglas de los textos

- Cada texto de post: frase gancho, un reto concreto o una pregunta para comentar («¿Tú lo haces en menos? Es el nivel
  10», «¿te sobra más de uno?», «comenta tu número») y la llamada a jugar. De 4 a 5 hashtags. `validar.cjs` da error
  si el post no trae una pregunta.
- En las cascadas con el contador tapado, el gancho y el post no dicen el número que se pide contar (sí las piezas u
  otro dato). El 03 (D01-1) lleva el contador a la vista: ahí el reto es «¿Le ganas a las 18?».
- «Juega gratis» solo en videos de los niveles 1 a 10; en el Reto, «El Reto Diario es gratis»; en los demás, «Empieza
  gratis». Nunca «100 % gratis», «todo gratis» ni «gratis en la web» (los niveles 11 a 30 llevarán una compra única).
- Sin «juego de fans» ni «no oficial». Ojo: los textos viejos de `dist/videos/TEXTOS-PARA-PUBLICAR.md` todavía lo dicen.
  Usa los de este calendario.
- **Si jugó un bot, el texto lo dice.** «Mi bot perdió por UN hielo», o neutro: «se quedó a UN hielo». «Rebobiné» sí
  vale, porque el rebobinado es del video. Los Retos y los rankings ya dicen «mi bot».
- **El noticiero es ficción del juego.** Abre en el cuadro 0 con la placa «Noticiero de Coco's Scoops» y el retrato de
  la reportera, y su post empieza con «En mi juego:». Así nadie lo lee como un rumor sobre la serie.
- **Nada del final antes del jueves 29:** ni líneas de la escena `ending` (salvo «Cherry… interesante», que es el nombre
  del capítulo 7 y sale sin la noticia del arresto), ni las variantes de huida y cárcel, ni las citas del álbum de la
  reportera y del oficial Sandía (el juego las abre en el nivel 30).
- Ortografía: «se rio», sin tilde (Ortografía de la RAE, 2010). `validar.cjs` lo revisa.
- **Frases vetadas** por romper el ángulo de rescate (no van en voz, subtítulo ni texto):
  - «Es orgánico» (pre8, y el rótulo con el nombre del nivel 8 en los Retos #22 y #33);
  - «Habrá que raspar un poquito más» y «Perdóname… solo un poquito» (burlas de Cocardo);
  - «Perdóname, amor… solo un poquito» y «Tu brazo… se regeneró» (cliff5);
  - «Tranquila, será rápido» (pre12);
  - «Me acabas de dar una gran idea: helado de plátano con chocolate» (pre28);
  - «¿Y helado de coco cremosito? …Bromi» (burla de Cherry).
- El Reto nunca enseña una jugada sobre el tablero de hoy: el relleno es el mismo para todos y se podría copiar. Solo el
  tablero inicial, los emojis y el resultado.
- El salón de la fama solo usa apodos públicos del ranking y solo de quien pidió salir. Si nadie pide, va «la semana de
  mi bot».
- Acertijos: «la única» solo si el motor dice que una sola jugada de todo el tablero gana. Si hay más, en un acertijo
  «de estas tres, solo una gana», y en «Perdí por uno» «había N jugadas que ganaban» (D29-2: «había 3 jugadas que
  ganaban y ninguna era el combo»).
- **Lo que se dice en voz** va en `parametros.lineas` (`quien`, `texto`, `emocion` y la `escena` de `js/story.js`; las
  líneas nuevas llevan `nueva`). Vale un fragmento de una línea del juego. `validar.cjs` comprueba que cada línea
  esté en boca de ese personaje y que la voz quepa: caracteres dichos (los números en letras) ÷ 11,5 + 0,25 s entre
  líneas. Da aviso si pasa de `duracion_s` y error si pasa de `duracion_s` + 5 o de 59 s. Para un episodio de 35 s,
  unos 300-330 caracteres.
- Videos con voces sintéticas: activa la etiqueta de contenido generado con IA en TikTok. En Instagram, activa
  «Información de IA» al subir los videos con voces: Meta pide marcar el audio realista hecho con IA, y las voces de
  Chatterbox suenan humanas.

## 7. Cómo se produce

### Lo que hay que construir, por fecha de primer uso

Hoy es sábado 17. Cada pieza tiene un cambio de respaldo para su día; los de la primera semana se probaron con
`validar.cjs`, solos y todos juntos. Después de cualquier cambio, córrelo otra vez.

| Pieza | Primer uso | Si no está ese día |
|---|---|---|
| Voces de la semana 1 (tráiler, 04, 05, 07, 06, Ep. 1 a 3 y frases), por lotes con `flock` | sáb 17 y dom 18 | Un remake sin voces sale con el MP4 que ya existe y la tarjeta nueva (menos el 07: ver abajo). |
| Tarjeta final nueva en los 13 (`kit.js` ya tiene `o.cta`) | lun 19 (D01-1) | — |
| `trailer.js` con voces y los huecos estirados (`parametros.huecos_s`: hoy duran de 2,15 a 2,5 s) | lun 19, 13:30 (D01-2) | El 02 sin voces, con la tarjeta nueva. |
| `acertijo.js` con voces (el 04) | lun 19, 19:30 (D01-3) | El 04 con la tarjeta nueva. |
| Toma `reto.cjs` y montaje `reto.js` | mar 20, 07:30 (D02-1) | D02-1 ↔ D03-1 (el ASMR 12): el martes sale el ASMR y el miércoles el Reto #21 (`validar.cjs --reto 20261021`: nivel 7, 19 movimientos, los dos bots ganan con 4 de sobra). |
| `casi.js` con voz y el gancho nuevo (el 05) | mar 20, 13:30 (D02-2) | El 05 con la tarjeta nueva (todavía con el gancho viejo). |
| `personajes.js` con las líneas de `parametros.lineas` (el 07) | mar 20, 19:30 (D02-3) | El 07 tal cual no sirve: dice «Ya no más.» y «Gracias por venir por mí.», que son del final. D02-3 ↔ D07-1 (el 01, «Así suena», que solo pide quitar la placa vieja): «Así suena» el martes y los personajes el domingo 25 a las 10:00. |
| `congelador.js` con voces (el 06) | mié 21, 13:30 (D03-2) | El 06 con la tarjeta nueva. |
| `capitulo.js` y tomas `historia.cjs` de cada escena | mié 21, 19:30 (D03-3) | D03-3 ↔ D04-2 (el 08 de combos): el Ep. 1 sale el jueves 22 a las 13:30 (`validar.cjs` da un aviso: telenovela 3 días seguidos). |
| `frase.js` | jue 22, 07:30 (D04-1) | D04-1 sale con `personajes.js` adaptado a Cocardo, con las mismas dos líneas (cuenta como F12). |
| `combos.js` con el narrador (el 08) y `clutch.js` con la burla (el 10) | jue 22 (D04-2, D04-3) | El MP4 que ya existe con la tarjeta nueva. |
| `cascada.cjs` con nivel, semilla y jugada por `--var`, y `cascada.js` que acepte su carpeta | vie 23, 13:30 (D05-2) | D05-2 ↔ D06-2 (el rescate de Naranja, con la toma `rescate19` ya hecha). |
| `rescates.js` de un solo rescate | sáb 24, 14:00 (D06-2) | `rescates.js` recortado a su tramo del nivel 19. |
| `sonidos.html` sin la placa vieja (línea 202: «juego de fans · muy pronto gratis en la web») | dom 25, 10:00 (D07-1) | Es una línea: no hay respaldo, se arregla antes. |
| `reacciona.js` | dom 25, 14:00 (D07-2) | D07-2 ↔ D11-2 (el rescate de Lima, con `nivel.cjs` y `rescates.js` ya hechos). |
| `acertijo.cjs` que lea el estado de `plan.cjs casi` (`--var nivel:semilla:política:A\|B\|C`) | dom 25, 19:00 (D07-3) | Sale la explicación «Por qué solo la C rescataba a Lima» (F13, con las tomas del 04) y el Acertijo #2 pasa al siguiente hueco de acertijo. |
| `casi13.cjs` generalizada (`--var nivel:semilla:política:pierde:<i>\|gana:<i>`) | lun 26, 13:30 (D08-2) | Desde aquí hay más margen: cambia el video por otro de su franja en la misma semana que ya tenga todo. |
| `cherry.js` con voces (el 09) | lun 26, 19:30 (D08-3) | El 09 con la tarjeta nueva. |
| `encuesta.js` (encuesta, cara a cara, respuesta y «¿Quién lo dijo?») | mar 27, 19:30 (D09-3) | Igual: otro video de su franja en la misma semana. |
| `obra.js` y la toma del mapa con `Cocardo.debug.today` y `showRoadmap(N)` | mar 27 (D09-2 si el 7 se retrasa) y mié 28 (D10-3) | El video del retraso puede salir con el narrador sobre una captura del mapa: ese día no se puede mover. |
| `clutch.js` y `hielo.js` que acepten la carpeta de la toma (hoy apuntan a `clutch23` y `hielo12`) | mié 28, 13:30 (D10-2) y sáb 31, 10:00 (D13-1) | Es pasar la carpeta como parámetro: se arregla antes. |
| `final.js` con voces (el 13) | jue 29, 19:30 (D11-3) | El 13 con la tarjeta nueva y el aviso de spoiler. |
| Voz de la reportera (`reportera-a` con `voz.py --disenar`, con `flock`) | vie 30, 07:30 (D12-1) | Presenta el narrador (`anfitrion_respaldo`). El repartidor ya no habla en ningún video. |
| `anteriormente.js` | dom 1 nov (D14-1) | Otro video de su franja en la misma semana. |
| `pov.js`, `barras.js` y el ranking de niveles con 300 semillas (`node tools/sim.js --seeds 300 --md` y con `--offset 300`; hoy, con 200, el 29, el 30, el 15 y el 23 caen entre el 49 % y el 52 %: eso es un empate, no un orden) | mar 3 (D16-1, D16-2) | Otro video de su franja en la misma semana. |
| `devlog.js` | sáb 7 (D20-1) | Otro video de su franja en la misma semana. |

**Música:** genera las 10 pistas con `tools/video/musica/generar.py` y elige escuchando. Si una pista no está, el
montaje usa la cumbia del juego.

### Cada video

Todo lo que usa la GPU va con `flock ~/.local/share/cocardo-estudio/gpu.lock` (`voz.py` y `generar.py` ya lo toman
solos). Los parámetros de cada paso están en el JSON del video; `parametros.lineas` es el lote de voces tal cual.

```bash
# Ejemplo: D10-2 «Último movimiento: 7 cascadas» (nivel 18, semilla 59; la burla de Cherry con voz)
# 1) toma del juego (parametros.toma del video)
node tools/video/capturar.cjs tools/video/tomas/nivel.cjs dist/cap/clutch18 --var 18:59:20:25:60
# 2) voces: el lote es parametros.lineas ([{"quien":"cereza","texto":"Aquí termina el paseo.","emocion":"burlon"}])
mkdir -p dist/estudio/voz
node -e 'const c=require("./tools/video/calendario/2026-10-19.json");console.log(JSON.stringify(c.videos.find((v)=>v.id==="D10-2").parametros.lineas))' > dist/estudio/voz/D10-2.lote.json
python3 tools/video/voz/voz.py dist/estudio/voz/D10-2.lote.json --revisar --salida dist/estudio/voz/D10-2 > dist/estudio/voz/D10-2.json
# 3) montaje → MP4 con revisión automática (formato, volumen, negros, silencios y zona segura);
#    la duración sale de g.fin de K.guion('dist/estudio/voz/D10-2.json', …): pásala a duracion_s del JSON
node tools/video/grabar.cjs "tools/video/montaje.html?m=montajes/clutch.js" dist/videos/2026-10-19/D10-2.mp4 --cap dist/cap --revisar
# 4) que la voz diga lo que dice el guion (WER con whisper)
~/.local/share/cocardo-estudio/voz-whisper/bin/python tools/video/voz/revisar_voz.py dist/videos/2026-10-19/D10-2.mp4 --guion dist/estudio/voz/D10-2.lote.json
```

Después, **escúchalo**. La revisión automática mide formato, volumen, duración y la transcripción, pero que una voz
suene bien o que la música quede bonita solo se sabe escuchando.

### La semana

- **Lunes:** revisión de `docs/CALENDARIO.md` §3 y la de reciclaje (§4 de este documento). Si se tocó un nivel del 6 al
  25, corre `validar.cjs`: te dice qué Retos cambiaron.
- **Por lotes de formato:** las frases de la semana en una tarde, los episodios en otra. Los Retos, como mucho 2 días
  antes de su fecha.
- **Domingo por la tarde en Lisboa:** programa la semana en TikTok Studio (web) y en Meta Business Suite. La franja de
  la noche cae entre la 01:00 y las 02:30 de Lisboa: siempre va programada. TikTok programa hasta unos 10 días antes
  (confírmalo en tu cuenta).
- **Al subir cada video con voces:** la etiqueta de IA en TikTok e «Información de IA» en Instagram.
- **Al subir cada episodio:** fija en él «Ep. anterior» y edita el comentario fijado del episodio anterior para que diga
  «Ep. siguiente». El tráiler fijado en el perfil (D01-2) explica el orden.
- **No se programan:** las respuestas con «responder con video» (D15-2), que van a las 13:30 de México (19:30 en
  Lisboa). Los videos condicionales se programan solo después del martes de despliegue.
- **El mismo día en las dos redes.** `docs/CRECIMIENTO.md` §2 y `docs/CALENDARIO.md` §4 (paso 11) sugieren subir a
  Reels al día siguiente. Aquí va el mismo día porque los Retos, Halloween y los estrenos pierden valor un día después.
  Si prefieres la regla de esos documentos, corre un día la columna de Instagram, menos esos videos.

## 8. Límites

- No pude escuchar nada: voces y música se juzgan escuchando.
- La duración de cada voz es una estimación: 11,5 caracteres por segundo, el ritmo de la voz más lenta de las 47 líneas
  medidas en `dist/estudio/voz-cache/` (la media es 14,2). El ritmo real solo se confirma generando las voces. Al armar
  cada guion, pasa `g.fin` a `duracion_s`.
- La reportera no tiene voz en `tools/video/voz/voces.json`. Hay que crearla antes del viernes 30; si no sale bien,
  presenta el narrador.
- Las métricas, los conteos de votos, el ranking y GA4 no los veo si no me los pasas. Los videos que dependen de eso
  traen alternativa.
- Las escenas de los capítulos 7 y 8 todavía no existen en `js/story.js`: sus videos están descritos sin inventar su
  contenido y se terminan cuando el capítulo esté escrito. Al escribirlas, pásalas de `escenas_por_escribir` a
  `escenas` (o a `lineas`) y `validar.cjs` medirá si caben.
- Los horarios salen de listas de agencias (no de datos de esta cuenta). Después de dos semanas, mueve una hora la
  franja con peor mediana.
- Las listas de reproducción de TikTok no tienen una política oficial publicada: por eso la serie no depende de ellas.
- Los datos del Reto usan `js/core/levels.js` tal como está el 17 de octubre de 2026.
