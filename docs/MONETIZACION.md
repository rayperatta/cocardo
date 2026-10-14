# Monetización: decisión y cómo activarla

Decisión tomada el 14 de octubre de 2026 a partir de cuatro análisis (mercado y finanzas, legal y plataformas, técnico,
producto y diseño). Este archivo manda en todo lo que toca al cobro. Las reglas de juego siguen en `docs/DISENO.md` y
las interfaces en `docs/ARQUITECTURA.md` §14.

## 1. La decisión

| | |
|---|---|
| **Modelo** | Demo gratis y **versión completa con pago único**. |
| **Precio** | **US$1,99**. En enlaces locales, S/ 5,90 o MXN 35. |
| **Gratis siempre** | Niveles 1 al 10 (capítulos 1 y 2, el arco de Lima), Reto Diario, racha, compartir y Álbum. |
| **Lo que se compra** | Niveles 11 al 30 (capítulos 3 a 6 y el final) y un marco dorado «Socio de la heladería» en el Álbum. |
| **Anuncios** | **No.** Se vuelve a evaluar cuando pase la ola, y solo con licencia de la creadora. |
| **Donaciones** | Enlace opcional «Invítame un helado». No desbloquea nada. |
| **Dónde se cobra** | itch.io, en un solo proyecto: el juego se juega gratis en la página y la misma página vende la versión completa, entregando a cada comprador uno de nuestros códigos únicos («External keys»). Plan B: Payhip. |
| **Permiso** | **Obtenido.** La creadora de la serie dio permiso explícito por correo (14 de octubre de 2026). El correo lo guarda quien publica, fuera del repo. |
| **Créditos** | «Juego de fans hecho con permiso de la creadora», sin nombrarla (lo decidió quien publica). Nunca «oficial». |

**Estado de la activación** (la venta se enciende sola cuando están las tres primeras cosas):

| | Estado |
|---|---|
| Clave pública de producción en `js/core/license.js` | ✅ Lista |
| `config.buyUrl`: página de venta en itch.io | ⏳ Pendiente: crear la página (guía en §6) |
| `config.contact`: correo para dudas y reembolsos | ⏳ Pendiente: lo pasa quien publica |
| Precio `US$1,99` y aviso de fans en `js/store.js` | ✅ Listos |
| Clave privada y primer lote de 1.000 códigos (series 1 a 1.000) | ✅ Entregados a quien publica, fuera del repo |
| Pantallas conectadas al resto del juego (Shell) | ⏳ Pendiente de que exista el Shell (§7) |

Mientras falte algo de las tres primeras filas, **no se bloquea ningún nivel**: el juego entero sigue gratis.

## 2. Por qué

### Anuncios: no
- **Pagan poco en Latinoamérica.** Un intersticial web rinde unos US$0,30–0,80 por cada mil en la región (estimación a
  partir de la brecha de CPM entre EE. UU. y México, que es de unas 7 veces). Con 100 mil jugadores, la estimación es de
  unos US$360 en 30 días.
- **Llegan tarde.** AdSense pide dominio propio (no acepta `*.github.io`), y su revisión, más la solicitud aparte de
  H5 Games Ads, tarda semanas. Además el pago mínimo es de US$100. La ola viral ya va de bajada.
- **Riesgo legal y con menores.** Las políticas de Google prohíben el contenido que infringe derechos (personajes ajenos)
  y castigan a toda la cuenta. Si el juego se considera dirigido a niños, se apagan los anuncios personalizados, y el SDK
  recoge identificadores que hoy el juego no toca.
- **Técnica.** No funcionan desde `file://` ni dentro del artifact, rompen la regla «sin JS externo» (ARQUITECTURA §0),
  exigen un gestor de consentimiento y compiten con el canvas a 60 fps.
- **Experiencia.** Los niveles duran de 60 a 180 s, así que un intersticial cortaría el ritmo
  Victoria → historia → «Siguiente» cada 1 a 3 niveles. Los anuncios recompensados necesitan una economía (vidas o
  «+5 movimientos») que el diseño descarta a propósito.
- **Portales.** Poki y CrazyGames exigen ser dueño de la propiedad intelectual. Poki no permite compras y en CrazyGames
  la monetización completa es por selección.

