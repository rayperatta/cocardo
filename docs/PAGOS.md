# Venta del juego completo: cómo activar los pagos (Paddle)

El juego se puede seguir jugando gratis hasta el nivel 10. Al activar la venta se suma una **compra única, el «juego
completo»**, que quita ese tope. La cobra **Paddle**, que es el comerciante registrado (*Merchant of Record*): cobra,
emite la factura al comprador, paga el IVA o el *sales tax* de cada país, atiende reembolsos y contracargos, y te paga
a ti lo que queda una vez al mes.

Todo el código está en `js/pay.js` (juego), `tools/pay-worker/worker.js` (servidor), `firebase/firestore.rules`,
`tools/setup-paddle.cjs` y `tools/setup-cloudflare-pay.sh`. Mientras `pay.on` sea `false` en `js/cloud-config.js`
**no cambia nada**: no hay candado y no se descarga nada extra. Tiempo estimado: 1 hora para el sandbox (§1 a §5) y lo
que tarde Paddle en verificar tu cuenta real (§6). Costo fijo: **US$0**; por venta, ver §9.

## 0. Resumen

**Qué se vende.** «Cocardo: juego completo», pago único, sin suscripción.

| Comprador en… | Paga | Moneda |
|---|---|---|
| Eurozona (AT, BE, BG, HR, CY, EE, FI, FR, DE, GR, IE, IT, LV, LT, LU, MT, NL, PT, SK, SI, ES) | **1,99 €** | EUR, precio fijo |
| Resto del mundo | **US$1,99** convertido a su moneda local (p. ej. pesos mexicanos, soles) | la suya, conversión automática de Paddle |

El precio **ya incluye los impuestos** en todos lados (`tax_mode: internal`): el comprador paga 1,99 justos y el IVA sale
de ahí.

**Qué abre.** Los niveles **1 a 10 son gratis**. La progresión no cambia: ganar un nivel abre el siguiente
(`save.unlocked`). Lo único nuevo es que quien no pagó **no puede empezar un nivel mayor que 10**, ni los de hoy ni los
de los capítulos que vayan saliendo (hasta 120). Pagar quita ese tope y nada más: no salta niveles. El **Reto Diario
sigue gratis** para todos, aunque use tableros de la campaña.

**Jugadores de antes.** Quien ya jugaba antes de la venta no pierde nada: la primera vez que el juego arranca con la
venta encendida, si el guardado de **ese aparato** ya tenía abierto un nivel mayor que 10 (o ya había ganado el 11,
`stars[10] > 0`), queda con permiso de **aparato** (sin comprar). Se decide **una sola vez** y con el guardado del
aparato tal como está al abrir, antes de juntarlo con la nube: el progreso que llega después no cuenta, porque cualquier
cuenta puede escribir su propio guardado en la nube y quien compró, ganó el 11 y pidió el reembolso no debe quedarse
con todo. Un jugador antiguo cuyo progreso solo está en la nube (abre en un aparato nuevo después del lanzamiento, o
Safari le borró los datos) no lo recibe solo: dale el permiso a mano (§6.3, «Jugadores antiguos en otro aparato»).

**Dónde vive la compra.** En una frase: la compra vive en entitlements/{uid}, escrita solo por el Worker. Las reglas
dejan que cada cuenta lea la suya y que nadie la escriba desde el navegador; el Worker entra con una cuenta de servicio
de Google (IAM), que no pasa por las reglas. El juego guarda una copia local en `localStorage` (`cocardo.v1.premium`),
**nunca** dentro del guardado (`cocardo.v1`) ni en `users/{uid}`: ahí escribe el navegador y `Progress.merge` se queda
con el máximo de cada campo, así que un permiso copiado ahí no se podría quitar nunca (ni con un reembolso).

**Cómo funciona una compra.**

```
 Juego (js/pay.js)                     Worker cocardo-pagos (cocardo.app/api/*)          Paddle
 nivel 11 → candado → «Comprar»
 sin sesión: Cloud.signInAnon() → uid
 POST /api/checkout (Bearer token) ──► verifica el token
                                       POST /transactions {precio, custom_data:{uid}} ──► crea txn_…
 { transactionId, checkoutUrl } ◄───── responde
 Paddle.Checkout.open(transactionId) ────────────── el jugador paga ──────────────────► cobra, factura, IVA
   (TikTok/Instagram: también «Pagar en Safari/Chrome» = checkoutUrl …/?_ptxn=txn_…)
                                       POST /api/webhook ◄── transaction.completed (firmado) ──┘
                                       Firestore, con la cuenta de servicio:
                                         orders/{txn} = paid
                                         entitlements/{uid} = { premium:true, … }
 escucha entitlements/{uid} ◄───────── (reglas: solo la de su propio uid, solo lectura)
 se quita el candado («¡Gracias!»)
```

- **Reembolso o contracargo** (`adjustment.created` / `adjustment.updated`): un **reembolso completo** aprobado, un
  contracargo o un aviso de contracargo (`chargeback_warning`; en los dos Paddle ya le devolvió el dinero al comprador)
  marcan la orden `refunded` y borran el permiso; el candado vuelve. Un **reembolso parcial** no quita nada (un
  descuento de cortesía, o el IVA que Paddle devuelve solo cuando el comprador añade un número fiscal): si quieres
  quitarlo, reembolsa el total. Si Paddle gana la disputa (`chargeback_reverse` o `chargeback_warning_reverse`) el
  permiso vuelve, salvo que esa compra también tenga un reembolso: eso es definitivo.
- **Otro aparato:** entrar con la misma cuenta de Google. Si compró con apodo: «Vincular con Google» en Ajustes. Si esa
  cuenta de Google es nueva para el juego, el uid no cambia y la compra sigue; si ya existía (jugó con Google en otro
  aparato), Firebase entra con ella y el juego le pide al Worker que traiga la compra de la sesión con apodo (prueba
  las dos sesiones, sin factura). Si eso falla, o si cerró la sesión con apodo antes, la compra queda en esa sesión y el
  juego avisa para usar **«Ya pagué»**: número de factura de Paddle + correo de la compra → `/api/restore` lo verifica
  con Paddle y **mueve** el permiso a la cuenta actual. Hasta 5 traslados por compra; volver a la cuenta que pagó, o a
  una cuenta de Google cuyo correo verificado es el de la compra, no cuenta.
- **Lo que el candado protege y lo que no:** el candado corre en el navegador, así que quien sepa editar `localStorage`
  puede saltarlo (por ejemplo, fingiendo ser jugador antiguo). Con un precio de 1,99 no compensa blindarlo; lo que sí
  está protegido es la compra en la nube: el permiso de una cuenta solo lo escribe el Worker, y el progreso guardado
  (que sí escribe el navegador) nunca da permiso. Para pasar una compra a otra cuenta hace falta la factura y el correo
  (o las dos sesiones). El correo no es secreto y el número de factura se puede adivinar, así que el Worker limita los
  intentos (§3 y §6.5) y el comprador siempre puede recuperarla desde su cuenta original o desde Google con su correo.

**Estado al 17 de octubre de 2026:**

