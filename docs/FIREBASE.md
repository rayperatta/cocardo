# Cuentas, apodos y ranking: cómo activar la nube (Firebase)

El juego funciona completo sin nube (todo se guarda en el navegador). Al activar Firebase se suman:

- **Entrar con Google** (o «Jugar con apodo», sin cuenta, para quien abre el juego dentro de TikTok/Instagram).
- **Apodo y avatar** únicos, con filtro de groserías (`js/core/progress.js`).
- **Progreso en la nube**: al entrar se juntan el progreso local y el de la nube sin perder nada
  (`Cocardo.Progress.merge`); después cada victoria se sube sola.
- **Ranking del Reto Diario** (solo cuenta el primer intento del día) y **ranking general por estrellas**,
  visibles para cualquier visitante sin descargar el SDK (se leen por la API REST de Firestore).
- **Analítica** opcional con Google Analytics 4 (eventos `level_start`, `level_end`, `daily_end`, `share`,
  `clip`, `sign_in`, `referral`…).

Todo el código está en `js/cloud.js`, `js/cloud-config.js`, `js/analytics.js` y `firebase/`. Tiempo estimado:
20 minutos. Costo: **US$0** en el plan Spark (gratis) para decenas de miles de jugadores al mes (ver §6).

## 1. Crear el proyecto

1. Entra en <https://console.firebase.google.com> con tu cuenta de Google y pulsa **Crear proyecto**
   (nombre sugerido: `cocardo-rescate`). Google Analytics: puedes activarlo ahí mismo o después.
2. En la pantalla principal del proyecto, pulsa el ícono **Web** (`</>`) para registrar una app web.
   Apodo: `Cocardo web`. **No** marques Firebase Hosting (el juego vive en GitHub Pages o en tu dominio).
3. Copia el objeto `firebaseConfig` que te muestra. Solo necesitas `apiKey`, `authDomain`, `projectId` y `appId`.

## 2. Pegar la configuración en el juego

Abre `js/cloud-config.js` y rellena:

```js
firebase: {
  apiKey: 'AIza…',
  authDomain: 'cocardo-rescate.firebaseapp.com',
  projectId: 'cocardo-rescate',
  appId: '1:1234567890:web:abcdef123456',
},
siteUrl: 'https://cocardo.app/',          // tu dominio (para los enlaces de invitación y la marca de agua de los clips)
social: { tiktok: 'tu_cuenta', instagram: 'tu_cuenta' },   // aparecen en la Portada y en landing.html
```

La `apiKey` de Firebase **no es secreta**: identifica el proyecto; la seguridad la ponen las reglas (§4) y la lista
de dominios autorizados (§3).

## 3. Activar los proveedores de acceso

En **Build → Authentication → Get started → Sign-in method**:

1. **Google**: Enable, elige un correo de soporte, Save.
2. **Anonymous**: Enable, Save. (Es el modo «Jugar con apodo (sin cuenta)». Google bloquea el inicio de sesión
   dentro de los navegadores de TikTok, Instagram y Facebook; sin este modo esos jugadores no podrían entrar al
   ranking. Después pueden «Vincular con Google» desde Ajustes y conservan todo.)
3. Pestaña **Settings → Authorized domains**: añade `<tu-usuario>.github.io` y tu dominio (p. ej. `cocardo.app`).
   `localhost` ya viene. Sin esto el botón de Google da el error *unauthorized-domain*.

## 4. Crear Firestore y subir las reglas

1. **Build → Firestore Database → Create database**. Ubicación: `nam5 (us-central)` o `southamerica-east1`
   (São Paulo; mejor latencia para LATAM). Modo: **production** (las reglas se suben en el paso siguiente).
2. Instala la CLI una vez: `npm install -g firebase-tools` y `firebase login`.
3. Desde la carpeta `firebase/` del repositorio:

```bash
cd firebase
firebase use --add            # elige el proyecto y ponle el alias "default"
firebase deploy --only firestore:rules,firestore:indexes
```

Las reglas (`firebase/firestore.rules`) garantizan que:

- cada persona solo escribe su propio perfil y su propio guardado;
- el apodo es único (`nicknames/{apodo}`), de 3 a 16 caracteres, y el perfil y la reserva cambian en la misma
  transacción (`getAfter`);
- el intento del Reto Diario **solo se crea una vez por día y por persona**, con puntaje entre 0 y 999 999,
  estrellas 0-3 y el apodo igual al del perfil; no se puede editar ni borrar;