### Versión completa: sí
- **Es el modelo que más deja y el más rápido de montar.** Con conversiones de 0,2 / 0,5 / 1 % a US$1,99 (US$1,43 netos
  en itch.io), la estimación a 30 días es de US$57 / 717 / 7.166 para 20 mil / 100 mil / 500 mil jugadores. El híbrido
  con anuncios da algo más en teoría, pero esos anuncios llegarían cuando la ola ya pasó.
- **El precio.** US$1,99 equivale a un juego de unos US$3 ajustado por poder adquisitivo en Perú y México. Con US$1, el
  cargo fijo de US$0,30–0,50 por venta se lleva casi todo.
- **No frena lo que se comparte.** El Reto Diario (el motor de difusión) sigue gratis, y el momento más compartible, el
  rescate de Lima en el nivel 10, llega antes del muro.
- **Es justo con el público joven.** No hay vidas, energía, temporizadores, cajas de botín ni movimientos pagados.
  El muro se ve **una vez**, tras una victoria y nunca tras una derrota. «Ahora no» se ve igual de claro que el botón de
  compra, y la pantalla dice el precio real, qué incluye, que es pago único, que es un juego de fans y que un menor debe
  pedir permiso.

### Por qué cortar en el nivel 10
- Cortar en el 5 sería cobrar justo cuando Lima queda congelada («paga para salvarla»), y eso es presión inaceptable con
  niños.
- En el 10 el arco del título ya cerró, el jugador conoce las mecánicas y lleva de 15 a 30 minutos jugando.
- El gancho es el adelanto de la parte 3 (Don Piña quiere mil helados), no un rehén.

## 3. El permiso de la creadora

> **Estado:** permiso escrito obtenido por correo el 14 de octubre de 2026. Guarden ese correo (y cualquier condición que
> ella haya puesto, como el porcentaje de ingresos o los créditos) junto a la clave privada. Si hay reparto de ingresos,
> la página de ventas de itch.io sirve como reporte mensual. Lo que sigue explica por qué hacía falta.

El juego usa los personajes, nombres y frases de *La Nieve de Lima*. Redibujarlos no los vuelve nuestros: es una obra
derivada. Cobrar por ella (con venta o con anuncios) es uso comercial. Sin permiso, el riesgo es **alto**: un aviso DMCA
basta para que itch.io, Payhip, PayPal o GitHub bajen el juego, y PayPal o Mercado Pago pueden congelar los fondos.
Que la serie esté hecha con IA **no** resuelve el problema: guiones, nombres y diálogos pueden ser obra humana.

**Qué hacer:**
1. **Contactar a la creadora** (marca de agua @frutitaenlatada; página de Facebook «frutassinverguenza»). Hay decenas de
   cuentas copia: para verificar su identidad, pidan que publique un código acordado desde la cuenta de la marca de agua.
2. **Proponer:**
   - licencia no exclusiva de nombres, aspecto y frases para la web (y una futura app);
   - entre 20 y 30 % del ingreso neto, con un reporte mensual;
   - créditos y enlace a su cuenta dentro del juego;
   - derecho de veto sobre el contenido.
   El juego se presentaría como «aprobado por la creadora», nunca como «oficial».
3. **Dejarlo por escrito**: como mínimo un correo con su aceptación expresa; mejor, un contrato que diga qué se licencia,
   el territorio, el plazo, el pago, que ella es la autora y cómo se termina (plazo para retirar el juego y reembolsar).
   Consulten a un abogado de propiedad intelectual antes de firmar o si llega un reclamo.

**Además, antes de cobrar:**
- El juego, alojado en itch.io (o en un dominio propio): GitHub Pages no admite comercio.
- Un correo de contacto visible para reembolsos y reclamos (en México, LFPC art. 76 bis).
- Un aviso de privacidad breve.
- Cero rastreadores.
- Reembolso sin preguntas en 14 días, y reembolso a todos si el juego se retira por un reclamo de derechos.

## 4. Lo que ve el jugador

- **Portada y mapa:** los niveles 11 al 30 llevan candado desde el principio. Nada de sorpresas.
- **Después del nivel 10** (solo la primera vez): Victoria (con «Compartir») → historia post10 → «CONTINUARÁ...» →
  **muro de pago**. Si el jugador elige «Ahora no», el muro no vuelve a aparecer solo; reaparece únicamente cuando toca un
  candado.