| Pieza | Estado |
|---|---|
| Hosting del juego | **En Cloudflare**: Worker de archivos estáticos `cocardo-sitio` (ruta `cocardo.app/*`), publicado con `tools/deploy-cloudflare.sh`, que arma `dist/site/` con `tools/cloudflare/build-site.cjs`. GitHub Pages queda como respaldo del origen: apágalo antes de vender (§6.6). |
| Worker del login (`/__/*`) | Funciona. |
| Worker de pagos (`/api/*`) | Publicado **en sandbox** en `cocardo.app/api/*` (`/api/health` → `{"ok":true,"env":"sandbox"}`). |
| Reglas de Firestore | Subidas, con los bloques `entitlements/{uid}` y `orders/{id}`. |
| Paddle sandbox | Producto, precio y destino del webhook creados (`tools/setup-paddle.cjs`). Enlace de pago por defecto: un `localhost`, para probar en local (§1.4). |
| Paddle live | Cuenta creada y **dominio `cocardo.app` en revisión** (*Website approval*). Hasta que se apruebe, el panel live no acepta el enlace de pago por defecto y no puede haber pagos reales (§6.2). |
| Venta en el juego | `pay.on: false` en `js/cloud-config.js`: nadie ve el candado todavía. |
| Páginas legales y precio | Hechas en el repositorio (`legal/`, sección «¿Cuánto cuesta?» de la landing, enlaces en el juego) y **sin publicar**: faltan el nombre legal y el correo de soporte (`tools/legal-datos.cjs`, §6.2). |

## 1. Paddle sandbox (pruebas sin dinero de verdad)

El sandbox es una cuenta **aparte** de la real, con su propio panel, claves y datos. Nada de lo que hagas aquí pasa a la
cuenta real: en §6 se repite lo necesario.

### 1.1 Crear la cuenta

1. Entra en <https://sandbox-vendors.paddle.com/signup> y crea la cuenta (tu correo; el nombre del negocio puede ser
   tu nombre). Confirma el correo. El panel queda en <https://sandbox-vendors.paddle.com/>.
2. El sandbox no pide verificar identidad ni dominio. Ojo: los correos del sandbox solo llegan a direcciones del mismo
   dominio que tu cuenta; los demás se reenvían al correo principal de la cuenta (útil para ver los recibos).

### 1.2 Claves de API (dos)

**Paddle → My account → Settings → Authentication → pestaña API keys → New API key.** Pon nombre, descripción,
permisos y vencimiento, y **Save**. La clave se muestra **una sola vez**: cópiala en ese momento. Empieza con
`pdl_sdbx_apikey_` (en live, `pdl_live_apikey_`).

| Clave | Permisos | Vencimiento |
|---|---|---|
| «setup» (para `tools/setup-paddle.cjs`) | `product.write`, `price.write`, `notification_setting.write` (*write* incluye *read*) | corto, p. ej. 1 semana |
| «worker» (para el Worker, `PADDLE_API_KEY`) | `transaction.write` (crea el pago y busca la factura de «Ya pagué») y `customer.read` (el correo del comprador) | el máximo, **1 año**; anota la fecha |

Las claves vencen (90 días por defecto, como mucho 1 año) y no se pueden renovar: hay que crear otra. Si la del Worker
vence, «Comprar» deja de funcionar hasta que subas una nueva con `tools/setup-cloudflare-pay.sh` (§3).

### 1.3 Token del lado del cliente

**Paddle → My account → Settings → Authentication → pestaña Client-side tokens → New client-side token** → nombre →
**Save** → botón junto al token → **Copy**. Empieza con `test_` (en live, `live_`). Este sí se puede publicar: solo
sirve para abrir pagos y consultar precios. Va en `js/cloud-config.js` → `pay.token`.

### 1.4 Enlace de pago por defecto

**Paddle → Checkout → Checkout configuration → Default payment link** → `https://cocardo.app/` → **Save**.

Es obligatorio **antes de crear transacciones** (sin él, «Comprar» falla). Paddle arma con él el enlace de cada pago
(`https://cocardo.app/?_ptxn=txn_…`), que es el botón «Pagar en Safari/Chrome»: al abrirlo, `js/pay.js` carga Paddle.js
y el pago se abre solo. En el sandbox sirve cualquier dirección, hasta `https://localhost/` (hoy el del sandbox apunta a
un `localhost` para probar desde tu computadora, §5.6); en live tiene que ser un dominio **aprobado** (§6.2) y una
página que cargue Paddle.js (la del juego lo hace cuando la dirección trae `?_ptxn=` y la venta está encendida). Por eso
el de live se pone **después** de la aprobación del dominio: `https://cocardo.app/`.

### 1.5 Monedas: conversión automática y moneda de saldo

**Paddle → My account → Settings → Currencies**: marca **Select all** (las monedas que Paddle convierte solo) →
**Save**. Así, fuera de la eurozona cada comprador ve US$1,99 convertido a su moneda (el orden que usa Paddle: precio
fijo del país → conversión automática → precio base en US$). Chile y Perú ya se cobran en CLP y PEN.

En la misma página está la **moneda de saldo** (en la que Paddle te acumula lo ganado): elige **EUR**, porque tu cuenta
de banco está en euros y así las ventas de la eurozona no pagan conversión.

### 1.6 Métodos de pago

**Paddle → Checkout → Checkout configuration → Payment methods**: la tarjeta va siempre. Marca además **PayPal**,
**Apple Pay**, **Google Pay**, **MB WAY** (Portugal, solo pagos en EUR), **Pix** (Brasil, BRL), **iDEAL | Wero**
(Países Bajos), **Bancontact** (Bélgica) y **BLIK** (Polonia) → **Save**. Paddle muestra a cada comprador solo los que
corresponden a su país, moneda y aparato. Dentro de TikTok o Instagram lo seguro es tarjeta y PayPal; para Apple Pay o
Google Pay está el botón «Pagar en Safari/Chrome».

### 1.7 Producto, precio y webhook con `tools/setup-paddle.cjs`

El script crea (o corrige, si ya existen) el producto, el precio y el destino del webhook. Primero mira qué haría:

```bash
node tools/setup-paddle.cjs --dry-run                 # imprime las peticiones; no envía nada ni pide clave
```

Y después, de verdad (pega la clave «setup» cuando `read` la pida; así no queda en el historial):

```bash
bash                                                   # si tu terminal es fish: estos comandos son de bash
read -rs PADDLE_API_KEY && export PADDLE_API_KEY       # pega la clave y Enter (no se ve)
PADDLE_ENV=sandbox node tools/setup-paddle.cjs --site https://cocardo.app
```

Qué crea:

- **Producto** «Cocardo: juego completo» con `tax_category: standard` (*Standard Digital Goods*: software escrito de
  antemano que se instala en el aparato; es lo que se vende, un juego que se instala como app y funciona sin conexión.
  Además es la categoría que viene aprobada; las otras hay que pedirlas).
- **Precio** de pago único: `"199"` USD, `tax_mode: internal`, cantidad mínima y máxima 1, y `"199"` EUR para los 21
  países de la eurozona.
- **Destino de notificaciones** `https://cocardo.app/api/webhook` con `transaction.completed`, `adjustment.created` y
  `adjustment.updated` (en el sandbox también recibe simulaciones, §5.6).

Al final imprime `PADDLE_PRICE_ID=pri_…` y **una sola vez** `PADDLE_WEBHOOK_SECRET=pdl_ntfset_…`: cópialo ahí mismo,
es un secreto del Worker (§3) y no se guarda en ningún archivo. Si lo pierdes: el mismo comando con `--show-secret`
(o Paddle → Events → Notifications → editar el destino). Correrlo otra vez no duplica nada.

