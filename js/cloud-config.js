/* Cocardo: ¡Rescate Helado! — Configuración de la nube (cuentas, ranking y analítica).
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
      authDomain: 'graceful-system-406208.firebaseapp.com',          // p. ej. cocardo-rescate.firebaseapp.com
      projectId: 'graceful-system-406208',           // p. ej. cocardo-rescate
      appId: '1:884766434061:web:fbe561f24168079a074644',               // p. ej. 1:1234567890:web:abcdef
      // storageBucket y messagingSenderId no hacen falta para este juego
    },
    // Versión del SDK de Firebase (build «compat», sin empaquetador). Se carga solo al tocar «Entrar con Google».
    firebaseVersion: '10.14.1',
    // Analítica opcional: ID de Google Analytics 4 (G-XXXXXXXXXX). Vacío = sin analítica.
    ga4: '',
    // Dirección pública del juego (para enlaces compartidos cuando se abre desde un archivo o un iframe)
    siteUrl: 'https://cocardo.app/',
    // Redes del proyecto (se muestran en la portada y en la landing). Vacío = no se muestra.
    social: { tiktok: '', instagram: '' },
  };
})();