- **Muro:**
  - título «CONTINUARÁ... en la versión completa»;
  - el gancho de Don Piña y seis viñetas: qué incluye, pago único, el Reto Diario y el Álbum siguen gratis;
  - botones «Desbloquear todo · US$1,99», «Ya tengo un código» y «Ahora no»;
  - pie: juego de fans, permiso de un adulto, contacto.
- **Canje:** pegar el código o tocar el enlace que llega después de pagar. Funciona sin conexión y sin cuenta.
- **Éxito:** «¡Tenemos un trato, socio!» y «Copiar mi código», para usarlo en otro celular o navegador.
- **Ajustes → Versión completa:** muestra el estado, permite canjear o copiar el código e incluye «Invítame un helado».
  Borrar progreso **no** quita la versión completa.

Todos los textos están en `js/store.js`. Para verlos, abre `tools/store-preview.html`.

## 5. Cómo funciona el desbloqueo (sin servidor)

- **Código:** 94 caracteres en base64url (70 bytes): formato, producto, número de serie y una firma **ECDSA P-256**.
  El juego solo lleva la **clave pública** y verifica con WebCrypto (`crypto.subtle`), que funciona en `file://`, en
  GitHub Pages, en itch.io y en el artifact. Nadie puede fabricar códigos leyendo el código fuente.
- **Entrega:** en itch.io, el código suelto, que el jugador pega (botón «Get key» de su página de descarga). Fuera de
  itch.io también sirve el enlace `https://…/#licencia=<código>`: el juego lo canjea al abrir y lo borra de la barra de
  direcciones. El hash nunca llega al servidor.
- **Revocación:** cada código tiene un número de serie. Los códigos filtrados o reembolsados se agregan a
  `License.REVOKED` en la siguiente versión, y el juego vuelve a revisar el código guardado en cada arranque.
- **Honestidad:** nada de esto impide que alguien edite localStorage o abra la consola, porque los 30 niveles van en el
  juego. A US$1,99, eso da igual: la firma sirve para que no circule un generador de códigos y para poder anular los que
  se filtren. No vale la pena ofuscar.
- **Límite:** el progreso vive en el navegador. El navegador interno de TikTok no comparte datos con Chrome, así que el
  código vale en cualquier navegador, pero el progreso no lo sigue. Por eso se ofrece «Copiar mi código».

## 6. Cómo activar la venta: tienda en itch.io

**Ya hecho:**
- La clave de producción está en el juego.
- Quien publica recibió (fuera del repo) la clave privada `cocardo-licencia.pem` y los códigos 1 a 1.000, en
  `cocardo-codigos-itch-001-1000.txt` (uno por línea) y en un CSV con su serie.

**Falta:** la página de itch.io y el correo de contacto.

**Un solo proyecto.** En itch.io, los juegos HTML5 siempre se juegan gratis en el navegador, incluso cuando el proyecto
es pagado: la página muestra «Run game» junto a «Buy Now». Eso calza con el modelo. La compra da acceso a una clave
externa (nuestro código), que el jugador **pega** dentro del juego. En itch.io el enlace `#licencia=` no le llega al
juego, porque este corre en un iframe de `itch.zone`.

### Pasos
1. **Cuenta y cobro.**
   - En *Seller settings*, elegir **«Collected by itch.io, paid later»**: itch.io es el comerciante, cobra el IVA y
     asume los contracargos.
   - Hacer la **entrevista fiscal** (*Account settings → Tax information*; suele ser el W-8BEN) con el número
     tributario. Perú no tiene tratado con EE. UU.: puede haber retención de 30 % sobre las ventas a EE. UU.; consultar
     con un contador.
   - Agregar **PayPal** (lo más simple con pocas ventas) o Payoneer para retirar.
2. **Crear la página:** *Dashboard → Create new game*, con *Kind of project* **HTML**. Agregar una portada de 630×500 y
   de 3 a 5 capturas. La página nace privada.
3. **Subir el juego web:**
   - generar el archivo con `node tools/build-single.cjs dist/index.html` (cuando exista `index.html`);
   - subir `index.html` o un ZIP con `index.html` en la raíz;
   - marcarlo para jugar en el navegador;
   - en *Embed options*, activar *Mobile friendly* y *Fullscreen button*, con un tamaño vertical de **405×720**
     (orientación Portrait si aparece).