- los perfiles públicos (apodo, avatar, estrellas) y los rankings los puede leer cualquiera; el guardado completo
  (`users/{uid}/private/save`) solo su dueño.

Qué se guarda de cada persona: `uid` de Firebase, apodo, avatar (un personaje del juego), estrellas, niveles,
rescates, racha y el progreso del juego. **No** se guarda el correo ni el nombre de Google. Si publicas el juego
con cuentas, añade una línea de privacidad en `landing.html` o en el README diciendo esto.

## 5. Probar

1. Abre el juego por `https://` (GitHub Pages o tu dominio; desde `file://` la nube está apagada a propósito).
2. En la Portada aparece el chip **Entrar** arriba a la derecha. Entra con Google: la primera vez te pide el apodo
   y el avatar.
3. En Ajustes verás la tarjeta de cuenta (sincronizar, cambiar apodo, salir). En el Reto Diario, la tarjeta
   **Ranking** con las pestañas *Reto de hoy* y *Estrellas*.
4. En la consola de Firebase → Firestore verás `users/<uid>`, `nicknames/<apodo>` y, tras jugar el reto,
   `daily/<AAAAMMDD>/scores/<uid>`.

Errores típicos y su causa (el juego los muestra como aviso abajo):

| Aviso | Causa |
|---|---|
| «Este dominio no está autorizado en Firebase» | falta el dominio en Authentication → Settings → Authorized domains |
| «Falta activar el proveedor en Firebase» | Google o Anonymous no están en Enable |
| «La nube rechazó el cambio (revisa las reglas)» | no subiste `firestore.rules` o editaste algo que las reglas no aceptan |
| «No se pudo cargar el ranking» | Firestore no existe todavía o la `apiKey`/`projectId` están mal |

## 6. Costos y límites

Plan **Spark** (gratis): 50 000 lecturas, 20 000 escrituras y 1 GB al día; Authentication sin límite práctico.
Cómo gasta el juego:

- Ver el ranking: **1 consulta de hasta 20 documentos** (20 lecturas), y el juego no vuelve a pedirlo durante 45 s.
- Entrar: 2 lecturas (perfil y guardado) + 2 escrituras.
- Ganar un nivel: 2 escrituras (guardado y perfil); jugar el reto: 1 escritura más.

Con 2 000 jugadores diarios activos que miran el ranking dos veces estarías en ~80 000 lecturas: ahí conviene pasar
a **Blaze** (pago por uso, con el mismo tramo gratis incluido; ~US$0,06 por 100 000 lecturas) o subir `CACHE_MS`
en `js/cloud.js`. Pon una **alerta de presupuesto** en Google Cloud (US$5) el día que actives Blaze.

## 7. Siguiente paso recomendado: validar puntajes en el servidor

Hoy el puntaje del Reto Diario lo envía el navegador y las reglas solo acotan su rango. Cuando el juego tenga
tráfico, alguien publicará un puntaje inventado desde la consola. La solución limpia aprovecha que el motor es
**determinista** (`js/core/engine.js`: misma semilla + mismas jugadas = mismo resultado):

1. El cliente envía, junto con el puntaje, la lista de jugadas `[{a:{r,c}, b:{r,c}}, …]`.
2. Una **Cloud Function** (`onCall`) carga `js/core/*.js` en Node, vuelve a jugar la partida con `Cocardo.Daily`
   y `Cocardo.Engine`, y escribe ella el documento de `daily/…/scores` (y las reglas pasan a prohibir que el
   cliente lo escriba).
3. **App Check** (reCAPTCHA Enterprise) para que solo tu dominio pueda llamar a la función.

Las Cloud Functions necesitan el plan Blaze; con el tramo gratis el costo real es cero para este volumen.

## 8. Analítica (opcional)

1. En <https://analytics.google.com> crea una propiedad GA4 y un flujo **Web** con tu dominio. Copia el
   **ID de medición** (`G-XXXXXXXXXX`).
2. Pégalo en `js/cloud-config.js` → `ga4`. Listo: `js/analytics.js` carga `gtag.js` solo en http(s) y envía los
   eventos. `landing.html` también lo usa (evento `landing_cta`).
3. Informes útiles: embudo `level_start → level_end` por nivel (dónde abandona la gente), `daily_end` por día
   (retención), `share` y `clip` (viralidad), `referral` (cuántos llegan por enlaces `?r=apodo`).

Si prefieres analítica sin cookies, Umami o Plausible se integran igual (un `<script>` en `index.html` y
`Cocardo.Track.event` reenviando a su API); ver `docs/CRECIMIENTO.md`.
