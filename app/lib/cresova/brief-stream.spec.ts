import { describe, expect, it, vi } from 'vitest';
import { BriefStreamError, readBriefStream } from './brief-stream';

function bodyOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

/** Parte el texto en trozos de N bytes, como los parte la red y no el modelo. */
function inChunksOf(text: string, size: number): Uint8Array[] {
  const bytes = new TextEncoder().encode(text);
  const chunks: Uint8Array[] = [];

  for (let i = 0; i < bytes.length; i += size) {
    chunks.push(bytes.slice(i, i + size));
  }

  return chunks;
}

const BRIEF = 'CLÍNICA PÉLVICA — salud pélvica, Tegucigalpa\nSección: «¿esto es normal?» · L 1.250';

describe('readBriefStream', () => {
  it('entrega el brief y lo va mostrando mientras llega', async () => {
    const onText = vi.fn();
    const response = new Response(bodyOf(inChunksOf(BRIEF, 16)));

    await expect(readBriefStream(response, onText)).resolves.toBe(BRIEF);
    expect(onText).toHaveBeenLastCalledWith(BRIEF);
    expect(onText.mock.calls.length).toBeGreaterThan(1);
  });

  /*
   * Un carácter de varios bytes partido entre dos trozos. Sin `{ stream: true }` se convierte en
   * U+FFFD y el brief llega con basura donde iban las tildes.
   */
  it('no rompe los caracteres partidos entre dos trozos', async () => {
    for (const size of [1, 2, 3, 5, 7]) {
      const response = new Response(bodyOf(inChunksOf(BRIEF, size)));
      await expect(readBriefStream(response, vi.fn())).resolves.toBe(BRIEF);
    }
  });

  it('un 200 vacío es una falla, no un brief en blanco', async () => {
    const onText = vi.fn();

    await expect(readBriefStream(new Response(bodyOf([]), { status: 200 }), onText)).rejects.toBeInstanceOf(
      BriefStreamError,
    );
    expect(onText).not.toHaveBeenCalled();
  });

  it('el cuerpo de un error no termina en la caja de texto', async () => {
    const onText = vi.fn();
    const response = new Response('Invalid or missing API key', { status: 401 });

    await expect(readBriefStream(response, onText)).rejects.toThrow(/API key/);
    expect(onText).not.toHaveBeenCalled();
  });

  it('un cuerpo nulo falla en vez de colgarse', async () => {
    const onText = vi.fn();

    await expect(readBriefStream(new Response(null, { status: 200 }), onText)).rejects.toBeInstanceOf(BriefStreamError);
    expect(onText).not.toHaveBeenCalled();
  });
});