4. **Archivo para compradores** (itch.io no vende sin al menos un archivo descargable): subir
   `Cocardo-completo-offline.zip` con el mismo `index.html` para jugar sin conexión. No marcarlo como
   Windows, Mac ni Linux.
5. **Precio:** *Pricing → Paid →* **1.99**. Es un precio mínimo: el comprador puede pagar más. El cobro es solo en
   dólares. Por defecto itch.io se queda con 10 % y la pasarela con unos US$0,30 + 2,9 %, así que quedan unos US$1,43
   por venta.
6. **Cargar los códigos:** *Edit game → Distribute → External keys*, tipo **Other**. Pegar el contenido de
   `cocardo-codigos-itch-001-1000.txt`. Conviene probar primero con 2 o 3 códigos, porque no está documentado si
   acepta `-` y `_` ni el largo máximo.
   - Cada comprador obtiene una clave, incluidos los compradores anteriores a la carga.
   - Cuando queden menos de 100, generar otro lote (ver abajo).
7. **Instrucciones para el comprador**, en el campo de instrucciones de descarga (aparece en su página de descarga):
   > ¡Gracias por apoyar este juego de fans! Toca «Get key» y copia tu código. Vuelve a la página del juego, abre
   > cualquier nivel con candado (o Ajustes → Versión completa → «Ya tengo un código») y pégalo. Guarda el código: te
   > sirve en cualquier celular o navegador. ¿Problemas? Escríbenos a CORREO.
8. **Descripción de la página.** Incluir: «Juego de fans hecho con permiso de la creadora. Inspirado en la frutinovela
   viral». No hay que nombrarla ni decir «oficial». No marcar contenido adulto, y declarar el uso de IA si se usó.
9. **Configurar el juego** en `js/store.js`:
   - `buyUrl`: la URL de la página, `https://USUARIO.itch.io/JUEGO`;
   - `contact`: el correo.

   `price` ya es `'US$1,99'`. Al poner los dos, se encienden los candados. Correr `node --test tests/*.test.js`,
   volver a generar el archivo y subirlo.
10. **Probar una compra:** *Distribute → Download keys*, crear un grupo de 1 llave con acceso a claves externas y dejar
    la página en *Public restricted*. Canjear ese código en el juego y **anular su serie** después (agregarla a
    `License.REVOKED`), porque gasta un código real.
11. **Publicar:** visibilidad **Public**.

### Día a día
- **Reembolsos:** *Earnings → Payments →* el pago *→ Issue refund…* (lo aprueba itch.io). En
  `itch.io/dashboard/purchases?refunded` se ve qué código recibió el comprador. Agregar su serie a `License.REVOKED`. No
  anular nunca códigos vigentes: quitar un acceso pagado viola las reglas de itch.io.
- **Cobros:** el saldo se libera 7 días después de cada venta, con un mínimo de US$5 y unos 10 a 14 días de revisión.
  Conviene un retiro al mes, porque las ventas sin retirar en 12 meses pierden 10 % mensual.
- **Más códigos** (en una computadora con Node.js y el repo, o pidiéndoselo a Claude con la carpeta privada):
  ```bash
  node tools/license.cjs batch --key RUTA/cocardo-licencia.pem --from 1001 --count 1000 \
    --csv RUTA/cocardo-codigos-1001-2000.csv --txt RUTA/cocardo-codigos-itch-1001-2000.txt
  node tools/license.cjs sign   --key RUTA/cocardo-licencia.pem --serial 5001 --note "regalo"   # un código suelto
  node tools/license.cjs verify "<código>"                                                     # revisar un código
  ```
  El registro `licencias.csv` (junto a la clave) evita repetir series.
- **Apagar la venta** (por ejemplo, si llega un reclamo): vaciar `buyUrl`. Todo queda gratis para todos y los
  compradores no pierden nada.
- **Si el juego también se aloja fuera de itch.io** (dominio propio): ahí sí funciona el enlace `#licencia=`. Se generan
  los códigos con `--url https://SITIO/` y el CSV trae una columna `enlace`.

### Dudas abiertas
- **El correo de compra:** si incluye el código o solo el enlace a la página de descarga.
- **El archivo de relleno:** si basta un PDF en vez del juego descargable (las guías de itch.io se contradicen).
- **Impuestos:** el alcance real de la retención para Perú y los impuestos peruanos; consultar a soporte y a un
  contador.
