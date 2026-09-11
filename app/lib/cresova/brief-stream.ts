/**
 * Lee el brief que llega por streaming y lo entrega, o falla diciendo por qué.
 *
 * Vive fuera del hook porque acá es donde estaban los modos de falla, y ninguno se podía probar
 * mientras la lógica vivía adentro de un `useState`. Los cuatro eran silenciosos:
 *
 *   - No se miraba `response.ok`. Un 401 por API key vencida o un 500 del proveedor entregaban su
 *     cuerpo de error a la caja de texto como si fuera el brief.
 *   - Un cuerpo `null` —que es literalmente lo que devolvía la ruta en su rama de error— hacía que
 *     el hook saliera por un `if` sin ejecutar el `finally`: el spinner quedaba girando para
 *     siempre y los dos botones, deshabilitados, hasta recargar la página.
 *   - `decoder.decode(value)` sin `{ stream: true }` destruye cualquier carácter que quede partido
 *     entre dos trozos de red. El brief es español: tildes, eñes, «», rayas. Medido: en trozos de
 *     7 bytes se perdían dos caracteres en un brief corto.
 *   - Una respuesta vacía se trataba igual que una exitosa. Es el caso que rompía de verdad: el
 *     servidor contestaba 200 con cero bytes, el bucle terminaba en el primer `read`, y la caja
 *     quedaba en blanco después de haber pagado la generación.
 *
 * El invariante es uno solo: o la caja termina con un brief, o termina con lo que el usuario tenía
 * antes. Nunca en blanco, nunca con un mensaje de error adentro.
 */

export class BriefStreamError extends Error {}

const MAX_ERROR_BODY_CHARS = 300;

/**
 * @param response la respuesta de `/api/enhancer`
 * @param onText se llama con el texto acumulado en cada trozo; el primer llamado reemplaza lo que
 *   haya en la caja. No se limpia antes: si la petición falla, lo que el usuario escribió sigue ahí.
 * @returns el brief completo
 */
export async function readBriefStream(response: Response, onText: (text: string) => void): Promise<string> {
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new BriefStreamError(
      detail.trim().slice(0, MAX_ERROR_BODY_CHARS) || `El servidor respondió ${response.status}.`,
    );
  }

  const reader = response.body?.getReader();

  if (!reader) {
    throw new BriefStreamError('El servidor respondió sin contenido.');
  }

  const decoder = new TextDecoder();
  let text = '';

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    // `stream: true` deja los bytes incompletos guardados para el trozo siguiente.
    text += decoder.decode(value, { stream: true });
    onText(text);
  }

  // El flush final cierra cualquier carácter que haya quedado a medias en el último trozo.
  text += decoder.decode();

  if (!text.trim()) {
    throw new BriefStreamError('El modelo no devolvió texto.');
  }

  onText(text);

  return text;
}
