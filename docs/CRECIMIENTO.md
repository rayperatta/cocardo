# Plan de crecimiento: landing, viralidad en TikTok/Instagram, dominio y repositorios útiles

Fecha: 16 de octubre de 2026. Este documento junta (1) lo que ya quedó hecho en el juego para que crezca,
(2) el plan de contenido para TikTok e Instagram, (3) el informe de dominios y (4) los repositorios de GitHub
que vale la pena mirar, con cómo aplican a este proyecto (JavaScript puro, sin empaquetador, GitHub Pages).

## 1. Qué ya está hecho en el juego (esta entrega)

| Palanca | Dónde | Para qué sirve |
|---|---|---|
| Entrar con Google, apodo y avatar, progreso en la nube | `js/cloud.js`, `js/core/progress.js`, Portada → **Entrar**, Ajustes | Identidad: la gente vuelve cuando tiene nombre y ranking. Activación en `docs/FIREBASE.md` (20 min). |
| «Jugar con apodo» sin cuenta | mismo | Dentro de TikTok/Instagram Google no deja entrar; así nadie se queda fuera del ranking. |
| Ranking del Reto Diario y ranking por estrellas | Reto Diario → tarjeta **Ranking** | Competencia diaria = motivo para volver cada día y para etiquetar amigos. |
| Enlace de invitación `?r=apodo` | `shareUrl()` en `js/ui.js` | Cada «Compartir» lleva el apodo; quien abre ve «¡Te invitó X!» y queda como referido (evento `referral`). |
| **Clips 9:16** de cada partida (Ajustes → Grabar clips, o en Pausa) | `js/clip.js` | Video vertical con logo, nivel, puntos y marca de agua `@apodo · tu-dominio`, para subir a TikTok/Reels con un toque desde Victoria/Derrota. |
| Bot que graba videos del juego | `node tools/record.cjs --level 12 --mp4` | Material infinito para tus propios videos (cascadas, derrotas por un movimiento, etc.). |
| Vista previa al compartir (Open Graph), íconos, app instalable (PWA) y juego sin conexión | `index.html`, `manifest.webmanifest`, `sw.js`, `icons/` | Los enlaces en WhatsApp/TikTok muestran imagen y texto; «Añadir a pantalla de inicio» sube la retención. |
| Landing con SEO (FAQ, JSON-LD) | `landing.html` | Para Google y para prensa/creadores. El enlace de la bio de TikTok debe ir **directo al juego** (`index.html`): un toque y ya está jugando. |
| Analítica de eventos | `js/analytics.js` (GA4 opcional) | Medir dónde abandona la gente (`level_end` por nivel), cuánto comparten y cuántos llegan por invitación. |
| Acceso directo al reto | `index.html?go=daily` | Enlace para historias: «el reto de hoy». |

## 2. Plan de contenido para TikTok e Instagram (primeras 4 semanas)

Lo que los estudios de casos de juegos casuales en TikTok (Royal Match, hiper-casuales, indies) coinciden en que
funciona, traducido a Cocardo:

**Formato ganador.** 9:16, 7-15 s, **gancho en el primer segundo**, sin intro, texto grande en pantalla, música
en tendencia, final abierto que invita a comentar. La cuenta del juego no necesita más de 2-3 videos por semana;
lo que necesita es **constancia y repetir lo que funcione**.

**Ganchos probados (adaptados):**
1. *Personaje en peligro + fallo cómico*: «Cocardo congeló a Lima y me quedan 2 movimientos…» y pierdes por uno.
   Final: «¿tú la rescatas?» + enlace. (Es el patrón exacto de los anuncios de Royal Match.)
2. *Cascada satisfactoria*: 10 s de combos encadenados con el sonido del juego. Texto: «el nivel 12 de Cocardo es
   una trampa». (Graba con `tools/record.cjs` o con «Grabar clips».)
3. *Solo el X % pasa el nivel N*: cuando tengas analítica, usa el dato real (`level_end` por nivel).
4. *Reto Diario*: cada mañana una historia con «el reto de hoy» (`?go=daily`) y el texto de emojis del ganador del
   día anterior; etiqueta a quien quedó primero en el ranking.
5. *Dúo/stitch* con videos de la frutinovela y de otras cuentas que hablan de Cocardo: «ya existe el juego».
6. *Detrás de cámaras*: «hice el juego de Cocardo yo solo en X días», antes/después del arte, bugs graciosos.
   Los devlogs son el contenido indie que más se comparte.

