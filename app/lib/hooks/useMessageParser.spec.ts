import { describe, expect, it, vi } from 'vitest';
import type { Message } from 'ai';
import { collectParsedUpdates } from './useMessageParser';

/*
 * `parseMessages` corre con un debounce de 50 ms, o sea veinte veces por segundo mientras el
 * modelo escribe. La versión anterior llamaba `setParsedMessages` una vez por mensaje, dentro del
 * bucle, y cada llamada copiaba el mapa entero: 20·N copias por segundo de un mapa de N claves.
 *
 * Estos tests fijan lo que evita ese trabajo: solo entra lo que cambió.
 */

const message = (id: string, role: Message['role'], content = ''): Message => ({ id, role, content }) as Message;

describe('collectParsedUpdates', () => {
  it('devuelve solo los mensajes que produjeron contenido nuevo', () => {
    const messages = [
      message('a', 'user', 'hola'),
      message('b', 'assistant', 'ya estaba completo'),
      message('c', 'assistant', 'esto es nuevo'),
    ];

    const parse = (id: string) => (id === 'c' ? '<div>nuevo</div>' : '');

    expect(collectParsedUpdates(messages, parse, false)).toEqual({ 2: '<div>nuevo</div>' });
  });

  it('devuelve vacío cuando nadie produjo nada, para que el hook no toque el estado', () => {
    /*
     * El caso frecuente entre chunk y chunk. Antes esto igual disparaba una copia del mapa por
     * mensaje y un re-render, para escribir exactamente los mismos valores.
     */
    const messages = [message('a', 'assistant'), message('b', 'assistant')];

    expect(collectParsedUpdates(messages, () => '', false)).toEqual({});
  });

  it('ignora los mensajes que no son del usuario ni del asistente', () => {
    const messages = [message('a', 'system', 'x'), message('b', 'assistant', 'y')];
    const parse = vi.fn(() => 'salida');

    const updates = collectParsedUpdates(messages, parse, false);

    expect(updates).toEqual({ 1: 'salida' });
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it('en un reset incluye también los que parsean vacío, porque el valor reemplaza', () => {
    /*
     * Sin esto, un reset dejaría la entrada anterior de un mensaje que ahora parsea a vacío.
     */
    const messages = [message('a', 'assistant'), message('b', 'assistant')];

    expect(collectParsedUpdates(messages, () => '', true)).toEqual({ 0: '', 1: '' });
  });

  it('no deja que un mensaje malformado se lleve la sesión', () => {
    /*
     * Un artifact roto tiraba acá, subía por el render y reemplazaba la app con una pantalla de
     * error. Un mensaje se puede perder; la sesión no.
     */
    const messages = [message('a', 'assistant'), message('b', 'assistant')];
    const parse = (id: string) => {
      if (id === 'a') {
        throw new Error('artifact malformado');
      }

      return 'el resto sigue';
    };

    expect(() => collectParsedUpdates(messages, parse, false)).not.toThrow();
    expect(collectParsedUpdates(messages, parse, false)).toEqual({ 1: 'el resto sigue' });
  });

  it('parsea cada mensaje una sola vez por pasada', () => {
    const messages = Array.from({ length: 30 }, (_, index) => message(`m${index}`, 'assistant'));
    const parse = vi.fn(() => '');

    collectParsedUpdates(messages, parse, false);

    expect(parse).toHaveBeenCalledTimes(30);
  });

  it('saca el texto de un contenido en partes, no solo de un string', () => {
    const withParts = {
      id: 'a',
      role: 'assistant',
      content: [
        { type: 'image', image: 'x' },
        { type: 'text', text: 'el texto de verdad' },
      ],
    } as unknown as Message;

    const seen: string[] = [];
    collectParsedUpdates(
      [withParts],
      (_id, content) => {
        seen.push(content);
        return content;
      },
      false,
    );

    expect(seen).toEqual(['el texto de verdad']);
  });
});