Los valores del sandbox (`token: 'test_…'` y el `priceId` de sandbox) van **solo en tu copia local** de
`js/cloud-config.js` para probar (§5.1) y **nunca se publican**: el sitio sirve ese archivo tal cual, y con el token de
prueba y el precio cualquiera podría abrir un pago de sandbox desde su propia página y pagarlo con la tarjeta de prueba.
`tools/cloudflare/build-site.cjs` arma la publicación desde tu copia local y **se niega** si la venta está encendida con
`env` distinto de `'live'`, un token `test_…` o `apiBase`. En el
repositorio `pay` queda como está (`on: false`, `token: ''`, `priceId: ''`) hasta el paso a live (§6.3). Además el
Worker de sandbox solo da permisos a las cuentas de `TEST_UIDS` (§3).

## 2. Cuenta de servicio de Google para el Worker

El Worker escribe `entitlements` y `orders` con una cuenta de servicio del proyecto de Firebase
(`graceful-system-406208`) que solo puede leer y escribir datos de Firestore.

1. Entra en <https://console.cloud.google.com/> y arriba elige el proyecto **graceful-system-406208**.
2. Menú ☰ → **IAM & Admin** (IAM y administración) → **Service Accounts** (Cuentas de servicio) →
   **+ Create service account**.
3. Nombre: `cocardo-pagos` (el ID queda `cocardo-pagos`). Descripción: «Worker de pagos de Cocardo». **Create and
   continue**.
4. En *Grant this service account access to project* → **Select a role** → **Datastore → Cloud Datastore User**
   (`roles/datastore.user`, lectura y escritura de datos de Firestore; no puede borrar la base ni tocar reglas).
   **Continue** → **Done**.
5. Haz clic en el correo de la cuenta (`cocardo-pagos@graceful-system-406208.iam.gserviceaccount.com`) → pestaña
   **Keys** → **Add key → Create new key → JSON → Create**. Se descarga un archivo `.json` (no se puede volver a bajar).

Si al crear la clave aparece «Service account key creation is disabled», es la política
`iam.disableServiceAccountKeyCreation`, que Google activa en las **organizaciones** creadas desde mayo de 2024. Con un
proyecto de una cuenta Gmail sin organización no debería salir.

Del JSON solo hacen falta dos campos, que se pasan como variables a `tools/setup-cloudflare-pay.sh` (§3):

```bash
bash                                                   # si estás en fish
CLAVE=~/Downloads/graceful-system-406208-xxxxxxxxxxxx.json   # la ruta del archivo que se descargó
export GCP_SA_EMAIL="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["client_email"])' "$CLAVE")"
export GCP_SA_KEY="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["private_key"])' "$CLAVE")"
```

`GCP_SA_KEY` es la `private_key` tal cual (`-----BEGIN PRIVATE KEY-----…`, PEM PKCS8). Cuando el script de §3 termine
bien, **borra el `.json`** (y vacía la papelera): la clave queda guardada como secreto en Cloudflare. Si un día se
filtra, en la misma pestaña **Keys** la borras y creas otra.

## 3. Cloudflare: subir el Worker `cocardo-pagos`

**Token** (Cloudflare → My Profile → API Tokens → **Create Token → Create Custom Token**):

- Account → **Workers Scripts → Edit**
- Zone → **Workers Routes → Edit**
- Account Resources: *Include → tu cuenta*. Zone Resources: *Include → Specific zone → cocardo.app*.

El token del login (`tools/setup-cloudflare-auth.sh`) ya tiene esos dos permisos; puedes reutilizarlo.

**Correr el script** en la misma terminal bash donde exportaste `PADDLE_API_KEY` (la clave «worker» de §1.2) y las dos
`GCP_SA_*`:

```bash
read -rs CLOUDFLARE_API_TOKEN && export CLOUDFLARE_API_TOKEN
read -rs PADDLE_API_KEY && export PADDLE_API_KEY                # ahora la clave «worker», no la «setup»
read -rs PADDLE_WEBHOOK_SECRET && export PADDLE_WEBHOOK_SECRET  # el que imprimió setup-paddle.cjs
PADDLE_ENV=sandbox PADDLE_PRICE_ID=pri_… TEST_UIDS="<tu uid>" \
SITE_ORIGINS="https://cocardo.app,http://localhost:8080" \
  tools/setup-cloudflare-pay.sh cocardo.app graceful-system-406208
```

