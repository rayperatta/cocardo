# Calendario de capítulos nuevos: cuándo se abren, cómo se deciden y cómo se publican

Fecha: 17 de octubre de 2026 (sábado; el juego lleva tres días publicado en https://cocardo.app). Este documento es el
plan vivo de los **capítulos 7 a 24** (niveles 31 a 120, temporadas 2 a 4): el calendario, las reglas para acelerar o
frenar según el recibimiento de los jugadores, el procedimiento para construir y subir cada capítulo, y la bitácora.
Lo que el jugador ve (zonas «en construcción» con fecha en el mapa) sale de `js/core/roadmap.js`; el contrato técnico
está en `docs/ARQUITECTURA.md` §17.

Se escribió con tres planes independientes (datos y live-ops, producción indie, marketing en TikTok e Instagram) y dos
jueces, más una investigación de cómo lo hacen Candy Crush, Royal Match, Toon Blast, Homescapes y los estudios indie.
Las fuentes y el detalle están en §7.

## 0. Resumen

- **Hoy** hay 30 niveles (temporada 1, el canon de la serie) y el mapa sigue hacia arriba con 18 capítulos en obra:
  nodos fantasma 31-120, cinta amarilla, nombre, teaser y fecha prevista. Tocar uno abre la ficha del capítulo.
- **Capítulo 7, «Cherry… interesante», se abre el viernes 30 de octubre de 2026** a la medianoche local de cada jugador.
  Es la única fecha con día exacto. Los capítulos 8-18 se anuncian por **mes** y la temporada 4 por **año**: una fecha
  pública se lee como promesa, así que solo se promete el día cuando el capítulo ya está construido y desplegado.
- **Ritmo base:** un capítulo (5 niveles, el 5.º jefe) cada **dos viernes** mientras dure la ola del lanzamiento
  (capítulos 7, 8 y 9), después cada **tres semanas** (10-18) y cada **tres o cuatro** en la temporada 4. Nunca semanal:
  es el patrón de agotamiento de los indies y no deja tiempo para leer datos.
- **Las reglas de §3 mandan sobre el calendario:** cada lunes se miran seis números (fallo por nivel, abandono, cuántos
  están al final, retención D7, Reto Diario, toques en la zona en obra) y de ahí sale una sola decisión: acelerar,
  mantener, frenar, arreglar o pausar. Las fechas por mes se mueven sin que nadie lo note; la de día exacto no se mueve.
- **Colchón:** cuando abre el capítulo N, el N+1 ya debe estar construido (balanceado y con pruebas en verde) y, de
  preferencia, desplegado oculto con su `opens`. Una semana mala consume colchón, no rompe fechas.
- **Antes del 30 de octubre hay cuatro cosas que hacer una sola vez** (§5): subir las reglas de Firestore ampliadas,
  activar GA4, publicar esta versión del juego y construir el capítulo 7 con el procedimiento de §4.

## 1. Cómo funciona en el juego

Dos listas distintas, un solo mapa:

| Dónde | Qué es | Estado en el mapa |
|---|---|---|
| `Cocardo.Levels.chapters` (`js/core/levels.js`) | capítulos **construidos** (sus niveles existen). Pueden llevar `opens: 'YYYY-MM-DD'`. | `abierto` (sin fecha o fecha cumplida) · `programado` (fecha por llegar: nodos con candado de calendario, ficha «¡Muy pronto!» con «faltan N días») |
| `Cocardo.Roadmap.planned` (`js/core/roadmap.js`) | capítulos **en construcción** (sin niveles). Nombre ≤ 26, teaser ≤ 70, zona, color, `opens`. | `construccion` (zona oscura con cinta de obra, nodos fantasma, «Se abre el viernes 30 de octubre» / «Previsto para noviembre» / «Previsto para 2027») · `retrasado` (la fecha pasó y no hay niveles: «En construcción · ¡ya casi!», nunca la fecha vieja, con botón «Actualizar») |

Reglas que el código ya garantiza:

- **La fecha se compara con la fecha local del jugador** (clave `YYYYMMDD`, la misma del Reto Diario): el capítulo abre a
  la medianoche de cada quien, con o sin internet, y el juego no promete horas ni zonas horarias. En redes se dice «a
  medianoche, tu hora», nunca una hora concreta.
- **Día exacto solo a menos de 6 semanas** (`tests/roadmap.test.js` lo exige) y, por política, solo para el siguiente
  capítulo. `'YYYY-MM'` se muestra como «Previsto para <mes>» y `'YYYY'` como «Previsto para <año>».
- **Un capítulo programado tapa a los que vengan después** (`Roadmap.openCount`): no se puede jugar el 36 aunque el
  capítulo 8 no tenga fecha, si el 7 todavía está cerrado.
- **El guardado ya mide 120 niveles** (`Roadmap.MAX_LEVELS`): añadir capítulos nunca migra el guardado ni la nube.
  `unlocked` puede apuntar al nivel 31 antes de que exista; el mapa lo limita a lo jugable hoy.
- **Lo que pasa al terminar el último nivel abierto:** la Victoria dice «Continuar» (o «¡Ver el final!» en el 30), el mapa
  sube hasta el siguiente capítulo y muestra su rótulo con la fecha; tras «¿Segunda temporada…?» aparece la tarjeta
  «Capítulo 7: se abre el viernes 30 de octubre». El aviso inferior del mapa pasa de «Próximo rescate» a «Capítulo 7 en
  construcción · Se abre el…». El día de apertura, un aviso único «¡Capítulo 7 abierto!» lleva al nivel 31.
- **Medición:** cada toque en una zona en obra o en un capítulo programado manda `roadmap_tap { chapter, state, days,
  built }` a GA4. Es la señal directa de cuánta gente espera más niveles (§3, regla 4).

Herramientas:

```bash
node tools/calendario.js                   # qué ve el jugador hoy, siguiente apertura y avisos (sale con 1 si hay algo que arreglar)
node tools/calendario.js --hoy 2026-10-30  # lo mismo para otra fecha (p. ej. el día del estreno)
node tools/calendario.js --md              # tabla en Markdown para pegar en la bitácora
```

En el navegador, con `#debug` en la dirección: `Cocardo.debug.today(20261030)` simula esa fecha local (el mapa se
vuelve a pintar; `today(null)` vuelve a hoy), `Cocardo.debug.roadmap()` da los capítulos con su estado,
`Cocardo.debug.openCount()` el último nivel jugable y `Cocardo.debug.showRoadmap(7)` abre la ficha.

**Para cambiar una fecha:** edita `opens` del capítulo en `js/core/roadmap.js` (o en `Levels.chapters` si ya está
construido), corre `node --test tests/roadmap.test.js` y `node tools/calendario.js`, sube `VERSION` en `sw.js` y publica
(`git push` a `main`). El service worker es «red primero»: quien abra el juego con internet ve el cambio en esa misma
sesión; la app instalada sin red lo ve en la siguiente apertura con conexión.

## 2. Calendario base

Siempre **viernes**, apertura a medianoche local. «En el mapa» es lo que ve el jugador hoy; «objetivo» es la fecha
interna de trabajo, que pasa a día exacto en el mapa cuando el capítulo anterior ya abrió y este está construido.

| Cap. | Temporada | Nombre | Niveles | En el mapa hoy | Objetivo | Por qué ese día |
|---|---|---|---|---|---|---|
| 7 | 2 · El regreso de Cherry | Cherry… interesante | 31-35 | **viernes 30 de octubre de 2026** | 30 oct | 13 días: dos lunes de revisión (19 y 26) para arreglar los 3 niveles con más abandono de la temporada 1 antes de producir; fin de semana de Halloween con Cherry de ojos rojos (sin sustos ni Día de Muertos como gancho: todas las víctimas sobreviven). |
| 8 | 2 | Se renta local | 36-40 | Previsto para noviembre | 13 nov | Dos semanas: primer dato real de la cadencia. Se muestra el día exacto el 30 de octubre, cuando el 7 abra y el 8 ya esté construido (regla de colchón). |
| 9 | 2 | Visita en la cárcel | 41-45 | Previsto para noviembre | 27 nov | Último estreno quincenal (viernes de Black Friday: mucha pantalla en toda América). Punto de decisión con seis semanas de datos: seguir quincenal o pasar a tres semanas. |
| 10 | 2 | La sucursal | 46-50 | Previsto para diciembre | 18 dic | Tres semanas. Arranque de las vacaciones escolares en casi toda Latinoamérica: el pico anual de tiempo libre. Sin mecánica nueva (nadie arregla nada en Nochebuena). |
| 11 | 2 | Todas las unidades | 51-55 | Previsto para enero de 2027 | 8 ene | Tras Reyes, cuando la gente vuelve a la rutina y a TikTok. Construido y desplegado oculto **antes del 15 de diciembre**: del 20 de diciembre al 6 de enero no se produce nada; el calendario corre solo. |
| 12 | 2 | Se derrite el imperio | 56-60 | Previsto para enero de 2027 | 29 ene | Final de la temporada 2: nivel final tipo 30 (doble rescate, dos villanos) y guion de cierre («¿Tercera temporada…?»). Tres semanas sin capítulo después, para leer D7 y consumo de la temporada entera. |
| 13 | 3 · El pedido de Don Piña | Un hombre de palabra | 61-65 | Previsto para febrero de 2027 | 19 feb | La temporada 3 solo recibe meses en el mapa si la 2 cumplió las reglas 4 y 5 de §3. San Valentín (14 feb) y la semana después del Carnaval (6-9 feb) para el tráiler de temporada. |
| 14 | 3 | El guardaespaldas | 66-70 | Previsto para marzo de 2027 | 12 mar | Tres semanas. Se evita el 26 de marzo (Viernes Santo). |
| 15 | 3 | Helado de importación | 71-75 | Previsto para abril de 2027 | 2 abr | Justo después de Semana Santa (21-28 mar), que se usa para el teaser. Si la temporada 3 trae la única mecánica nueva de motor, se estrena aquí, a mitad, con tutorial. |
| 16 | 3 | La reportera | 76-80 | Previsto para abril de 2027 | 23 abr | Tres semanas; fin de semana largo del 1 de mayo en la mayoría de la región justo después. |
| 17 | 3 | El socio secreto | 81-85 | Previsto para mayo de 2027 | 14 may | Fuera del 10 de mayo (Día de las Madres en México). Formato «¿quién es el traidor?» para comentarios. |
| 18 | 3 | Quinientos litros | 86-90 | Previsto para junio de 2027 | 4 jun | Final de la temporada 3, antes de las vacaciones de mitad de año. Aquí se decide si existe la temporada 4 o el juego cierra con un final digno y pasa a mantenimiento (Reto Diario y ranking siguen). |
| 19 | 4 · La fuga de Cocardo | Luces | 91-95 | Previsto para 2027 | 2 jul | **Condicional**: solo si la temporada 3 conservó al menos la mitad de los activos semanales de la 2. Vacaciones de invierno en el Cono Sur y de verano en México. |
| 20 | 4 | Está experimentado | 96-100 | Previsto para 2027 | 23 jul | Nivel 100: hito publicable por sí mismo («100 niveles hechos por una sola persona»). |
| 21 | 4 | Prima al rescate | 101-105 | Previsto para 2027 | 13 ago | Lima y Fresa van por Cocardo. |
| 22 | 4 | Tres villanos | 106-110 | Previsto para 2027 | 3 sep | «Team Cocardo, Team Cherry o Team Piña» para comentarios. |
| 23 | 4 | La gran nevada | 111-115 | Previsto para 2027 | 24 sep | Un año después del pico de la serie original (finales de septiembre de 2026). |
| 24 | 4 | El último sabor | 116-120 | Previsto para 2027 | 15 oct | Gran final en la semana del primer aniversario del juego (14-17 oct). Es el tope `MAX_LEVELS = 120`: ir más allá exige subir el tope en `roadmap.js`, `firebase/firestore.rules` y `js/cloud.js`, y desplegar las reglas antes. |

Precisión de las fechas, por política:

1. **Día exacto:** solo el siguiente capítulo, y solo si está construido y desplegado oculto en `main` (hoy la excepción
   es el capítulo 7, que es el compromiso de arranque: 13 días, con la temporada 1 entera construida en un día como
   referencia de capacidad). Si el martes anterior al viernes no está desplegado, la fecha se corre **siete días** y el
   mapa vuelve a mostrar el mes; nunca se compensa con una semana de crunch.
2. **Mes:** el siguiente después del que tiene día (y toda la temporada en curso).
3. **Año:** las temporadas siguientes. Sus teasers no se publican en redes hasta que empiece cada temporada.
4. Un corrimiento con fecha de día visible cuesta más confianza que tres sin fecha. Si pasa, el mismo día sale un
   video de 10 segundos explicándolo: la gente perdona retrasos, no silencios.
5. Nunca una apertura el 25 de diciembre, el 1 de enero ni el Viernes Santo.

## 3. Reglas de recibimiento: cuándo acelerar, mantener, frenar, arreglar o pausar

Se aplican **cada lunes, en 30 minutos y en este orden**; la primera que se dispare decide. Fuentes: GA4 (eventos
`level_start`, `level_end` con `level`, `won`, `moves_used`, `moves_left`; `daily_end`; `share`; `clip`; `referral`;
`roadmap_tap`; informe de retención por cohortes) y Firestore (`users` con `levels`, `stars`, `finished`, `updatedAt`;
`daily/{día}/scores`). Si GA4 no está activo (`ga4` vacío en `js/cloud-config.js`), activarlo es la primera tarea: sin
eventos ninguna regla se puede aplicar y ningún capítulo pasa a día exacto.

| # | Regla | Métrica | Umbral | Acción |
|---|---|---|---|---|
| 0 | **Muestra mínima** (no decidir con ruido) | usuarios únicos con `level_start` en el nivel, 7 días, sin `daily` ni `practice` | menos de 50 usuarios o menos de 7 días de datos | **Mantener.** Solo se anota. «Lo que parece abandono puede ser una pausa.» |
| 1 | **Nivel atascado** (arreglar dificultad) | fallo = 1 − `level_end(won)` / `level_end` por nivel, 7 días; apoyo: mediana de `moves_left` en las victorias | normal > 65 % (≈3 intentos) · ⚠ o jefe > 80 % (≈5) · o fallo > 50 % con mediana de `moves_left` = 0 (se gana raspando) | **Arreglar en ≤ 48 h:** `node tools/sim.js N --seeds 300 --sweep`, +2 movimientos (o una unidad menos de frecuencia del villano), validar con `--offset 300`, `VERSION` en `sw.js`, push. Máximo 2 ajustes por nivel al mes. Nunca se quitan movimientos a lo ya publicado. |
| 2 | **Fuga por nivel** (arreglar el embudo antes de producir) | abandono = 1 − usuarios con `level_start(N+1)` / usuarios con `level_end(won)` en N, 14 días | > 40 % en cualquier nivel (ya en `docs/CRECIMIENTO.md` §2) · > 25 % en los niveles 1-5 o en los tres primeros de un capítulo nuevo | **Arreglar ese nivel** (movimientos, tutorial, escena larga) antes de construir el siguiente capítulo. Si la fuga está en el capítulo recién abierto, el siguiente se corre una semana (si aún se mostraba por mes, nadie lo nota). |
| 3 | **Retención D7** (el ritmo base) | GA4 → Retención, cohorte semanal de nuevos usuarios (n ≥ 50; con menos, usar los activos de Firestore y esperar), día 7; también D1 | ≥ 14 % bueno para match-3 · 5-14 % mediana · < 5 % dos cohortes seguidas: alarma · D1 < 25 %: la primera sesión falla | ≥ 14 %: cadencia quincenal (si la regla 4 también lo pide). 5-14 %: mantener. < 5 %: **pausar** la construcción del capítulo siguiente al ya construido y dedicar la quincena a los 3 niveles con más fuga, al aviso de instalar y al Reto Diario; retomar al volver a ≥ 8 %. D1 < 25 %: no acelerar aunque la 4 lo pida. |
| 4 | **Hambre de contenido** (acelerar) | llegada al final = usuarios con `level_end(won)` en el último nivel abierto / usuarios con `level_end(won)` en el nivel 10, 14 días; apoyo: `roadmap_tap` del siguiente capítulo por usuario activo diario y comentarios «¿cuándo sale?» | ≥ 25-30 % de llegada y ≥ 0,3 toques por activo diario (o ≥ 20 comentarios a la semana pidiendo fecha) · < 10 %: nadie espera, el problema está antes | **Acelerar:** quincenal firme; si el N+1 ya está construido y oculto, adelantar su `opens` hasta 7 días (**nunca a menos de 14 días del anterior**: el ritmo semanal no existe) y comunicarlo como buena noticia. < 10 %: frenar a 4 semanas y arreglar primero las reglas 1 y 2. |
| 5 | **Pulso del Reto Diario** (el entre-capítulos) | documentos en `daily/{día}/scores` o `daily_end(practice=false)` por día, media móvil de 7 días frente a la semana de lanzamiento (17-23 oct) | ≥ 50 % del lanzamiento: mantener · 25-50 % dos semanas seguidas sin capítulo nuevo: frenar · < 25 % dos semanas seguidas y activos semanales < 20 % del pico: pausar | Cae: adelantar una semana el siguiente capítulo ya construido y publicar la historia diaria `?go=daily` con el ganador. Sube ≥ 20 % la semana de un estreno: mantener día y hora. Si el Reto no se mueve con las aperturas, el video no llega: cambiar el formato del video, no la cadencia. Pausar = el capítulo construido abre en su fecha; los siguientes pasan a «En construcción» sin fecha y sale un video de 10 s «estoy arreglando el juego antes de seguir». |
| 6 | **Consumo del capítulo nuevo** (calibrar tamaño y dificultad, a las 72 h) | % de perfiles `finished` con `level_start` en el primer nivel nuevo; % que ganan el jefe nuevo en 7 días; % que terminan los 5 en 48 h; fallo real por nivel frente al % del bot de `sim.js` | llegada < 25 %: problema de aviso · ≥ 60 % terminan los 5 en 48 h: corto o fácil · < 30 % ganan el jefe en 7 días: duro · real < bot − 15 puntos en 2 niveles: el bot engaña | Aviso: arreglar el rótulo, el toast y el texto de compartir, no la cadencia. Corto: siguiente capítulo con un ⚠ más y jefe con `aim` 45 % en `sim.js`. Duro: +2 movimientos al jefe (hotfix con `VERSION`). Bot engaña: rebalancear el capítulo y bajar 5 puntos el `aim` del siguiente. |
| 7 | **Pico social** (surfear sin romper el plan) | GA4 nuevos usuarios por día y `referral`; `share` y `clip` por 100 `level_end`; vistas y comentarios del video de estreno a 48 h frente a la mediana de los videos de lanzamiento (con `?utm_source=tiktok&utm_medium=bio` en el enlace de la bio) | un día con ≥ 3× la mediana de nuevos y ≥ 200 nuevos; o vistas ≥ 2× mediana y nuevos ≥ 1,5× · bajo: video < 2.000 vistas y < 20 comentarios | Alto: acelerar la **comunicación** (countdown del capítulo ya construido, historia del Reto, responder comentarios en video, dúo con el video que trajo gente) y, si hay colchón, adelantar su fecha respetando 7 días. Bajo: cambiar el gancho (`docs/VIDEOS.md` §3), no la cadencia; el siguiente video sale en dos variantes. |
| 8 | **Capacidad del equipo** (frenar antes de incumplir) | ¿el N+1 pasa `sim.js` + `npm test` 7 días antes de abrir N? ¿está desplegado oculto el martes anterior? horas semanales (videos incluidos) | no, una vez: +7 días (el mapa seguía en mes) · no, dos veces seguidas, o > 15 h/semana dos semanas: la cadencia baja un escalón (2 → 3 → 4 semanas) | **Frenar:** actualizar `opens` a mes, publicar un post transparente de dos líneas («el capítulo X llega la semana del…»), nunca compensar con crunch. Diciembre y vacaciones cuentan como corrimiento planeado, no como fallo. |
| 9 | **Completistas** (el «mientras tanto» funciona) | Firestore: % de perfiles `finished` con `stars` ≥ 80 de 90; apoyo en GA4: `level_start` con `attempt` > 1 en niveles ya ganados (GA4 no marca «práctica» en la campaña) | ≥ 15 % repiten por 3★ o ya tienen ≥ 80 estrellas · < 5 % | ≥ 15 %: mantener (no hace falta acelerar) y hacer el siguiente video sobre las 90 estrellas y el ranking. < 5 %: antes de más niveles, una recompensa visible por capítulo con 15★ (carta del álbum o insignia), para que la espera tenga algo que hacer. |
| 10 | **Relojes adelantados** (vigilar, no castigar) | Firestore: perfiles activos (`updatedAt` < 14 días) con `levels` mayor que el último nivel abierto para la fecha | > 2 % de los activos | No bloquear ni borrar: en un juego gratis sin compras el tramposo solo se arruina su estreno. Si pasa del 2 %: topar en el ranking las estrellas visibles a 3 × niveles abiertos hoy y, antes de la temporada 3, anclar `opens` a la cabecera `Date` de una petición cuando hay red (solo para retrasar, nunca para adelantar; el juego sigue funcionando sin red). |

Qué se anota cada lunes en la bitácora (§8): fecha, activos semanales, nuevos, D1/D7 de la cohorte, los 3 niveles con
más fallo y los 3 con más fuga, `daily_end` medio, toques en la zona en obra, vistas del último video, y una sola línea de
decisión («mantener 13-nov», «+7 días el 8», «hotfix L33 +2 movimientos»).

## 4. Procedimiento para construir y publicar un capítulo

Costo real estimado: **12-16 horas por capítulo** (el 7, unas 20 por arrastrar lo que falte de herramientas): diseño de
los 5 niveles 2-3 h, balance con el bot 1-2 h, guion y textos 2-3 h, pruebas 1 h, prueba manual en dos teléfonos 1,5 h,
video de estreno 2-3 h, despliegue y verificación 1 h. Dos tardes y un día de fin de semana cada dos semanas durante seis
semanas es sostenible; cada tres semanas es cómodo. Máximo **una mecánica nueva de motor por temporada** (es otro
proyecto de 1-2 días con pruebas del motor); el resto de la novedad sale de combinar hielo, escarcha, cajas, fichas y
congeladores con dueños nuevos. Cero personajes nuevos (el reparto son los 16 de `docs/PERSONAJES.md`).

Con D = viernes de apertura:

1. **D−14, lunes: diseño.** Elegir el giro del capítulo (qué villano manda, qué combinación de obstáculos, el ⚠, el jefe).
   Escribir los 5 niveles en `js/core/levels.js` con `L({...})`: ids seguidos, nombre ≤ 28 caracteres y único,
   `boss: true` en el 5.º (el mapa y las escenas lo dan por hecho), un `hard` por capítulo, movimientos 24-32, metas de
   color cortas (≤ 30), el amigo congelado del jefe encajado tras hielo grueso. Añadir el capítulo a `Levels.chapters`
   con `name`, `zone` (una zona que `Art.background` sepa pintar: ver `zoneKey` en `js/art.js`), `color`, `levels` y, de
   momento, **sin** `opens` (se pone al desplegar).
2. **D−12 a D−10: balance.** `node tools/sim.js 31 32 33 34 35 --seeds 300 --sweep` hasta que cada nivel caiga en su
   banda (normal 60-85 %, ⚠ y jefe 40-60 %, bot débil ≥ 30 %, 3★ del jefe ≤ 15 %), ajustando solo movimientos o la
   cuenta del villano; `--try` para comparar variantes sin tocar `levels.js`; validar con semillas limpias
   `--seeds 300 --offset 300` (si cambia más de 6 puntos, repetir). Guardar la tabla `--md` en la bitácora: es la
   «curva del bot» que se compara con el fallo real a los 7 días (regla 6). Los objetivos de `tools/sim.js` ya no bajan
   sin fin para los capítulos 7+: se quedan en los del capítulo 6.
3. **D−10 a D−8: guion y textos** en `js/story.js`: `pre` de cada nivel, `post` donde haya rescate, `cliff` en el jefe
   (que termine en `CONTINUARÁ…` o, en el 12, 18 y 24, en `FIN DE LA TEMPORADA n`), 2-6 líneas por escena de ≤ 90
   caracteres, en boca de quien puede decirlas; `tips` de los 5 niveles (`tipFor` los pide); `VILLAIN`, `helperFor` y
   `hintPeeker` si el capítulo cambia de villano o de consejero (por defecto Cocardo y Banano). Continuación propia del
   juego: **nunca** «Parte 14», nunca «oficial», nunca las continuaciones de fans de la serie (Cherry embarazada, Nueva
   York…), ángulo de rescate, villanos cómicos. Nombre y teaser del capítulo en `Roadmap.planned` también cuentan.
4. **D−8: pruebas.** `npm test` (`tests/levels.test.js` ya acepta capítulos 7+: lo cerrado del canon se comprueba
   hasta el 30) y `node tests/e2e.cjs --quick` si hay Playwright. En el navegador con `#debug`:
   `Cocardo.debug.today(20261029)` (víspera: «Se abre mañana», nodos no jugables), `today(20261030)` (abre, toast,
   el aviso apunta al siguiente), `today(20261031)` sin el capítulo (estado «retrasado»). `node tools/calendario.js`
   sin avisos.
5. **D−7, fin de semana: prueba manual** en un Android barato y un iPhone: los 5 niveles, HUD con el villano correcto,
   tutorial solo si hay mecánica nueva, consejo, tarjeta `CONTINUARÁ…` sin cortes, álbum sin spoilers. Material de video:
   `node tools/record.cjs --level 35 --mp4` y las tomas de `tools/video/`.
6. **D−7, en paralelo: colchón.** El capítulo N+1 por lo menos diseñado y balanceado (pasos 1-2). Regla: N no abre si
   N+1 no pasa `sim.js` + pruebas en local.
7. **D−3, martes: datos de apertura.** `opens: 'YYYY-MM-DD'` (el viernes) en la entrada de `Levels.chapters` (la entrada
   de `Roadmap.planned` puede quedarse: manda la de Levels); el siguiente capítulo en `Roadmap.planned` queda por mes.
   `VERSION` en `sw.js` (una versión menor por capítulo: `cocardo-v1.3.0` para el 7) y `CORE` si hubo archivos nuevos.
   Fila nueva en `docs/DISENO.md` §7 y en la tabla de §2. Si cambió `MAX_LEVELS` (no hasta el 25): reglas de Firestore
   **antes** del push.
8. **D−3: despliegue oculto.** `git push origin main`; GitHub Pages tarda 1-2 min; purgar la caché de Cloudflare de los
   `.js` si `www` sigue con proxy. En ventana privada en https://cocardo.app: el mapa dice «Se abre el viernes…», el
   nivel 31 no abre, la ficha muestra teaser, días que faltan y los botones «Reto de hoy» y «Avisar a un amigo»; con la
   fecha adelantada (DevTools → Sensors → Override date, o `debug.today`) abre y la historia corre. En el teléfono con la
   app instalada, cerrar y abrir dos veces para que el service worker tome la versión. **Solo a partir de aquí** se
   menciona la fecha en redes.
9. **D−3 a D−2: prueba cerrada** con 5-10 jugadores del ranking (adelantan la fecha a propósito): el miércoles por la
   noche mirar sus `level_end` de 31-35; si un nivel supera 85 % de derrota en esa muestra, +2 movimientos el jueves con
   nuevo `VERSION` (todavía nadie lo vio).
10. **D−2 y D−1: redes.** Miércoles 19-21 h de Ciudad de México: video «ya tiene fecha» con el mapa y la zona en obra,
    comentario fijado con el enlace de la bio. Jueves: historia o teaser «a medianoche, tu hora, se abre el capítulo N»
    con la escena `cliff` del capítulo anterior; nunca una hora concreta, nunca spoilers del nuevo. Dejar programado en
    Postiz (`redes/`) el video de estreno. Texto de cada post: gancho + pregunta + «Juego de fans, no oficial» + 4-6
    etiquetas (`docs/VIDEOS.md` §6).
11. **D, viernes: estreno.** No hay nada que desplegar: abre solo a la medianoche local. A primera hora, abrir el juego en
    un teléfono real y confirmar que GA4 recibe `level_start` con `level = 31`. 13-14 h de Ciudad de México (19-20 h en
    Lisboa; toda América ya pasó la medianoche): video de estreno en TikTok. Mirar GA4 en tiempo real una hora. Sábado:
    el mismo archivo en Reels y Shorts (al día siguiente, nunca el mismo día). Ventana de hotfix: sábado por la mañana;
    nada se toca después hasta el lunes.
12. **D+1 a D+3:** responder comentarios en video; cada noche `level_end` de 31-35 (reglas 1 y 2); hotfix en ≤ 48 h con
    `VERSION` si se dispara una regla.
13. **D+5, miércoles:** video «solo el X % pasó el nivel N» con el dato real (nivel ya corregido si hizo falta) y la
    historia del Reto Diario con el ganador etiquetado.
14. **D+7, lunes siguiente: retrospectiva de 30 minutos.** Llenar las reglas con números en §8, decidir si el siguiente
    va a 2, 3 o 4 semanas y si su entrada pasa de mes a día exacto (solo si ya está desplegado oculto). Arrancar el ciclo
    del N+2 solo si el N+1 ya está oculto en `main`.
15. **Fin de temporada (capítulos 12, 18 y 24):** además, guion de cierre (`cliff60` con `FIN DE LA TEMPORADA 2` y
    «¿Tercera temporada…?»), tráiler de temporada el martes anterior y una decisión con 10 semanas de datos: la
    siguiente temporada se anuncia (pasa de año a meses en el mapa), se retrasa o el juego pasa a mantenimiento con
    aviso (el Reto Diario y el ranking siguen).

**Diciembre:** los capítulos 10 y 11 se construyen, balancean y despliegan ocultos antes del 15 de diciembre
(`opens` 2026-12-18 y 2027-01-08 en los datos) y sus videos quedan programados; del 20 de diciembre al 6 de enero no se
produce nada.

## 5. Antes del capítulo 7: la semana 0 (18 al 24 de octubre)

1. **Subir las reglas de Firestore ampliadas** (ya cambiadas en `firebase/firestore.rules`: 120 niveles, 360 estrellas):
   `cd firebase && firebase deploy --only firestore:rules` (`docs/FIREBASE.md` §4). Las reglas **no** viajan con
   `git push`; sin esto, el perfil de quien pase del nivel 30 con cuenta se rechaza y su progreso deja de subir.
   Comprobar en la consola de Firebase que la versión vigente es la nueva.
2. **Activar GA4** (`ga4` en `js/cloud-config.js`; hoy está vacío) y registrar como dimensiones personalizadas de evento
   `level`, `chapter`, `won`, `attempt`, `state` y `built`: sin eso las exploraciones de GA4 no filtran por parámetro y
   ninguna regla por nivel se puede calcular. Añadir `?utm_source=tiktok&utm_medium=bio` (y `instagram`) a los enlaces
   de la bio. `level_start` y `level_end` ya mandan `attempt` (intentos seguidos del mismo nivel en la sesión) y `chapter`.
3. **Publicar esta versión** del juego (`VERSION` ya es `cocardo-v1.2.0`): el mapa con los capítulos en obra, la fecha
   del 7 y el guardado de 120 niveles. Comprobar en https://cocardo.app que el aviso inferior dice «Capítulo 7 en
   construcción · Se abre el viernes 30 de octubre» para quien terminó el 30.
4. **Lunes 19 y 26 de octubre:** primera y segunda revisión (§3) sobre la temporada 1: arreglar los 3 niveles con más
   fuga antes de producir más.
5. **Del 19 al 25 de octubre:** construir el capítulo 7 con §4 (pasos 1-5); **martes 27:** despliegue oculto con
   `opens: '2026-10-30'`; **miércoles 28 y jueves 29:** videos de fecha y teaser; **viernes 30:** estreno.
6. En paralelo, el capítulo 8 **al menos diseñado** para el 30 de octubre; balanceado y con pruebas en verde el lunes 2 de
   noviembre y desplegado oculto el martes 3 (objetivo 13 de noviembre). Construir 7 y 8 enteros en doce días con trabajo
   de día sería crunch: si el 8 no llega, el 7 abre igual y el 8 sigue mostrándose por mes.

## 6. Temporadas 2 a 4: esbozo de historia y novedades jugables

(Se completa con el esbozo elegido por el juez de canon; ver §7.)

## 7. Decisiones tomadas, riesgos y fuentes

**Decisiones.**

- *Fecha local, no servidor.* Igual que el Reto Diario; sin red el juego sigue igual y nadie espera 3 horas más por
  vivir en Buenos Aires (lección de Wordle frente a Nerdle). Adelantar el reloj del teléfono abre antes: aceptado (regla
  10) porque no hay economía que dañar; el ranking puede topar estrellas si hace falta.
- *Día exacto solo para lo siguiente.* Balatro («no debí anunciar ninguna fecha») y Star Citizen («toda fecha se lee
  como promesa»). El estado «retrasado» nunca muestra una fecha vencida.
- *Cuenta regresiva en días, no en horas.* Un reloj con segundos en un juego gratis se lee como urgencia falsa; «faltan
  N días», «falta 1 día», «¡Se abre hoy!».
- *Quincenal solo al principio.* Los grandes publican 15-100 niveles por semana con equipos de decenas de personas;
  para una persona, un capítulo cada 2-4 semanas es lo comparable, y las guías indie marcan «semanal» como agotamiento.
- *El «mientras tanto» ya existe:* Reto Diario, 3 estrellas por capítulo y ranking son el modo infinito; la ficha del
  capítulo cerrado siempre ofrece «Reto de hoy» y «Avisar a un amigo» (la única notificación posible sin permisos, y
  cada aviso lleva `?r=apodo`: la espera genera referidos).
- *El Reto Diario no cambia de piscina* (niveles 6-25) en la temporada 2: ampliarla cambiaría el tablero del día según
  la versión que tenga cada jugador y rompería el «mismo tablero para todos». Si se amplía, con un corte por clave de
  fecha futura.
- *Mapa completo con 18 capítulos en obra.* Es lo pedido («muchísimos más niveles») y vende la escala. Si el
  recibimiento cae y el mapa empieza a parecer un cementerio de conos, la palanca es barata: pintar solo la temporada en
  curso y un único letrero por temporada futura (quitar de `Roadmap.planned` lo que no se vaya a construir; el mapa se
  ajusta solo).

**Riesgos y mitigación.**

| Riesgo | Mitigación |
|---|---|
| Reglas de Firestore sin subir el 30 de octubre: los perfiles con `levels > 30` o `stars > 90` se rechazan en silencio y el ranking se congela para los mejores. | Paso 1 de §5, esta semana. `tools/calendario.js` avisa si el tope de las reglas no coincide. |
| Caché vieja el día del estreno: una PWA instalada sin abrir en días puede tener un `levels.js` sin el capítulo y ver «¡ya casi!». | Despliegue oculto ≥ 3 días antes, `VERSION` nueva, purga de Cloudflare, botón «Actualizar» en la ficha del estado retrasado. |
| Fecha incumplida. | Día exacto solo con el capítulo desplegado; colchón de un capítulo; +7 días y volver a mes; video de 10 s el mismo día. |
| Agotamiento de una sola persona. | Cadencia que baja sola (regla 8), pausa de fiestas ya calendarizada, una mecánica de motor por temporada, cero personajes nuevos. |
| Balance a ciegas (GA4 solo trae ganado/perdido). | Reglas 1, 2 y 6 con muestra mínima; comparar siempre con la curva del bot guardada en la bitácora; añadir `attempt` (intentos acumulados) a `level_start`/`level_end` cuando haga falta medir la cola larga. |
| Canon y tono: la temporada 2 no es la serie. | Rótulo «Historia original del juego de fans · no oficial» en la ficha y en los videos; nunca «Parte 14»; ángulo de rescate; arte y sonido propios. |
| Cinta de contenido sin fin. | La temporada 4 es condicional; la 3 tiene un final digno; la regla 5 define cómo se anuncia una pausa sin perder la cara. |

**Fuentes consultadas (octubre de 2026).** Cadencias: Candy Crush Saga (30-60 niveles cada miércoles; pocketgamer.com,
cubix.co), Royal Match («100 new levels… every two weeks», notas de versión en apkmirror.com), Toon Blast (50 cada dos
semanas, gamerevolution.com), Homescapes (≈15 cada jueves o viernes, pocketgamer.com), Tactile Games (cinco años de
lanzamientos semanales sin saltar uno, tactilegames.com), Room 8 Studio (40-80 niveles al mes por cliente,
room8studio.com), Playrix (una o dos mecánicas por actualización, gameworldobserver.com). Fin de contenido y
«próximamente»: sala de espera de Candy Crush y bloqueo de 72 h entre episodios (candycrush.fandom.com), «foreshadowed
content» en los cinco match-3 con mejor D30 (pocketgamer.biz, data.ai Q3-2021), «content treadmills»
(deconstructoroffun.com). Señales: SayGames sobre métricas por nivel (pocketgamer.biz), GameAnalytics 2026 (D7 mediana
< 4 %, top 10 % 11-12 %; guía de match-3). Indies y fechas: Balatro (pocketgamer.biz), StraySpark LiveOps para indies,
Star Citizen (techspot.com), Roblox LiveOps Essentials. UX de fecha: Wordle frente a Nerdle (nerdschalk.com), countdowns
falsos (ACM, barrido CPC 2023), reloj del teléfono (talsec.app, DEF CON 2011).

## 8. Bitácora

Una línea por lunes y una ficha por estreno. Empieza vacía.

| Fecha | Activos 7 d | Nuevos 7 d | D1 / D7 | Fallo top 3 | Fuga top 3 | daily_end/día | roadmap_tap | Video (vistas 48 h) | Decisión |
|---|---|---|---|---|---|---|---|---|---|
| 2026-10-19 | | | | | | | | | |
| 2026-10-26 | | | | | | | | | |

Ficha de estreno (una por capítulo): curva del bot (`sim.js --md`), usuarios en las primeras 72 h, fallo real por nivel
frente al bot, % que terminó los 5 en 48 h, vistas y comentarios del video, decisión sobre la fecha del siguiente.
