/**
 * El origen público de esta app, que es la URL con la que un navegador ajeno puede pedirle cosas.
 *
 * `new URL(request.url).origin` no sirve para eso detrás de un proxy inverso. EasyPanel termina
 * el TLS en Traefik y le pasa al contenedor una petición en texto plano, así que el worker ve
 * `http://builder.cresova.com` y las fotos generadas salieron con esa URL. El sitio del cliente se
 * sirve por https, y un navegador no carga una imagen http dentro de una página https: la bloquea
 * por contenido mixto y deja el texto alternativo.
 *
 * Ese es exactamente el síntoma que reportó el cliente —«solo salía el nombre y no la imagen»— y
 * el control está en la misma página: las fotos de Pexels, que vienen por https, sí cargaban.
 *
 * El esquema real viaja en `X-Forwarded-Proto`, que es lo que este módulo lee.
 */

/** Lo que el proxy diga, si lo dice; si no, lo que se vea en la URL. */
export function publicOrigin(request: Request): string {
  const url = new URL(request.url);
  const reenviado = esquemaReenviado(request.headers);

  if (reenviado) {
    url.protocol = `${reenviado}:`;
  }

  const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();

  if (host) {
    /*
     * Con puerto se asigna `host`; sin puerto hay que limpiarlo a mano, porque asignar `host` sin
     * puerto conserva el que ya estaba y devolvía «builder.cresova.com:5173».
     */
    if (host.includes(':')) {
      url.host = host;
    } else {
      url.hostname = host;
      url.port = '';
    }
  }

  return url.origin;
}

function esquemaReenviado(headers: Headers): string | null {
  /*
   * `X-Forwarded-Proto` puede venir con varios valores si hay proxies encadenados; el primero es
   * el que habló con el navegador, que es el único que importa acá.
   */
  const xfp = headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();

  if (xfp === 'https' || xfp === 'http') {
    return xfp;
  }

  // El header estándar (RFC 7239), que algunos proxies mandan en vez del X-.
  const forwarded = headers.get('forwarded');
  const proto = forwarded?.match(/proto=("?)([a-z]+)\1/i)?.[2]?.toLowerCase();

  return proto === 'https' || proto === 'http' ? proto : null;
}
