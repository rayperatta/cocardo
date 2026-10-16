/* Cocardo: ¡Rescate Helado! — Worker de Cloudflare que sirve el login de Firebase desde el dominio del juego.
 *
 * Con authDomain = 'cocardo.app' (js/cloud-config.js), la ventana de Google dice «continuar a cocardo.app» en vez de
 * «<proyecto>.firebaseapp.com», y el inicio de sesión queda en el mismo sitio que el juego (no depende de cookies de
 * terceros, que Safari y Chrome bloquean). GitHub Pages no puede atender /__/auth/*, así que este Worker (ruta
 * cocardo.app/__/*) reenvía esas rutas a Firebase; todo lo demás sigue yendo a GitHub Pages.
 * Es la «opción 3» de https://firebase.google.com/docs/auth/web/redirect-best-practices
 * Se instala con tools/setup-cloudflare-auth.sh. FIREBASE_PROJECT llega como variable del Worker. */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/__/auth/') && !url.pathname.startsWith('/__/firebase/')) {
      return fetch(request);   // cualquier otra ruta bajo /__/ sigue a GitHub Pages
    }
    url.protocol = 'https:';
    url.hostname = env.FIREBASE_PROJECT + '.firebaseapp.com';
    url.port = '';
    // Mismo método, cabeceras y cuerpo; las redirecciones de Firebase se devuelven tal cual al navegador
    return fetch(new Request(url.toString(), request));
  },
};
