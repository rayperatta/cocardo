# Cocardo: ¡Rescate Helado!

Minijuego web de puzzle (match-3, al estilo de Candy Crush y Royal Match) inspirado en la frutinovela viral
**La Nieve de Lima**, la de Cocardo y su heladería *Coco's Scoops*. Funciona en teléfonos y computadoras,
sin instalar nada.

> Juego de fans, no oficial. Los personajes, nombres y frases vienen de la serie original de 13 partes de
> **@frutitaenlatada** (la cuenta original **@frutasalocadas** fue suspendida). Todo el arte del juego está
> redibujado en vectores; no usa imágenes ni audio de los videos.

## De qué se trata

Cocardo descubrió que su congelador viejo hace el helado más rico del mundo… con frutas adentro. Don Piña
quiere 500 litros por sabor, Cherry quiere un imperio y Banano busca a su hermana. Tú eres el ayudante secreto
que descongela a las víctimas mientras la historia avanza igual que en la serie.

- **30 niveles en 6 capítulos** que siguen el orden de la serie: *La nieve de Lima*, *Necesitamos un nuevo
  sabor*, *Voy a ampliar el menú*, *Cherry conoce el negocio*, *La fuga* y *Se acabó el sabor*.
- **Escenas de historia con frases reales** de la serie, cliffhangers de «CONTINUARÁ...» y el final de temporada.
- **16 personajes** con su aspecto de la serie: Cocardo, Lima, Cherry, Don Piña, Banano, Banana, Fresa,
  Durazna, Uva y Naranja, más Limón, la oficial, el oficial Sandía, el guardaespaldas, el repartidor y la
  reportera. La investigación del reparto, con sus fuentes, está en `docs/PERSONAJES.md` y `docs/investigacion/`.
- **Reto Diario**: el mismo tablero para todos cada día, con racha y resultado para compartir con emojis.
- **Álbum** de personajes: las víctimas aparecen congeladas hasta que las rescatas.
- **Cuenta con Google** (opcional): apodo y avatar, progreso en la nube y **ranking** del Reto Diario y por
  estrellas. También «Jugar con apodo» sin cuenta. Activación en `docs/FIREBASE.md`.
- **Clips 9:16**: con «Grabar clips» cada partida queda en video vertical con marca de agua, listo para TikTok,
  Reels o Shorts, y se comparte desde la pantalla de Victoria o Derrota.
- **App instalable** (PWA) que funciona sin conexión, vista previa al compartir enlaces y enlaces de invitación
  (`?r=apodo`).

## Cómo se juega

- **Desliza** una fruta hacia una vecina (o toca una y luego la otra) para juntar 3 o más iguales.
- Cumple las metas del nivel antes de quedarte sin movimientos: juntar sabores, romper hielo, romper las cajas
  del inventario de Cherry, bajar fichas (Uva fugitiva, las pruebas de Banano) o destruir el congelador.
- **Especiales:** 4 en línea hace una **Paleta** (limpia fila o columna), una L o T hace una **Bomba de Coco**
  (explota 3×3) y 5 en línea hace una **Copa Arcoíris** (se lleva todo un sabor). Cambia dos especiales entre sí
  para un combo.
- **Villanos:** Cocardo congela fichas y Cherry las convierte en cajas cada pocos turnos (mira su cuenta
  regresiva arriba).
- **Potenciadores:** Cucharón (nivel 7), Chorro de Lima (nivel 11) y Batido de Fresa (nivel 14).
- Teclado en computadora: flechas para mover el cursor, Espacio o Enter para elegir, Esc para pausar y M para
  silenciar.

## Jugar

- **Local:** abre `index.html` con doble clic. No necesita servidor.
- **Página de presentación:** `landing/index.html` es la landing del juego (historia, cómo se juega, personajes,
  Reto Diario y preguntas frecuentes). Reutiliza el arte de `js/` y sus botones llevan a `index.html`.
- **Un solo archivo:** `node tools/build-single.cjs` genera `dist/cocardo.html` con todo adentro, para
  compartirlo o subirlo a cualquier hosting.
