/* Cocardo: ¡Rescate Helado! — Configuración de la nube (cuentas, ranking, analítica y pago).
 *
 * 1) Crea un proyecto en https://console.firebase.google.com, activa Authentication → Google y Firestore.
 * 2) En Configuración del proyecto → Tus apps → Web, copia el objeto firebaseConfig y pégalo abajo.
 * 3) Sube las reglas de seguridad: `firebase deploy --only firestore:rules,firestore:indexes` (ver docs/FIREBASE.md).
 * 4) Añade tu dominio (y <usuario>.github.io) en Authentication → Settings → Authorized domains.
 *
 * Con apiKey vacío el juego funciona igual, solo sin cuentas ni ranking (modo local). */
(function () {
  'use strict';
  var Cocardo = (window.Cocardo = window.Cocardo || {});
  Cocardo.CloudConfig = {
    firebase: {
      apiKey: 'AIzaSyDjy9wfEVYbxoWI0XcygKtb-AHVRRFvhOA',
      authDomain: 'cocardo.app',   // servido por tools/auth-proxy (Cloudflare); antes graceful-system-406208.firebaseapp.com
      projectId: 'graceful-system-406208',           // p. ej. cocardo-rescate
      appId: '1:884766434061:web:fbe561f24168079a074644',               // p. ej. 1:1234567890:web:abcdef
      // storageBucket y messagingSenderId no hacen falta para este juego
    },
    // Versión del SDK de Firebase (build «compat», sin empaquetador). Se carga solo al tocar «Entrar con Google».
    firebaseVersion: '10.14.1',
    // Analítica opcional: ID de Google Analytics 4 (G-XXXXXXXXXX). Vacío = sin analítica. GA4 pone cookies: antes de
    // rellenarlo hace falta un aviso de consentimiento y actualizar legal/privacidad.html §8; hasta entonces
    // tools/cloudflare/build-site.cjs no publica con un id aquí.
    ga4: '',
    // Dirección pública del juego (para enlaces compartidos cuando se abre desde un archivo o un iframe)
    siteUrl: 'https://cocardo.app/',
    // Redes del proyecto (se muestran en la portada y en la landing). Vacío = no se muestra.
    social: { tiktok: '', instagram: '' },
    // Quién vende el juego: nombre legal (pie de la Portada y de Ajustes) y correo de soporte (enlace «Contacto» de
    // Ajustes y ayuda con compras). Son los mismos marcadores que en legal/*.html y landing.html: los rellena
    // tools/legal-datos.cjs y tools/cloudflare/build-site.cjs no publica mientras quede alguno.
    legal: { name: 'Prince Ray Peratta Espinoza', email: 'soporte@cocardo.app' },
    // Venta del «juego completo» con Paddle (js/pay.js). Pasos y de dónde sale cada valor: docs/PAGOS.md.
    // on:false = sin candado y sin descargar nada extra (todo gratis, como hasta ahora). Con on:true también hacen
    // falta token y priceId; el Worker cocardo-pagos (cocardo.app/api/*) debe estar en el mismo entorno (sandbox/live).
    pay: {
      on: false,
      freeLevels: 10,    // niveles gratis; para empezar el 11 o más hay que comprar (ganar uno sigue abriendo el siguiente)
      env: 'sandbox',    // 'sandbox' para pruebas, 'live' para vender; igual que PADDLE_ENV del Worker
      token: '',         // token del lado del cliente (no es la API key): Paddle → My account → Settings →
                         // Authentication → Client-side tokens. El live_… se publica aquí; el test_… del sandbox va solo
                         // en tu copia local, nunca se sube (docs/PAGOS.md §1.7)
      priceId: '',       // pri_… del precio «juego completo» (Paddle → Catalog → Products → el producto → Prices); el mismo
                         // que PADDLE_PRICE_ID del Worker
      apiBase: '',       // vacío = mismo dominio (cocardo.app/api/*); otra dirección solo para pruebas (debe estar en SITE_ORIGINS)
      support: '',       // contacto que ve el comprador si «Ya pagué» no puede mover la compra; vacío = legal.email
                         // (sin un correo válido en ninguno de los dos, la ayuda al comprador de Paddle, paddle.net)
    },
  };
})();
