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
- **Un solo archivo:** `node tools/build-single.cjs` genera `dist/cocardo.html` con todo adentro, para
  compartirlo o subirlo a cualquier hosting.
- **GitHub Pages:** en el repositorio, ve a *Settings → Pages*. En *Build and deployment* elige
  *Deploy from a branch*, selecciona la rama del juego y la carpeta `/ (root)`, y guarda. En un par de minutos
  queda en `https://<usuario>.github.io/cocardo/`.

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
js/story.js             guion, consejos, burlas y álbum
js/art.js               arte del tablero en SVG (fichas, hielo, congeladores, íconos, logo, fondos)
js/art-characters.js    retratos SVG de los 16 personajes con 12 estados de ánimo
js/audio.js             efectos y música sintetizados con WebAudio
js/save.js              guardado
js/fx.js, js/render.js  partículas y dibujo del tablero en canvas
js/game.js              pantalla de juego: HUD, controles, animaciones, tutoriales
js/ui.js, js/main.js    navegación y pantallas (portada, mapa, historia, victoria, reto, álbum, ajustes)
docs/                   diseño, arquitectura, personajes e investigación
tests/                  pruebas del motor, niveles, reto diario y prueba de punta a punta
tools/                  simulador de niveles, empaquetador, capturas y vistas previas del arte y el audio
redes/                  Postiz con Docker para publicar los videos en las redes (ver redes/README.md)
```

Comandos (Node 18 o superior):

```bash
node --test tests/*.test.js      # pruebas unitarias y de propiedades del motor y los niveles
node tests/e2e.cjs --quick       # prueba de punta a punta en Chromium (necesita Playwright)
node tools/sim.js 1-30 --seeds 300   # bots que juegan cada nivel para medir la dificultad
node tools/build-single.cjs      # versión de un solo archivo en dist/
```

Abre `#debug` al final de la dirección (por ejemplo `index.html#debug`) para tener `Cocardo.debug` en la consola:
`unlockAll()`, `go(n)`, `win()`, `lose()` y otros atajos de prueba.

## Créditos

- Historia y personajes originales: la frutinovela *La Nieve de Lima* (Cocardo), de @frutitaenlatada.
- Juego, arte vectorial, música y código: proyecto de fans, hecho con Claude Code.