**Calendario sugerido.** Semana 1: 1 video de gancho + 1 de cascada + lanzamiento del Reto Diario en historias
diarias. Semana 2: devlog + «solo el X %» + dúo. Semana 3-4: repetir los 2 formatos con más vistas cambiando
el nivel; subir a Reels/Shorts **al día siguiente** de TikTok (no el mismo día). Cuatro hashtags como máximo:
`#cocardo #frutinovela #lanievedelima #juegos`.

**Qué pedir a la gente.** Siempre una sola acción: «Juega gratis, enlace en la bio» o «comenta tu apodo del
ranking». El texto para compartir del Reto (tipo Wordle) y los clips con marca de agua hacen el resto.

**Colaboraciones con más impacto y costo cero.** (a) Escribir a @frutitaenlatada: un «ya hay juego de fans» en
su cuenta vale más que cualquier anuncio; ofrece créditos y, si quiere, que apruebe el juego. (b) Pedir un
enlace a cocardo.com (sitio de fans tipo «expediente», ya posicionado en Google): tú les das un «¿quieres jugar?»
y ellos a ti tráfico de búsquedas. (c) Heladerías reales que ya usan a Cocardo en sus vitrinas (caso Gallelatto en
Maracaibo): un código QR al juego en la vitrina.

**Qué medir cada semana.** Instalaciones PWA (`pwa_open`), `level_start → level_end` por nivel (si más del 40 %
abandona en un nivel, bájale 2 movimientos de dificultad con `tools/sim.js`), `daily_end` (retención), `share` y
`clip` (viralidad), `referral` (qué apodos traen gente: premia a esos jugadores en el ranking o en un video).

## 3. Dominio: informe de disponibilidad (comprobado el 16-oct-2026 por RDAP)

**Ya registrados (no disponibles):**

| Dominio | Estado |
|---|---|
| cocardo.com | Registrado el **7 de octubre de 2026** (GoDaddy). Es un sitio de fans tipo «expediente» con historia, personajes y noticias. No es el creador original. |
| cocardo.fun | Registrado el **27 de septiembre de 2026**, apunta a Vercel (hoy sin despliegue). Alguien más está preparando algo con el nombre. |
| cocoscoops.com, frutinovela.com | Registrados. |

**Disponibles (confirmado con el registro de cada extensión):**

| Dominio | Comentario | Precio orientativo/año |
|---|---|---|
| **cocardo.app** ← recomendado | Corto, es la marca, y `.app` obliga HTTPS (GitHub Pages lo da gratis). Es el que ya usan `index.html` y `landing.html` en las etiquetas Open Graph. | US$14-20 |
| **rescatehelado.com** ← recomendado como segundo | Descriptivo y barato; redirígelo al principal. | US$10-13 |
| cocardo.lat | Identidad latinoamericana. | US$15-30 |
| jugarcocardo.com, juegacocardo.com, cocardogame.com, cocardo-game.com | Alternativas `.com` con la marca. | US$10-13 |
| cocardo.net, cocardo.org, cocardo.xyz, cocardo.online | Disponibles; menos memorables. | US$3-15 |
| lanievedelima.com, nievedelima.com, heladeriacocardo.com, cocardohelados.com, cocosscoops.com | Nombres de la serie; útiles para redirecciones o para evitar que otro los use. | US$10-13 |
| cocardo.game | Disponible, pero `.game` es una extensión cara (US$300+/año en la mayoría de registradores). | US$300+ |
| cocardo.pe | No se pudo comprobar (el registro `.pe` no publica RDAP); míralo en punto.pe. | — |

**Estado (16-oct-2026, 21:42 UTC): cocardo.app ya está comprado** en Cloudflare Registrar, con los servidores
de nombres de Cloudflare (`cass` y `lloyd`). Queda pendiente rescatehelado.com como redirección, si quieres.

**Conectarlo sin tocar la consola de Cloudflare:** `tools/setup-cloudflare-dns.sh` crea (o corrige) los registros
A/AAAA del apex y el CNAME de `www` hacia GitHub Pages, sin proxy, con un token de API de Cloudflare
(My Profile → API Tokens → Create Token → plantilla «Edit zone DNS», zona `cocardo.app`) en la variable
`CLOUDFLARE_API_TOKEN`:

```bash
CLOUDFLARE_API_TOKEN=… tools/setup-cloudflare-dns.sh cocardo.app rayperatta
```

**Una advertencia honesta.** «Cocardo» es un personaje de otra persona. Un dominio con su nombre para un juego de
fans gratuito y claramente marcado como no oficial tiene riesgo bajo, pero no cero: si el creador o una marca lo
reclama, podrías tener que entregarlo. Por eso el segundo dominio (rescatehelado.com) te da un nombre propio al
que migrar sin perder a nadie, y por eso conviene hablar con el creador (§2).

**Conectarlo a GitHub Pages.** A mano serían 4 registros `A` (`185.199.108.153`, `185.199.109.153`,
`185.199.110.153`, `185.199.111.153`), 4 `AAAA` (`2606:50c0:8000::153` a `8003::153`) y un `CNAME` de `www` a
`<tu-usuario>.github.io`, todos «DNS only» (nube gris) para que GitHub pueda emitir el certificado. El script de
arriba lo hace solo. En el repositorio ya existe el archivo `CNAME` con `cocardo.app`: en cuanto la rama que
publica GitHub Pages lo contenga, el dominio queda configurado solo; después, en *Settings → Pages*, marca
*Enforce HTTPS* cuando se active (el certificado tarda de minutos a una hora) y, en *Settings → Pages → Verified
domains* de tu cuenta, verifica el dominio (pásale el token TXT al script como tercer argumento). Añade el dominio en
Firebase (`tools/setup-firebase.sh` lo hace) y, si algún día cambias de dominio, reemplaza `https://cocardo.app/`
en `index.html`, `landing.html`, `js/cloud-config.js` (`siteUrl`) y `CNAME`.

## 4. Repositorios y recursos de GitHub que aplican a este juego

Verificados uno por uno en octubre de 2026 (estrellas aproximadas). «Requiere adaptación» = trae framework o
empaquetador; en este proyecto se copia la idea o el código, no la dependencia.

### 4.1 Sensación de juego («juice»): lo que hace que un clip se vea satisfactorio

