import { describe, expect, it } from 'vitest';
import { textStreamResponse } from './text-stream-response';

/** Un `textStream` del AI SDK: encola strings, no bytes. */
function stringStream(pieces: string[]): ReadableStream<string> {
  return new ReadableStream({
    start(controller) {
      for (const piece of pieces) {
        controller.enqueue(piece);
      }
      controller.close();
    },
  });
}

describe('textStreamResponse', () => {
  it('entrega el texto completo al cliente', async () => {
    const response = textStreamResponse(stringStream(['CLÍNICA ', 'PÉLVICA — salud pélvica']));

    await expect(response.text()).resolves.toBe('CLÍNICA PÉLVICA — salud pélvica');
  });

  /*
   * El caso que rompía de verdad: el brief viene en español, con tildes, eñes y rayas. Si el
   * cuerpo se arma mal, no llega texto roto — no llega nada, y con status 200.
   */
  it('no pierde acentos ni los parte entre trozos', async () => {
    const brief = 'Sección · tipografía · «así» · L 1.250 · ñandú — ¿está?';
    const response = textStreamResponse(stringStream([...brief]));

    await expect(response.text()).resolves.toBe(brief);
  });

  it('un stream vacío da un cuerpo vacío, no un error', async () => {
    await expect(textStreamResponse(stringStream([])).text()).resolves.toBe('');
  });

  /*
   * La prueba que le da sentido a las de arriba: así se armaba el cuerpo antes. Si alguna vez
   * vuelve a pasar, que sea acá y no en producción con una generación ya facturada.
   */
  it('el cuerpo crudo de strings —la versión anterior— no entrega nada', async () => {
    const raw = new Response(stringStream(['hola ', 'mundo']));

    await expect(raw.text()).rejects.toThrow(/Uint8Array/i);
  });
});
