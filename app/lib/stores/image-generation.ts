import { atom } from 'nanostores';
import Cookies from 'js-cookie';

/**
 * Si las generaciones de este navegador pagan imágenes de IA.
 *
 * Existe porque el costo era invisible y no se podía apagar. Cada sitio generaba seis imágenes con
 * Flux —cerca de la quinta parte de lo que cuesta construirlo— y durante semanas ninguna llegó a
 * verse: salían con URL http dentro de una página https y la ruta que las sirve está detrás de la
 * autenticación del proxy. La única forma de cortarlo era una variable de entorno y un redeploy.
 *
 * Apagado por defecto, a propósito. Un gasto recurrente que se activa solo es el que nadie revisa;
 * encenderlo es un clic y queda guardado.
 */
const COOKIE = 'cresovaGenerarImagenes';

/*
 * La cookie se lee solo en el navegador. Este módulo lo importa `ChatBox`, que Remix renderiza
 * también en el servidor, y ahí `document` no existe: leerla al importar tira la petición entera
 * antes de pintar nada.
 */
export const generarImagenes = atom<boolean>(typeof document !== 'undefined' && Cookies.get(COOKIE) === 'true');

export function alternarGenerarImagenes(): boolean {
  const siguiente = !generarImagenes.get();
  generarImagenes.set(siguiente);

  /*
   * En cookie y no en localStorage: es la misma mecánica con la que ya viajan el modelo y el
   * proveedor elegidos, y así una pestaña nueva arranca con la decisión que ya se tomó.
   */
  Cookies.set(COOKIE, String(siguiente), { expires: 30 });

  return siguiente;
}