| Repositorio | Qué es | Cómo usarlo aquí |
|---|---|---|
| [KilledByAPixel/ZzFX](https://github.com/KilledByAPixel/ZzFX) (800★) | Efectos de sonido en <1 KB; cada sonido es un arreglo de números, con diseñador web | Sonidos «pop» por cascada ascendente y de fallo, sin archivos de audio. Compatible con `js/audio.js`. |
| [keithclark/ZzFXM](https://github.com/keithclark/ZzFXM) (470★) | Música generativa sobre ZzFX | Loop de menú de pocos KB si la cumbia sintetizada se queda corta. |
| [catdad/canvas-confetti](https://github.com/catdad/canvas-confetti) (12,8k★) | Confeti rápido en canvas; `shapeFromText('🍋')` | Confeti de frutas al rescatar; respeta `prefers-reduced-motion`. |
| [sajmoni/screen-shake](https://github.com/sajmoni/screen-shake) (~700 bytes) | Sacudida con ruido Perlin y «trauma» (charla GDC) | Copiar el fuente y aplicar en combos ≥4 y especiales (`js/fx.js`). |
| [tweenjs/tween.js](https://github.com/tweenjs/tween.js) (10k★) | Interpolación con easings | `Back.Out` en los swaps y `Bounce.Out` en las caídas. |
| [voormann/blix](https://github.com/voormann/blix) | Partículas Canvas 2D con *object pooling* | Referencia para que las partículas no tartamudeen en celulares baratos. |
| [grapefrukt/juicy-breakout](https://github.com/grapefrukt/juicy-breakout) (690★) | El demo de la charla «Juice it or lose it» | Lista de verificación: cada interruptor del demo es una mejora posible. Charla: <https://www.youtube.com/watch?v=Fy0aCDmgnxg>. |

### 4.2 Match-3 de código abierto para estudiar mecánicas y niveles

| Repositorio | Por qué mirarlo |
|---|---|
| [monkey-mountain/sugarfall](https://github.com/monkey-mountain/sugarfall) | Casi el mismo stack (vanilla JS, sin build, PWA, SVG, WebAudio): resolución por fases y scripts `simulate`/`balance` para calibrar dificultad. |
| [edttitao-ai/linglong-match](https://github.com/edttitao-ai/linglong-match) | 70 niveles, reto diario, logros y **animaciones aceleradas al tocar** (clave para que las cascadas no aburran). |
| [tomcoolpxl/sugar-splat](https://github.com/tomcoolpxl/sugar-splat) (Phaser, requiere adaptación) | La tabla más completa de bloqueadores y potenciadores en JS abierto: copia las reglas, no el código. |
| [DareDev256/whats-poppin](https://github.com/DareDev256/whats-poppin) (Phaser) | Reto diario sembrado por fecha + tarjeta compartible: el mismo bucle que ya tiene Cocardo, para comparar. |
| [rembound/Match-3-Game-HTML5](https://github.com/rembound/Match-3-Game-HTML5) | Match-3 canvas puro con bot; tutorial clásico. |
| [LibraStack/Match3-SDK](https://github.com/LibraStack/Match3-SDK) (C#) | Arquitectura de referencia: objetivos, detectores de secuencias, animación en paralelo. |
| Diseño de niveles de Royal Match con números: <https://www.gamigion.com/royal-match-level-design-insights/> | Cadencia: bloqueador nuevo cada ~10 niveles, nivel difícil cada 4-10, movimientos bajando de 30-38 a 23-27. Compara con `tools/sim.js`. |

### 4.3 Landing, imágenes de vista previa y mockups

| Repositorio | Uso |
|---|---|
| [tailwindtoolbox/App-Landing-Page](https://github.com/tailwindtoolbox/App-Landing-Page) (220★) | Landing de una sola página sin build; `landing.html` sigue esa estructura con el estilo del juego. |
| [vercel/satori](https://github.com/vercel/satori) (14k★) | HTML/CSS → SVG/PNG en Node; alternativa a `tools/build-icons.cjs` para generar tarjetas «Nivel N» estáticas. |
| [pixelnest/presskit.html](https://github.com/pixelnest/presskit.html) (360★) | Kit de prensa estático (logos, capturas, bio) para creadores y medios. |
| [daveearley/screenshot.rocks](https://github.com/daveearley/screenshot.rocks) (800★) | Mockups con marco de teléfono para posts de Instagram. |
| [elegantapp/pwa-asset-generator](https://github.com/elegantapp/pwa-asset-generator) (3k★) | `npx pwa-asset-generator icons/favicon.svg icons -m manifest.webmanifest` genera también las pantallas de carga de iOS. |

### 4.4 Viralidad: compartir, clips y video vertical

| Recurso | Uso |
|---|---|
| Web Share con archivos: <https://web.dev/patterns/files/share-files> | Es lo que usan `shareImage()` y `Cocardo.Clip.share()`. |
| [on2-dev/share-api-polyfill](https://github.com/on2-dev/share-api-polyfill) (260★) | Panel propio (WhatsApp, Telegram, X, copiar) donde no hay Web Share (escritorio, Firefox). |
| [zumerlab/snapdom](https://github.com/zumerlab/snapdom) (8k★) | DOM → PNG moderno (sustituye a html2canvas) si quieres tarjetas con HTML en vez de canvas. |
| [vanilagy/mediabunny](https://github.com/vanilagy/mediabunny) (7k★) | WebCodecs → MP4 en el navegador: para forzar MP4 en Android viejo donde MediaRecorder solo da WebM. |
| [spite/ccapture.js](https://github.com/spite/ccapture.js) (3,8k★) | Captura a cuadros fijos (sin saltos) para tus videos de cascadas perfectas. |
| [remotion-dev/remotion](https://github.com/remotion-dev/remotion) (65k★, requiere adaptación) y [mifi/editly](https://github.com/mifi/editly) (5,5k★) | Montaje programático de shorts (clip + texto gancho + música) en lote. Editly es más simple (JSON + ffmpeg). |
| Playwright `recordVideo`: <https://playwright.dev/docs/videos> | Es lo que hace `tools/record.cjs`. |
| [smoudjs/playable-sdk](https://github.com/smoudjs/playable-sdk) | Si algún día pagas anuncios en TikTok, empaqueta el nivel 1 como anuncio jugable. |
| Guías: TikTok Creative Center para juegos hiper-casuales, [howtomarketagame.com (TikTok)](https://howtomarketagame.com/2022/02/07/seven-great-tips-for-marketing-your-indie-game-on-tiktok/), [presskit.gg](https://presskit.gg/field-guides/tiktok-indie-game-marketing) | Gancho en 1 s, loops, ~4 hashtags, resubir los éxitos, cross-post un día después. |

### 4.5 Analítica, retención y pruebas A/B

| Repositorio | Uso |
|---|---|
| [umami-software/umami](https://github.com/umami-software/umami) (39k★) y [plausible/analytics](https://github.com/plausible/analytics) (30k★) | Analítica sin cookies (sin aviso de cookies) si prefieres no usar GA4; `Cocardo.Track.event` es el único punto que hay que cambiar. |
| [PostHog/posthog](https://github.com/PostHog/posthog) (40k★) | Analítica + grabación de sesiones + experimentos A/B (p. ej. probar «Toca para empezar» contra «¡Rescatar a Lima!»). |
| [growthbook/growthbook](https://github.com/growthbook/growthbook) (8,5k★) | Solo banderas y A/B, más ligero que PostHog. |
| [khmyznikov/pwa-install](https://github.com/khmyznikov/pwa-install) (960★, en español) | Diálogo «Instala Cocardo» con instrucciones para iPhone, para mostrar tras ganar el nivel 3. |
| [GoogleChrome/workbox](https://github.com/GoogleChrome/workbox) (13k★) | Si `sw.js` se queda corto (precarga por rutas, actualizaciones con aviso). |
| [doeixd/Wordle-Vanilla](https://github.com/doeixd/Wordle-Vanilla) | Modal de estadísticas con distribución de resultados, en vanilla: idea para el Reto Diario. |

### 4.6 Cuentas y ranking (lo que ya está implementado y su siguiente nivel)

| Recurso | Uso |
|---|---|
| [firebase/quickstart-js](https://github.com/firebase/quickstart-js) (5,4k★) | Ejemplos oficiales de Google Sign-In y Firestore; `js/cloud.js` sigue ese flujo con la build *compat* (sin empaquetador). |
| Reglas de Firestore: <https://firebase.google.com/docs/firestore/security/rules-conditions> | Base de `firebase/firestore.rules`. |
| [FirebaseExtended/firestore-leaderboards-codelab](https://github.com/FirebaseExtended/firestore-leaderboards-codelab) | Variantes de ranking a escala (cuando el top-20 por consulta se quede corto). |
| Cloud Functions `onCall` + App Check | Validar puntajes re-jugando la partida en el servidor con el motor determinista (`docs/FIREBASE.md` §7). Patrón de referencia: [locutus75/SysCommander PR #8](https://github.com/locutus75/SysCommander/pull/8) (replay verificable en Node). |
| [supabase/supabase](https://github.com/supabase/supabase) (112k★), [pocketbase/pocketbase](https://github.com/pocketbase/pocketbase) (61k★) | Alternativas a Firebase (Postgres con RLS; un binario en un VPS). Solo si prefieres salir de Google. |

## 5. Las diez siguientes acciones, por impacto frente a esfuerzo

1. **Comprar cocardo.app + rescatehelado.com** y conectar GitHub Pages (§3). 1 hora.
2. **Activar Firebase** (`docs/FIREBASE.md`) y probar el ranking con 3 amigos. 1 hora.
3. **Poner GA4** y mirar `level_end` por nivel tras la primera semana; ajustar los 3 niveles donde más se pierde. 2 horas.
4. **Grabar 6 clips** con `tools/record.cjs` (niveles 5, 12, 16, 21, 25 y 30) y montar 2 videos de gancho (§2). 1 tarde.
5. **Escribir al creador** (@frutitaenlatada) y a cocardo.com (§2). 30 minutos.
6. **Pase de «juice»** (ZzFX en cascadas, sacudida en combos, confeti de frutas al rescatar). 1-2 días. Hace que los clips de la gente se vean mejor.
7. **Diálogo de instalación** (pwa-install) tras ganar el nivel 3. 2 horas.
8. **Validación de puntajes en servidor** antes del primer video viral (`docs/FIREBASE.md` §7). 1 día.
9. **Estadísticas del Reto Diario** (distribución de movimientos, racha, mejor día) al estilo Wordle. 1 día.
10. **A/B del texto del botón de la Portada y del momento del aviso de instalar** con PostHog o GrowthBook. Cuando haya >500 jugadores/día.