- **El iframe de itch.io:** no permite escribir en el portapapeles. «Copiar mi código» cae en un cuadro de texto
  seleccionado, y Safari podría borrar lo guardado: el jugador puede volver a pegar su código.

Fuentes de esta sección:
- https://itch.io/docs/creators/html5
- https://itch.io/docs/creators/payments
- https://itch.io/docs/creators/pricing
- https://itch.io/docs/creators/download-keys
- https://itch.io/docs/creators/getting-started
- https://itch.io/docs/creators/quality-guidelines
- https://itch.io/docs/creators/how-buying-works
- https://itch.io/docs/legal/terms
- https://itch.io/updates/manage-your-external-keys
- https://itch.io/updates/more-embed-options-for-html5-games
- https://itch.io/t/32896/attaching-a-product-key-to-your-software
- https://itch.io/t/312740/how-can-i-quickly-issue-a-refund-to-a-customer
- https://www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-z

## 7. Qué falta en el resto del juego (Shell)

`js/core/license.js`, `js/store.js`, `css/store.css`, `tools/license.cjs` y sus pruebas ya existen. Cuando se construya
el Shell (ARQUITECTURA §1), quien lo haga debe:
- cargar los scripts y el CSS en el orden de ARQUITECTURA §0;
- llamar `Cocardo.Store.init()` en `main.js` después de `Cocardo.Save.load()`;
- mostrar el candado dorado en los niveles donde `Store.isLocked(id)` dé `true` y, al tocarlos, llamar
  `Store.open('paywall', {reason:'lock'})`;
- abrir `Store.open('paywall', {reason:'cliff'})` después de cliff10, solo la primera vez (`seen.paywall10`);
- poner en Ajustes el botón «Versión completa» → `Store.open('status')`;
- incluir `license: null` en los valores por defecto de Save y hacer que `reset()` la conserve;
- mostrar el marco dorado del Álbum cuando `Store.isFull()` dé `true`;
- llamar `Store.onChange(fn)` para redibujar el mapa al canjear.

## 8. Para revisar después

- **Anuncios:** solo con licencia y pasada la ola, mejor a través de un portal (Poki o CrazyGames) que se encargue del
  consentimiento y de la privacidad infantil. Nunca después de una derrota, antes de «Compartir» ni en el Reto Diario.
- **Mercado Pago (Yape en Perú, OXXO en México):** solo si hay demanda local. La entrega sería manual, con un código por
  correo.
- **Medir la conversión:** sin analítica, se mide con las ventas de la tienda frente a las visitas del sitio.

## Fuentes principales

- Políticas de Google sobre derechos de autor: https://support.google.com/publisherpolicies/answer/10402772
- Contenido para niños en AdSense: https://support.google.com/adsense/answer/3248194
- Requisitos de AdSense: https://support.google.com/adsense/answer/9724 · Umbral de pago: https://support.google.com/adsense/answer/1709871
- Poki, propiedad intelectual: https://developers.poki.com/guide/content-player-safety · CrazyGames: https://docs.crazygames.com/requirements/intro/
- itch.io, términos: https://itch.io/about/terms · Pagos: https://itch.io/docs/creators/payments · Claves externas: https://itch.io/t/3023373/distributing-external-keys-through-itch
- Payhip, claves de licencia: https://help.payhip.com/article/317-software-license-keys-new
- Límites de GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- COPPA (actualización 2025): https://www.lw.com/en/insights/2025/05/ftc-publishes-updates-to-coppa-rule
- LFPC México, art. 76 bis: https://mley.mx/LFPC/articulo/76-bis/
- Poder adquisitivo (Banco Mundial): https://data.worldbank.org/indicator/PA.NUS.PRVT.PP
- Conversión en juegos gratuitos (Swrve): https://gamesbeat.com/swrve-finds-that-only-1-35-of-players-spend-money-in-mobile-games/
- Ritmo de anuncios en CrazyGames: https://docs.crazygames.com/resources/midgame-ads-pacing/
- FTC contra Epic (compras de menores): https://www.ftc.gov/node/80648

Las cifras de eCPM de Latinoamérica y las conversiones son **estimaciones** con supuestos explícitos, no datos medidos.
Este documento es un análisis práctico de riesgo y no reemplaza la asesoría legal.