- **GitHub Pages:** en el repositorio, ve a *Settings → Pages*. En *Build and deployment* elige
  *Deploy from a branch*, selecciona la rama del juego y la carpeta `/ (root)`, y guarda. En un par de minutos
  queda en `https://<usuario>.github.io/cocardo/`. Dominio propio, cuentas y plan de lanzamiento:
  `docs/CRECIMIENTO.md` y `docs/FIREBASE.md`.
- **Landing:** `landing.html` es la página de presentación (para Google, prensa y creadores). El enlace de la
  bio de TikTok/Instagram conviene que vaya directo a `index.html` (un toque y ya está jugando);
  `index.html?go=daily` abre el Reto Diario.

El progreso se guarda en el navegador (`localStorage`). Si el navegador no lo permite, el juego sigue
funcionando y solo guarda durante la sesión.

## Desarrollo

Sitio estático en JavaScript sin dependencias ni paso de compilación. Los módulos se cargan con `<script>`
clásicos y cuelgan del objeto global `window.Cocardo`.

```
index.html              pantallas y orden de carga
css/style.css           estilos de las pantallas
css/game.css            estilos del tablero
js/core/rng.js          generador aleatorio con semilla (mulberry32)
js/core/engine.js       motor match-3 puro y determinista
js/core/replay.js       reproduce los eventos del motor (lo usan las pruebas)
js/core/levels.js       los 30 niveles y capítulos
js/core/daily.js        Reto Diario y texto para compartir
js/core/progress.js     fusión de guardados local/nube, resumen público y reglas del apodo
js/story.js             guion, consejos, burlas y álbum
js/art.js               arte del tablero en SVG (fichas, hielo, congeladores, íconos, logo, fondos)
js/art-characters.js    retratos SVG de los 16 personajes con 12 estados de ánimo
js/audio.js             efectos y música sintetizados con WebAudio
js/save.js              guardado
js/fx.js, js/render.js  partículas y dibujo del tablero en canvas
js/game.js              pantalla de juego: HUD, controles, animaciones, tutoriales
js/cloud-config.js      configuración de Firebase, GA4, dominio y redes (rellenar)
js/cloud.js             cuenta de Google / apodo, progreso en la nube y rankings (Firebase, carga diferida)
js/analytics.js         eventos a Google Analytics 4 (opcional)
js/clip.js              grabación de clips verticales 9:16 de la partida
js/ui.js, js/main.js    navegación y pantallas (portada, mapa, historia, victoria, reto, álbum, ajustes, cuenta)
landing.html            página de presentación (css/landing.css)
manifest.webmanifest    app instalable; sw.js: juego sin conexión; icons/: íconos e imagen de vista previa
firebase/               reglas de seguridad de Firestore (firestore.rules) y configuración del proyecto
docs/                   diseño, arquitectura, personajes, investigación, Firebase y plan de crecimiento
tests/                  pruebas del motor, niveles, reto diario, progreso y prueba de punta a punta
tools/                  simulador de niveles, empaquetador, capturas, íconos, bot que graba videos y vistas previas
```

Comandos (Node 18 o superior):

```bash
node --test tests/*.test.js      # pruebas unitarias y de propiedades del motor y los niveles
node tests/e2e.cjs --quick       # prueba de punta a punta en Chromium (necesita Playwright)
node tools/sim.js 1-30 --seeds 300   # bots que juegan cada nivel para medir la dificultad
node tools/build-single.cjs      # versión de un solo archivo en dist/
node tools/build-icons.cjs       # regenera icons/ (íconos, favicon y la imagen de vista previa) desde el arte SVG
node tools/record.cjs --level 12 --mp4   # un bot juega el nivel y lo graba en vertical (clips/), para TikTok
```

Abre `#debug` al final de la dirección (por ejemplo `index.html#debug`) para tener `Cocardo.debug` en la consola:
`unlockAll()`, `go(n)`, `win()`, `lose()` y otros atajos de prueba.

## Créditos

- Historia y personajes originales: la frutinovela *La Nieve de Lima* (Cocardo), de @frutitaenlatada.
- Juego, arte vectorial, música y código: proyecto de fans, hecho con Claude Code.
