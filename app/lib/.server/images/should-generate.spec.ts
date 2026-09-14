import { describe, expect, it } from 'vitest';
import { debeGenerarImagenes } from './should-generate';

const base = { habilitadoEnElEntorno: true, llave: 'una-llave', pedidoPorElUsuario: true };

describe('debeGenerarImagenes', () => {
  it('genera solo cuando se cumplen las tres condiciones', () => {
    expect(debeGenerarImagenes(base).generar).toBe(true);
  });

  it.each([
    ['la instancia no lo tiene habilitado', { habilitadoEnElEntorno: false }, /CRESOVA_IMAGES_ENABLED/],
    ['no hay llave', { llave: undefined }, /OPENROUTER_IMAGES_KEY/],
    ['el interruptor está apagado', { pedidoPorElUsuario: false }, /interruptor/],
  ])('no genera cuando %s', (_caso, cambio, esperado) => {
    const decision = debeGenerarImagenes({ ...base, ...cambio });

    expect(decision.generar).toBe(false);
    expect(decision.motivo).toMatch(esperado);
  });

  it('un interruptor ausente cuenta como apagado', () => {
    /*
     * El caso que importa de verdad: un cliente viejo, una petición armada a mano o un campo que
     * se pierde en el camino no pueden encender un gasto. Ausente es apagado, nunca encendido.
     */
    expect(debeGenerarImagenes({ ...base, pedidoPorElUsuario: undefined }).generar).toBe(false);
  });
});
