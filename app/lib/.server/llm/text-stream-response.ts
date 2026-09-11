/**
 * Devuelve un `textStream` del AI SDK como cuerpo HTTP.
 *
 * Existe por una falla que se veía como «el modelo no generó nada» y en realidad era «el modelo
 * generó todo y el navegador recibió cero bytes».
 *
 * `result.textStream` encola **strings** (ai@4.3.16, `dist/index.mjs`). Un cuerpo de `Response`
 * tiene que encolar bytes. Los dos runtimes que usamos lo rechazan, y ninguno de los dos lo
 * rechaza a tiempo:
 *
 *   - workerd (`wrangler pages dev`, que es como corre el contenedor): responde `200 OK`, manda
 *     las cabeceras, y recién entonces tira `Uncaught TypeError: This ReadableStream did not
 *     return bytes` dentro del worker. El cliente ve una respuesta exitosa de 0 bytes. Medido.
 *   - undici (Node): `TypeError: Received non-Uint8Array chunk` al leer el cuerpo.
 *
 * En los dos casos la llamada al modelo ya ocurrió y ya se facturó. El costo de la falla no era
 * un error visible: era una respuesta 200 vacía, que es la forma más cara de fallar porque parece
 * que funcionó.
 */
export function textStreamResponse(textStream: ReadableStream<string>, init?: ResponseInit): Response {
  return new Response(textStream.pipeThrough(new TextEncoderStream()), init);
}