Qué hace: sube `tools/pay-worker/worker.js` con sus **variables** (`PADDLE_ENV`, `PADDLE_PRICE_ID`,
`FIREBASE_PROJECT`, `FIREBASE_API_KEY` —la de `js/cloud-config.js`, que es pública—, `SITE_ORIGINS` y, si viene,
`TEST_UIDS`) y el **límite de pedidos** (binding `RATE_LIMIT`: 6 pedidos por minuto por IP y por cuenta a
`/api/checkout` y `/api/restore`; el webhook no se limita), guarda los **secretos** que vengan en el entorno
(`PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `GCP_SA_EMAIL`, `GCP_SA_KEY`; los que no vengan quedan como estaban), crea
la ruta `cocardo.app/api/*` y prueba `https://cocardo.app/api/health`. No toca la ruta `/__/*` del login. Es
idempotente: para cambiar solo un secreto, córrelo con las tres variables obligatorias y ese secreto. El destino del
webhook ya lo creó `tools/setup-paddle.cjs` (§1.7): no crees otro a mano en el panel, porque cada destino tiene su
propio secreto y el Worker acepta uno solo.

**`TEST_UIDS` (solo sandbox).** El Worker de sandbox escribe en el Firestore **de producción**, así que solo las cuentas
de esa lista (uids separados por comas) pueden pedir un pago, recibir el permiso o usar «Ya pagué»; una compra de
sandbox de cualquier otra cuenta queda sin dueño. Sin `TEST_UIDS` no da permisos a nadie. Tu uid: consola de Firebase →
**Authentication → Users** → columna *User UID* (entra una vez en el juego con tu cuenta de Google; para probar con
apodo, toca «Jugar con apodo», busca la fila anónima nueva y añade ese uid). Para cambiar la lista, vuelve a correr el
script con las variables obligatorias y `TEST_UIDS`. En live no se usa.

**Límite de pedidos.** Si Cloudflare rechaza la subida por el binding `RATE_LIMIT`, córrelo con `RATE_LIMIT=off` y usa
solo la regla del WAF de §6.5.

`SITE_ORIGINS` son los orígenes que pueden llamar al Worker desde un navegador; deja `https://cocardo.app` **primero**.
`http://localhost:8080` es solo para probar desde tu computadora con el sandbox (§5.1): **quítalo en live**.

Comprueba: `curl https://cocardo.app/api/health` → `{"ok":true,"env":"sandbox"}`. Los logs del Worker: Cloudflare →
Workers & Pages → cocardo-pagos → Logs.

## 4. Subir las reglas de Firestore

Las reglas **no** se publican con `git push`. Desde la carpeta `firebase/` del repositorio (ya unida con `main`):

```bash
cd firebase
npx --yes firebase-tools@15 deploy --only firestore:rules --project graceful-system-406208
# o, si tienes la CLI instalada:  firebase deploy --only firestore:rules --project graceful-system-406208
```

Comprueba en la consola de Firebase → Firestore Database → **Rules** que aparecen los bloques `entitlements/{uid}` y
`orders/{id}`. Con el botón **Rules Playground** de esa misma pestaña: `get` de `/entitlements/abc` autenticado como
`abc` → permitido; como otro uid → denegado; cualquier `create`/`update` de `entitlements` u `orders` → denegado.

## 5. Probar en el sandbox

### 5.1 Desde tu computadora

1. El Worker en sandbox con `SITE_ORIGINS="https://cocardo.app,http://localhost:8080"` y tu uid en `TEST_UIDS` (§3).
2. En tu copia local de `js/cloud-config.js` (**no lo subas así**, ver §1.7):
   `pay: { on: true, freeLevels: 10, env: 'sandbox', token: 'test_…', priceId: 'pri_…', apiBase: 'https://cocardo.app' }`.
   `apiBase` hace que el juego local llame al Worker publicado.
3. Sirve el juego: `python3 -m http.server 8080` en la raíz del repositorio y abre <http://localhost:8080/#debug>
   en una **ventana privada** (desde `file://` la venta está apagada a propósito) y entra con la cuenta de Google de
   `TEST_UIDS`. Si ese navegador ya tenía abierto un nivel mayor que 10, la primera vez te toma por jugador antiguo y
   no verás el candado; en ese caso borra `cocardo.v1.premium` y `cocardo.v1.premium.checked` de `localStorage`. Con
   `#debug`, `Cocardo.debug.unlockAll()` en la consola te deja llegar al nivel 11 sin jugar diez niveles (abre
   niveles, no da estrellas). Con la venta encendida `#debug` solo funciona en `localhost` y parecidos, nunca en
   `cocardo.app`.

### 5.2 Tarjetas de prueba

Nombre cualquiera, vencimiento cualquiera en el futuro y CVC `100` (el de la guía de Paddle):

| Caso | Número |
|---|---|
| Pago bueno, sin 3DS | `4242 4242 4242 4242` |
| Pago bueno, con 3DS (aparece la ventana del banco) | `4000 0038 0000 0446` |
| Visa débito buena | `4000 0566 5566 5556` |
| Rechazada | `4000 0000 0000 0002` |
| Buena la primera vez, rechazada después | `4000 0027 6000 3184` |

Las tarjetas de prueba no sirven en live y las reales no sirven en el sandbox.

### 5.3 Una compra completa

1. Nivel 11 → candado → **Comprar** → paga con `4242…`.
2. Paddle → **Transactions**: la transacción en *Completed*. En Paddle → **Events**, el aviso `transaction.completed`
   entregado a tu destino (respuesta 200).
3. Firebase → Firestore: `orders/txn_…` con `status: "paid"` y `entitlements/<uid>` con `premium: true`.
4. En el juego desaparece el candado («¡Gracias!»). Recarga: sigue abierto.
5. Con la rechazada (`4000 0000 0000 0002`): error en el pago y nada en Firestore.

### 5.4 Reembolso y contracargo

- **Reembolso:** Paddle → Transactions → la transacción → **Refund** → motivo → **importe completo** (uno parcial no
  quita el permiso) → confirmar. En el
  sandbox Paddle aprueba los reembolsos solo, cada 10 minutos; entonces llega `adjustment.updated`, la orden pasa a
  `refunded`, se borra `entitlements/<uid>` y el candado vuelve (en vivo, con el juego abierto; salvo que ese
  navegador tenga además el permiso de jugador antiguo). No se puede pedir otro ajuste de la misma transacción mientras
  uno espera aprobación.
- **Contracargo:** no se pueden crear a mano (solo Paddle los crea cuando el banco del comprador reclama). Para probar
  que el Worker los atiende: Paddle → **Events → Simulations → New simulation** → tu destino → *Single event*
  `adjustment.created` → en **Payload** cambia `action` a `chargeback` (o `chargeback_warning`), `status` a
  `approved` y `transaction_id` por un `txn_…` real del sandbox → **Replay**. Con `chargeback_reverse` vuelve,
  salvo que esa compra ya tenga un reembolso.

### 5.5 «Ya pagué» (otro aparato)

1. Abre el juego en otra ventana privada con **otra** cuenta de `TEST_UIDS` (una segunda cuenta de Google, o un apodo
   cuyo uid añadiste) → nivel 11 → **Ya pagué**.
2. Número de factura: Paddle → Transactions → la transacción (también viene en el recibo de Paddle, con forma
   `325-10566`) + el correo que escribiste al pagar.
3. Se abre en esta cuenta y la cuenta anterior pierde ese permiso (si tenía otra compra pagada, se queda con esa). Una
   factura o un correo que no coinciden dan un error genérico (no dice cuál falló); si el aviso de la compra todavía no
   llegó al Worker, responde «pendiente» y hay que reintentar en un minuto; después de 5 traslados de la misma compra
   responde «límite», salvo hacia la cuenta que pagó o hacia una cuenta de Google con el correo de la compra.
4. **Apodo y luego un Google que ya existía:** compra con apodo (su uid en `TEST_UIDS`) y después **Entrar con Google**
   con una cuenta que ya usaste en el juego: la compra pasa sola a esa cuenta (en el Worker queda el log `carry`).

### 5.6 Más pruebas

- **Firma del webhook sin pagar:** Events → Simulations → *Single event* `transaction.completed` → Run. El Worker
  responde 200 y lo ignora (el ejemplo de Paddle no trae tu precio; si lo trajera sin `uid`, guarda la orden sin dueño
  y sin permiso); un 401 en las entregas significa que el secreto del Worker no es el de
  este destino (§3).
- **Jugador antiguo:** en un navegador que ya tenga abierto un nivel mayor que 10, enciende la venta: no aparece el
  candado y en `localStorage` queda `cocardo.v1.premium` con `device.legacy: true`.
- **Reto Diario:** sigue abriendo sin comprar.
- **«Pagar en Safari/Chrome»:** el enlace apunta al enlace de pago por defecto (§1.4). Para probarlo en local cambia
  ese enlace del sandbox a `http://localhost:8080/` (Paddle documenta `https://localhost/` para el sandbox; si el panel
  no acepta el puerto, pruébalo cuando el juego ya esté publicado con la venta en live, con una compra real que luego
  reembolsas).

## 6. Pasar a live (checklist)

### 6.1 Cuenta real y verificación

1. Crea la cuenta en <https://vendors.paddle.com/signup> (como persona/autónomo: no te piden registro de empresa).
   Conviene hacerlo pronto, porque la verificación va en paralelo con el resto.
2. Paddle verifica tres cosas: **dominio** (§6.2), **negocio** (no aplica a personas) e **identidad**: con Sumsub,
   documento de identidad, a veces comprobante de domicilio y un video corto de «prueba de vida». Suele ser
   instantáneo; si va a revisión manual, 1 a 3 días hábiles.
3. **Payouts:** Paddle → Business account → Payouts → Payout settings: tu IBAN y el mínimo para cobrar.

### 6.2 Aprobación del dominio (cocardo.app): qué mira Paddle y dónde está

Se pide en **My account → Settings → Website approval** (en live; el sandbox no la tiene). Estados: `pending_review` →
`in_review` → `approved`, `rejected` o `action_required` (rechazo suave: se arregla y se vuelve a enviar). La mayoría se
aprueba sola; la revisión manual tarda unos 5 a 7 días hábiles, sin garantía. **Mientras no esté aprobado, el panel live no
guarda el enlace de pago por defecto** (§1.4) y sin él ningún pago live funciona, ni siquiera en un dominio aprobado.

**Antes de que el revisor mire el sitio** (en este orden):

1. **Datos del vendedor.** Las páginas llevan cuatro marcadores, todos obligatorios: `{{NOMBRE_LEGAL}}`,
   `{{EMAIL_SOPORTE}}`, `{{DIRECCION_POSTAL}}` y `{{NIF}}`. `node tools/legal-datos.cjs` lista dónde está cada uno;
   para rellenarlos:

   ```bash
   NOMBRE_LEGAL='Nombre Apellido Apellido' EMAIL_SOPORTE='soporte@cocardo.app' \
   DIRECCION_POSTAL='Calle, número, código postal, ciudad' NIF='123456789' node tools/legal-datos.cjs --write
   ```

   Sin alguno de los cuatro, `--write` no escribe nada y `build-site.cjs` no publica. (El encargo inicial solo preveía
   nombre y correo; dirección y NIF se añadieron a propósito por la ley portuguesa, abajo.)

   - **Nombre:** el nombre legal completo, **el mismo de la verificación de identidad de Paddle** (usar el nombre del
     proyecto en vez del legal es una causa común de rechazo).
   - **Correo:** uno que funcione y que leas (p. ej. `soporte@cocardo.app` con Cloudflare Email Routing hacia tu Gmail:
     mándate una prueba). Es el contacto de las páginas legales, del enlace «Contacto» de Ajustes y de la ayuda con
     compras del juego (`CloudConfig.legal.email`; `pay.support` vacío usa este).
   - **Dirección (obligatoria; decisión tuya antes de publicar):** la ley portuguesa de comercio electrónico (DL 7/2004,
     art. 10.º, n.º 1) obliga a tener siempre en línea el nombre, la **dirección geográfica**, el correo y el **NIF** del
     prestador, y la política de privacidad mínima de Paddle pide una dirección. Si no quieres publicar la de tu casa,
     usa una dirección profesional o de domiciliación (un apartado de CTT es solo postal: confírmalo con la
     contabilista). Nunca se deja en blanco: el script ya no quita los renglones.
   - **NIF:** tu número de identificación fiscal portugués (9 cifras; el script comprueba el dígito de control). Sale en
     Términos §1 y §14, en Privacidad §1 y en los resúmenes en inglés y portugués.
2. **Publicar.** Revisa `git diff`, haz commit y `CLOUDFLARE_API_TOKEN=… tools/deploy-cloudflare.sh`. `build-site.cjs`
   no publica mientras quede un marcador `{{…}}` (ni con la venta encendida en modo sandbox) y el `--check` del script
   comprueba que `/legal/terminos`, `/legal/privacidad` y `/legal/reembolsos` dan 200 y no tienen marcadores.
3. **Responder a Paddle.** Si llegó un correo de revisión o el estado es `action_required`, contesta ese correo (en
   inglés) con los enlaces. Texto sugerido:

   > Hello, cocardo.app is a browser match-3 game, *Cocardo: ¡Rescate Helado!*, created and published by me, <legal
   > name>, a sole proprietor resident in Portugal, and sold through Paddle as Merchant of Record. I own all rights to
   > the game and its characters. Levels 1–10 and the Daily Challenge are free; the full game is a one-time purchase of
   > US$1.99 (€1.99 in the eurozone), taxes included, with no subscription and no ads. Checkout is switched on only after
   > domain approval (the default payment link can't be saved before it), so on the live site today all levels can be
   > played and there is no buy button yet; the attached screenshot shows the in-game purchase screen as it will appear.
   > Pricing: https://cocardo.app/landing#precio · Terms (with the Paddle Merchant of Record statement):
   > https://cocardo.app/legal/terminos · Refund policy (14 days): https://cocardo.app/legal/reembolsos · Privacy
   > policy: https://cocardo.app/legal/privacidad · Support: <email>. Each page is in Spanish with an English version
   > and a Portuguese summary at the bottom.

   Adjunta una captura de la ficha «Juego completo» (en tu copia local con el sandbox: §5.1, nivel 11 o Ajustes →
   «Ver el juego completo»). Paddle acepta una captura cuando la compra todavía no está a la vista.

4. **Al aprobarse, todo junto:** panel live → **Checkout → Checkout settings → Default payment link** →
   `https://cocardo.app/` → Save, y en la misma tanda publica `js/cloud-config.js` con `pay.on: true`, `env: 'live'`, el
   token `live_…` y el `priceId` live (§6.3): la página del enlace de pago por defecto tiene que cargar Paddle.js, y con
   `pay.on: false` no lo carga. Mientras tanto, quien pase del nivel 10 se queda con el acceso del aparato que Términos
   §2 da a los jugadores de antes: cuanto antes se encienda la venta después de la aprobación, mejor.

**Lo que revisa Paddle y dónde se cumple:**

| Paddle pide | Dónde | Cómo |
|---|---|---|
| Descripción clara del producto | `/landing` | Héroe, «Una telenovela que se juega», «Cómo se juega», preguntas frecuentes. |
| Precio público, sin entrar ni jugar | `/landing#precio`, pregunta «¿Cuánto cuesta?», `meta description` y JSON-LD (`offers`: 0 y 1.99 USD) de `/landing` y de `/` | «Gratis para empezar: niveles 1 al 10 y Reto Diario» y «Juego completo: US$1,99 (1,99 € en la zona euro), impuestos incluidos, pago único»; sin suscripción ni anuncios. |
| Qué incluye la compra | `/landing#precio`, Términos §2 y §5 | Los niveles que ya se juegan (11 al 30, capítulos 3 a 6); los capítulos futuros, como actualizaciones incluidas con fecha orientativa, no como lo que se vende. |
| Términos con el nombre legal | `/legal/terminos` §1 y §14 | «El juego lo crea y lo publica {{NOMBRE_LEGAL}}… y lo vende a través de Paddle.com, su revendedor: la compra del juego completo la haces a Paddle; el uso del juego es un contrato con {{NOMBRE_LEGAL}}», con dirección, NIF y correo. |
| Texto de revendedor (*Merchant of Record*) | `/legal/terminos` §3 (español y el inglés literal del manual del vendedor), pie de `/landing` y de las páginas legales, `/landing#precio`, ficha de pago | «Our order process is conducted by our online reseller Paddle.com…» (contrato con Paddle, cláusula 9.2: el sitio debe reflejar que Paddle es revendedor). |
| Términos mínimos | `/legal/terminos` | Aceptación por uso, uso prohibido (ilegal, fraude, spam, propiedad intelectual, malware, sondeos, *scraping*), la propiedad es del vendedor, sin garantía de servicio ininterrumpido, pagos según los términos de compra de Paddle, suspensión por incumplimiento, impago, fraude o riesgo, contacto, menores, ley portuguesa, RAL (CNIACC) y Livro de Reclamações Eletrónico. |
| Política de reembolsos | `/legal/reembolsos` | 14 días sin dar motivos (dentro del 14–90 que admite Paddle), por paddle.net o por correo; explica el desistimiento de la UE sin usarlo para negar reembolsos; después del reembolso se retira el juego completo (lo hace el Worker con `adjustment.*`). Nunca «no hay reembolsos». |
| Política de privacidad | `/legal/privacidad` | Responsable y contacto, cada dato con su fin y base legal, destinatarios (Google Firebase y Cloudflare como encargados, Google Fonts como proveedor independiente, Paddle como responsable independiente), transferencias (DPF y cláusulas tipo), plazos, derechos con respuesta en un mes, reclamación ante la CNPD, seguridad, almacenamiento local sin aviso de cookies, menores, sin analítica. |
| Enlaces a la vista en la navegación | Pie de `/landing` (Términos · Privacidad · Reembolsos · Contacto · Precio · Livro de Reclamações); pie de la Portada del juego (Precio · Términos · Privacidad · Reembolsos · Livro de Reclamações); Ajustes (+ Contacto); `<noscript>` y `<link rel="terms-of-service">` / `privacy-policy` en `index.html` y `landing.html` | Las tres páginas son HTML estático sin scripts ni login. |
| Aceptar Términos y Reembolsos antes de pagar | Ficha «Juego completo» (`js/ui.js`, `pwHtml`; sin imperativos de compra porque el juego atrae a menores) | «Al comprar aceptas los Términos y la Política de reembolsos. Cobra Paddle.com (revendedor y Merchant of Record), que te muestra el precio final antes de pagar.» Encima, el precio local de Paddle o, si no llega, el de lista (US$1,99 / 1,99 €, impuestos incluidos). Entra en 360×560. |
| Contacto del vendedor | Pie de `/landing`, Términos §1 y §14, Privacidad §1, «Contacto» en Ajustes | Correo. El manual del vendedor sugiere además un teléfono; la guía para desarrolladores pide correo o formulario: el teléfono es opcional. |
| Sitio en línea con HTTPS | Cloudflare | `--check` de `tools/deploy-cloudflare.sh`. |
| Producto propio y permitido | Pregunta «¿Quién hace el juego?», pies de la landing y del juego, `icons/og-2.png` e `icons/shot-title.png` | Ya no dice «juego de fans, no oficial» (tampoco en las imágenes) ni presenta el juego como «de la serie» o «inspirado en» otra obra: *La Nieve de Lima* es la historia que cuenta el juego. Ten a mano pruebas de autoría por si Paddle las pide (archivos fuente del arte y la música, historial del repositorio) y **el documento que acredite tus derechos sobre los personajes y la historia**: los apuntes internos del repositorio (`docs/PERSONAJES.md`, versiones anteriores de `docs/VIDEOS.md` y del sitio) citan cuentas de TikTok de la serie, y un revisor que los lea va a preguntar por esa relación. Es un juego con un desbloqueo único: sin azar, sin monedas virtuales, sin mercado. |
| Apple Pay (opcional) | — | Paddle intenta verificarlo después de aprobar el dominio: el archivo `.well-known/apple-developer-merchantid-domain-association` que da Paddle, servido con 200 y sin redirección; añade `.well-known` a `PUBLIC` en `tools/cloudflare/build-site.cjs` y comprueba que Cloudflare lo publica. |

**Para no perder la aprobación:**

- Si cambias la política de reembolsos, avisa a Paddle (lo pide el manual del vendedor) y actualiza la fecha de la página.
- **Reembolsos dentro de los 14 días:** los pedidos que llegan por correo los inicias tú en Paddle (Transactions → la
  transacción → Refund) y quedan pendientes hasta que Paddle los aprueba. Aprueba o inicia **todos** los que lleguen
  dentro de los 14 días, salvo fraude o abuso evidente (lo que dicen Reembolsos §2 y Términos §7). Antes de la primera
  venta, pide a Paddle por escrito (respuesta al correo de revisión o al soporte) que confirme que respeta una política
  del vendedor más generosa que la suya por defecto: la página dice que, si las dos difieren, se aplica la más favorable
  al comprador.
- Los textos de venta dicen «gratis **para empezar**»: no vuelvas a poner «gratis» a secas en la landing, `index.html` o
  el manifest mientras exista el juego completo.
- Si un día enciendes GA4 (`ga4` en `js/cloud-config.js`), antes hace falta un aviso de consentimiento y actualizar
  Privacidad §8: la política de uso de Paddle excluye negocios que no cumplen el consentimiento del RGPD.
- Las publicaciones en redes también: `docs/CALENDARIO.md` §4 (paso 10) ya pide «gratis para empezar en cocardo.app»
  en vez de «Juego de fans, no oficial». `docs/VIDEOS.md` se está cambiando aparte (en la copia principal ya quita el
  aviso de fans, pero sus textos dicen «gratis en la web»: que digan «gratis para empezar»). Revisa también la bio y
  los posts fijados de las cuentas: tienen que decir lo mismo que el sitio.
- Las tipografías todavía se cargan de Google Fonts (Privacidad lo explica como proveedor independiente). Lo más
  limpio es servirlas desde cocardo.app: Lilita One, Nunito y Yellowtail tienen licencia SIL Open Font; baja los
  `.woff2` (latin y latin-ext) a `fonts/`, pon las reglas `@font-face` en `css/`, añade `fonts` a `PUBLIC` de
  `tools/cloudflare/build-site.cjs` y a `CORE` de `sw.js`, quita los `<link>` a `fonts.googleapis.com` /
  `fonts.gstatic.com` de `index.html`, `landing.html` y `legal/*.html`, y borra la ficha «Tipografías» de Privacidad
  §2 y §3 (y del resumen en inglés y portugués).
- Cuando se abra un capítulo, «los niveles 11 al 30» de la landing y de los Términos sigue siendo cierto (los nuevos
  entran como «capítulos que se publiquen después»); si cambias el número, cámbialo en los dos sitios.

### 6.3 Claves y configuración de live

En el panel **live** repite §1.2 a §1.6 (claves `pdl_live_…`, token `live_…`, enlace de pago por defecto —solo cuando
el dominio ya esté aprobado, §6.2—, monedas y métodos de pago). En **My account → Settings → Sales tax**, confirma que los precios incluyen impuestos (el precio ya
lo fija con `tax_mode: internal`, pero así queda coherente). Después:

```bash
PADDLE_ENV=live node tools/setup-paddle.cjs --site https://cocardo.app   # con la clave «setup» de live
# después, con PADDLE_API_KEY («worker» de live) y PADDLE_WEBHOOK_SECRET de live exportados, y SIN SITE_ORIGINS
# (así queda solo https://cocardo.app):
PADDLE_ENV=live PADDLE_PRICE_ID=pri_… tools/setup-cloudflare-pay.sh cocardo.app graceful-system-406208
```

Y en `js/cloud-config.js`:

```js
pay: { on: true, freeLevels: 10, env: 'live', token: 'live_…', priceId: 'pri_…', apiBase: '' },
```

Sube también la `VERSION` de `sw.js` para que los jugadores reciban la versión nueva. Haz una compra real tuya y
reembólsala (§5.3 y §5.4; en live los reembolsos suelen esperar la aprobación de Paddle) antes de anunciarlo.

**Borrar los datos del sandbox.** Las pruebas escribieron en el Firestore de producción. Antes de encender la venta,
en la consola de Firebase → Firestore Database: borra los documentos de `orders` cuyo `priceId` es el `pri_…` del
sandbox (o la colección `orders` entera, si todavía no hubo ventas reales) y los de `entitlements` con
`source: "paddle"` que apuntan a esas órdenes (los de tus cuentas de prueba). Así ninguna compra con tarjeta de prueba
sigue valiendo en live.

**Jugadores antiguos en otro aparato.** El permiso de jugador antiguo es del aparato (§0). Si alguien que jugaba antes
del lanzamiento te escribe porque en un aparato nuevo le aparece el candado, y su progreso en la nube lo confirma
(consola → `users/<uid>/private/save`: `unlocked` mayor que 10 desde antes del lanzamiento), créale a mano
`entitlements/<uid>` con los campos `premium` (boolean, `true`), `order` (string vacío), `source` (string `"legacy"`) y
`at` (timestamp, ahora). La consola puede escribirlo aunque las reglas no dejen a nadie más; el Worker nunca pisa ni
borra un permiso `legacy` o `manual`. (El progreso de la nube no se usa para dar ese permiso solo, porque cada cuenta
puede escribir el suyo.)

### 6.4 Precio para tickets chicos

Con 1,99 la parte fija (US$0,50) se lleva un cuarto del precio. Paddle dice en su página de precios que para productos
de menos de US$10 se le puede pedir una tarifa a medida: escríbeles desde el panel (o desde
<https://www.paddle.com/pricing>) antes de lanzar.

### 6.5 Cloudflare: que nada frene los webhooks

- **Bot Fight Mode** no se puede saltar con reglas personalizadas del WAF. Lo más simple es dejarlo **apagado**:
  Security → Settings → filtro *Bot traffic* → Bot Fight Mode → Off.
- Si lo quieres encendido (o usas otras protecciones), crea **reglas de acceso por IP** (*IP access rules*) con
  acción **Allow** para cada IP de Paddle, solo en este sitio
  (<https://developers.cloudflare.com/waf/tools/ip-access-rules/create/>): cuando una de esas reglas coincide, Bot
  Fight Mode no actúa. Las IP de hoy (compruébalas antes; `tools/setup-paddle.cjs` las imprime y también están en
  `https://api.paddle.com/ips` y `https://sandbox-api.paddle.com/ips`):
  - **live:** 34.232.58.13, 34.195.105.136, 34.237.3.244, 35.155.119.135, 52.11.166.252, 34.212.5.7
  - **sandbox:** 34.194.127.46, 54.234.237.108, 3.208.120.145, 44.226.236.210, 44.241.183.62, 100.20.172.113
- Paddle espera un 200 en menos de 5 segundos; si falla reintenta (live: 60 veces en 3 días; sandbox: 3 en 15 minutos)
  y, agotados los intentos, el aviso queda `failed` y se puede reenviar con la operación *replay* de la API de Paddle.
- **Límite de intentos** a «Comprar» y «Ya pagué» (además del binding `RATE_LIMIT` del Worker, §3, que cuenta por
  separado en cada centro de datos de Cloudflare): Security → WAF → **Rate limiting rules** → Create rule. En el plan
  gratis hay **una** regla, cuenta por IP, en periodos de 10 s, y bloquea 10 s. Campo **URI Path**, operador **is in**,
  valores `/api/checkout` y `/api/restore` (si el panel no ofrece *is in*, usa **equals** `/api/restore`); **5**
  pedidos cada **10 s**; acción **Block**. No incluyas `/api/webhook`. Sirve para que nadie pruebe facturas a toda
  velocidad ni llene Paddle de transacciones, y para que la IP del Worker no pase el límite de la API de Paddle
  (240 pedidos por minuto por IP; pasado eso Paddle la bloquea 60 s y «Comprar» falla para todos).

### 6.6 Hosting: GitHub Pages fuera antes de vender

GitHub Pages **no permite** usarse como hosting gratuito de un negocio en línea o de un sitio dirigido sobre todo a
transacciones comerciales (<https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits>).
**Hecho:** `cocardo.app` ya sale de Cloudflare (Worker de archivos estáticos `cocardo-sitio`, ruta `cocardo.app/*`,
`tools/deploy-cloudflare.sh`; detalles en `tools/cloudflare/`). Las rutas `cocardo.app/__/*` (login) y `cocardo.app/api/*`
(pagos) tienen prioridad y siguen igual.

**Falta, antes de poner `pay.on: true` en live:** apagar GitHub Pages (repositorio → Settings → Pages). El DNS puede
quedarse como está (con proxy de Cloudflare): la ruta del Worker responde antes de llegar al origen. Después se puede
quitar el archivo `CNAME` del repositorio. Ojo: mientras GitHub Pages siga encendido publica el repositorio entero en
su dirección `*.github.io`, incluidas las páginas legales con los marcadores sin rellenar.

### 6.7 Pedidos de privacidad (ver, corregir o borrar una cuenta)

La política de privacidad promete respuesta en **un mes como máximo** y que el pedido no queda ligado a una cuenta
borrada. Para borrar una cuenta (consola de Firebase, proyecto `graceful-system-406208`):

1. Encuentra el `uid`: Authentication → Users (por correo si entró con Google; si jugó con apodo, Firestore →
   `nicknames/<apodo>` lo da).
2. Firestore: borra `users/<uid>` y `users/<uid>/private/save`, `nicknames/<apodo>`, sus puntajes
   `daily/<fecha>/scores/<uid>` y `entitlements/<uid>`. En cada `orders/<txn>` con ese `uid`, cambia `uid` a texto vacío.
   Si tenía el juego completo, avísale antes: lo pierde en esa cuenta, y si vuelve con otra puede recuperarlo con «Ya
   pagué» (factura + correo; un pedido sin dueño se reclama sin gastar traslados).
3. Authentication → Users → la fila → **Delete account**.
4. Contesta por correo diciendo qué se borró. Para ver o llevarse sus datos: copia el contenido de esos documentos en
   el correo (JSON). Los datos del pago los tiene Paddle (se piden a Paddle).

**Cuentas con apodo inactivas (Privacidad §5):** la política promete borrar las cuentas con apodo (anónimas) sin
actividad durante 24 meses y sin una compra vigente. Cada 6 meses: Authentication → Users, filtra por proveedor
anónimo y ordena por «Signed in»; para cada una con el último acceso de hace más de 24 meses y sin
`entitlements/<uid>`, sigue los pasos 2 y 3 de arriba (sin correo que contestar).

**Avisos de apodos (Términos §7 y §9):** si alguien avisa de un apodo ilegal u ofensivo, revísalo, cámbialo o bórralo
(`users/<uid>` y `nicknames/<apodo>`) y, si la persona dejó un correo, contesta con lo que decidiste. Si quitas el
apodo o la cuenta de alguien que te escribió alguna vez, dile por qué y que puede responder para que lo revises.

## 7. Portugal (resumen; que lo confirme una contabilista)

- **Abrir actividad en Finanças** antes de la primera venta real (para el sandbox no hace falta). Portal das
  Finanças → Início de atividade: código **CIRS 1519** («Outros prestadores de serviços») u otro más preciso si la
  contabilista lo prefiere, IRS en **regime simplificado** e IVA en el **regime de isenção del art. 53.º CIVA**
  (volumen de negocios hasta 15 000 € al año).
- **Factura a Paddle una vez al mes** en el Portal das Finanças (Faturas e Recibos), por lo que Paddle te acredita ese
  mes (lo que te queda, no lo que pagaron los compradores), a nombre de la entidad de Paddle que figura en tu contrato.
  Paddle además te manda una «Reverse Invoice» con cada pago, pero eso no reemplaza tu factura portuguesa.
- **Qué confirmar con la contabilista:**
  - la mención de IVA de la factura (isenção art. 53.º, o «não sujeito» por ser un servicio a una empresa de fuera de
    Portugal);
  - el **coeficiente de IRS**: 0,35 (prestación de servicios; la AT pone el código 1519 ahí) o 0,15 (venta de productos);
  - el **código de actividad**.
- **Segurança Social:** exento los primeros 12 meses de actividad (si es la primera vez que la abres).
- **Livro de Reclamações Eletrónico:** registra la actividad en <https://www.livroreclamacoes.pt> antes de la primera
  venta real (que la contabilista confirme que aplica a tu caso, con Paddle como revendedor); sin el registro, los
  consumidores no te encuentran al reclamar. El sitio ya enlaza el libro en todos los pies (landing, páginas legales,
  Portada y Ajustes del juego).
- **Datos en el sitio (DL 7/2004, art. 10.º):** nombre, dirección geográfica, correo y NIF siempre en línea: los ponen
  los marcadores de §6.2 en Términos y Privacidad.

## 8. Integración en el juego

**Hecho:** `js/pay.js`, `js/cloud.js` (watchDoc, authReady, authKnown, idToken, takeAnonToken), `js/main.js`
(`Cocardo.Pay.init()`), `js/cloud-config.js` (`pay` y `legal`), `index.html` (carga `js/pay.js` antes de `js/ui.js`),
`sw.js` (`./js/pay.js` en `CORE`, `/api/` fuera de la caché) y `js/ui.js`: candado de los niveles mayores que 10 y
etiqueta «Juego completo» en el mapa, la ficha de pago (precio local o el de lista, Comprar el juego completo, Ya pagué, Pagar en Safari/Chrome, la
línea de Términos y Reembolsos con Paddle como revendedor), avisos de `Cocardo.Pay.onChange`, apodo automático sin
pisar el pago, aviso al cerrar la sesión con apodo, la tarjeta «Juego completo» de Ajustes y los enlaces legales
(Portada y Ajustes). Textos de venta y páginas legales: §6.2.

**Falta:** el contrato de `Cocardo.Pay` en `docs/ARQUITECTURA.md`. Allí también: con la venta encendida `#debug` solo
funciona en desarrollo (`file://`, `localhost`, `127.0.0.1`, `*.localhost`); con la venta apagada sigue como hasta
ahora (README «Abre `#debug`…», ARQUITECTURA §12).

## 9. Cuánto queda de cada venta

Paddle cobra **5 % del precio pagado + US$0,50** por venta (incluye pasarela, impuestos, fraude, soporte al comprador
y contracargos). Si la venta se cobra en otra moneda que tu saldo, la convierte al cambio medio del mercado más un
margen: **2 %** en USD, EUR y GBP, **3 %** en la mayoría de las demás. Un **contracargo** cuesta además hasta **20 €**
(o US$20 / £20), aunque Paddle lo gane: lo que dejan unas 18 ventas. Ante un reclamo, reembolsar rápido sale mucho
más barato.

Cuenta con saldo en EUR y 1 € ≈ US$1,15 (la parte fija de US$0,50 ≈ 0,43 €):

| Comprador | Paga | Impuesto incluido | Comisión de Paddle | Te queda |
|---|---|---|---|---|
| España | 1,99 € | IVA 21 %: 0,35 € | 0,10 € + 0,43 € | **≈ 1,11 €** |
| Portugal | 1,99 € | IVA 23 %: 0,37 € | 0,10 € + 0,43 € | **≈ 1,08 €** |
| Estados Unidos (estado sin impuesto a lo digital) | US$1,99 | 0 | US$0,10 + US$0,50 | US$1,39 → **≈ 1,18–1,21 €** (con o sin el margen del 2 %) |
| México (en pesos, conversión automática) | ≈ US$1,99 | IVA 16 %: ≈ US$0,27 | US$0,10 + US$0,50 | ≈ US$1,12 → **≈ 0,94–0,97 €** (con o sin el margen del 3 %) |

Son aproximados: el cambio se mueve, en Estados Unidos el *sales tax* depende del estado (de 0 a ~10 %, que sale del
precio) y Paddle redondea los precios convertidos. Sobre lo que queda se pagan IRS y, pasado el primer año, Segurança
Social (§7).

---

**Fuentes (consultadas el 17 de octubre de 2026):** API de Paddle:
[productos](https://developer.paddle.com/api-reference/products/create-product),
[precios](https://developer.paddle.com/api-reference/prices/create-price),
[notificaciones](https://developer.paddle.com/api-reference/notification-settings/create-notification-setting),
[permisos](https://developer.paddle.com/api-reference/about/permissions),
[autenticación](https://developer.paddle.com/api-reference/about/authentication),
[token del cliente](https://developer.paddle.com/paddle-js/client-side-tokens),
[enlace de pago por defecto](https://developer.paddle.com/build/transactions/default-payment-link),
[localizar precios](https://developer.paddle.com/build/products/offer-localized-pricing/),
[sandbox y tarjetas](https://developer.paddle.com/sdks/sandbox/),
[entrega de webhooks e IP](https://developer.paddle.com/webhooks/about/respond-to-webhooks/),
[simulaciones](https://developer.paddle.com/webhooks/test-webhooks),
[reembolsos](https://developer.paddle.com/build/transactions/create-transaction-adjustments/),
[checklist de live](https://developer.paddle.com/build/go-live-checklist/); Paddle:
[categorías de impuestos](https://www.paddle.com/help/start/intro-to-paddle/why-do-i-need-to-select-'taxable-categories'-for-my-products),
[revisión del dominio](https://www.paddle.com/help/start/account-verification/what-is-domain-verification),
[páginas legales mínimas](https://developer.paddle.com/embedded-billing-partner-skills/.well-known/skills/draft-seller-policies/SKILL.md),
[dominios de pago](https://developer.paddle.com/api-reference/checkout-domains),
[política de uso](https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle),
[reembolsos de Paddle](https://www.paddle.com/legal/refund-policy),
[términos de compra](https://www.paddle.com/legal/checkout-buyer-terms),
[identidad](https://www.paddle.com/help/start/account-verification/what-is-identity-verification),
[manual del vendedor](https://www.paddle.com/seller-guides/seller-handbook), [precios](https://www.paddle.com/pricing),
[contrato (MSA, cláusulas 3.2, 7.1 y 10.4)](https://www.paddle.com/legal/terms),
[contracargos](https://www.paddle.com/help/manage/risk-prevention/understanding-chargebacks-with-paddle),
[Reverse Invoice](https://www.paddle.com/help/manage/get-paid/do-i-need-to-invoice-paddle-for-my-payout); Google:
[roles de Firestore](https://docs.cloud.google.com/firestore/native/docs/security/iam),
[crear claves](https://docs.cloud.google.com/iam/docs/keys-create-delete),
[las bibliotecas de servidor no pasan por las reglas](https://firebase.google.com/docs/firestore/security/get-started);
Cloudflare: [Bot Fight Mode](https://developers.cloudflare.com/bots/get-started/bot-fight-mode/),
[reglas de acceso por IP](https://developers.cloudflare.com/waf/tools/ip-access-rules/); Portugal: art. 53.º CIVA
(DL 35/2025), art. 31.º CIRS y Circular 2/2016 (código 1519 en la alínea c).
