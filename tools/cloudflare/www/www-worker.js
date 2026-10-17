/* Cocardo: ¡Rescate Helado! — redirige www.cocardo.app a cocardo.app (misma ruta y parámetros, 301). */
export default {
  fetch(request) {
    const url = new URL(request.url);
    url.hostname = 'cocardo.app';
    url.protocol = 'https:';
    url.port = '';
    return Response.redirect(url.toString(), 301);
  },
};
