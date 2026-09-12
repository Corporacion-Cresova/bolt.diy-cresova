import { describe, expect, it } from 'vitest';
import { CRESOVA_DESIGN_KIT } from './cresova-design-kit';

/**
 * Cada paleta de la tabla sectorial se lee, en todas las combinaciones que la página va a usar.
 *
 * La tabla se escribe a mano y la editan personas —yo incluido— empujando un color «un poco más
 * fuerte». Un par que baja de 4.5 no rompe nada visible: el sitio se genera, se ve bien en una
 * pantalla buena, y es ilegible en el teléfono de un cliente bajo el sol de Tegucigalpa. Este test
 * lee la tabla real del kit, no una copia, así que no puede quedar desactualizado.
 */

interface Fila {
  nombre: string;
  ground: string;
  bg: string;
  surface: string;
  tint: string;
  ink: string;
  muted: string;
  accent: string;
}

function filas(): Fila[] {
  const lineas = CRESOVA_DESIGN_KIT.split('\n').filter((l) => /^\s*\|\s*[A-ZÁÉÍÓÚÑ]/.test(l) && l.includes('#'));

  return lineas.map((linea) => {
    const c = linea.split('|').map((x) => x.trim());
    return { nombre: c[1], ground: c[2], bg: c[3], surface: c[4], tint: c[5], ink: c[6], muted: c[7], accent: c[8] };
  });
}

const lineal = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => lineal(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [alto, bajo] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (alto + 0.05) / (bajo + 0.05);
}

/** El color del texto que va encima del acento: el que contraste, no el que uno suponga. */
function sobreAcento(fila: Fila): string {
  return contraste('#FFFFFF', fila.accent) >= contraste(fila.bg, fila.accent) ? '#FFFFFF' : fila.bg;
}

const TEXTO = 4.5;
const ELEMENTO_GRANDE = 3.0;

describe('las paletas sectoriales se leen', () => {
  const todas = filas();

  it('la tabla se parsea y trae las nueve filas con siete colores', () => {
    /*
     * Sin esto, un cambio de formato en la tabla haría que `filas()` devuelva vacío y todos los
     * tests de abajo pasarían por no tener nada que verificar.
     */
    expect(todas).toHaveLength(9);
    expect(
      todas.every((f) => [f.bg, f.surface, f.tint, f.ink, f.muted, f.accent].every((c) => /^#[0-9A-F]{6}$/.test(c))),
    ).toBe(true);
  });

  it.each(filas().map((f) => [`${f.nombre} · ${f.ground}`, f] as [string, Fila]))('%s', (_nombre, fila) => {
    const pares: Array<[string, number, number]> = [
      ['ink sobre bg', contraste(fila.ink, fila.bg), TEXTO],
      ['ink sobre surface', contraste(fila.ink, fila.surface), TEXTO],
      ['ink sobre tint', contraste(fila.ink, fila.tint), TEXTO],
      ['muted sobre bg', contraste(fila.muted, fila.bg), TEXTO],
      ['muted sobre surface', contraste(fila.muted, fila.surface), TEXTO],
      ['muted sobre tint', contraste(fila.muted, fila.tint), TEXTO],
      ['texto sobre accent', contraste(sobreAcento(fila), fila.accent), TEXTO],
      ['accent sobre bg', contraste(fila.accent, fila.bg), ELEMENTO_GRANDE],
      ['accent sobre tint', contraste(fila.accent, fila.tint), ELEMENTO_GRANDE],
    ];

    const flojos = pares.filter(([, valor, minimo]) => valor < minimo);

    expect(flojos.map(([n, v, m]) => `${n}: ${v.toFixed(2)} < ${m}`)).toEqual([]);
  });

  it('el tint es un fondo aparte, no el bg con otro nombre', () => {
    /*
     * El fallo que motivó el token: una página con dos grounds grises. Si `tint` termina siendo
     * casi el mismo color que `bg`, vuelve a ser la misma página dos veces.
     */
    for (const fila of todas) {
      expect(contraste(fila.tint, fila.bg), `${fila.nombre} · ${fila.ground}`).toBeGreaterThan(1.06);
    }
  });
});
