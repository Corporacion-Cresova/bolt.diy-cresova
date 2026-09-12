import { describe, expect, it } from 'vitest';
import { analizar, croma, UMBRAL_GRIS } from './medir-sitio.mjs';

/**
 * Las reglas del medidor, contra los números reales del sitio que las motivó.
 *
 * El fixture «zorzal» no es inventado: son las mediciones de zorzalexpress.preview.cresova.com
 * tomadas en el navegador. Si el medidor deja de señalar eso, dejó de servir — un auditor que
 * aprueba el caso que lo hizo nacer es peor que no tener auditor.
 */

const ZORZAL = {
  tipografia: { h1: 44, h2Max: 160, cuerpo: 17 },
  hero: { anchoColumna: 294, anchoGrid: 1200 },
  areaPorColor: [
    [[245, 246, 248], 19_840_000],
    [[255, 255, 255], 7_281_000],
    [[22, 29, 38], 1_681_000],
    [[44, 85, 120], 154_000],
  ],
  fondosDistintos: 2,
  secciones: 11,
  movimiento: {
    intersectionObserver: 0,
    keyframesDeclarados: ['marquee', 'float', 'draw-line'],
    keyframesUsados: ['marquee'],
  },
  movil: { tocablesTotal: 21, tocablesChicos: 10, scrollHorizontal: false },
};

const SANO = {
  tipografia: { h1: 64, h2Max: 80, cuerpo: 17 },
  hero: { anchoColumna: 638, anchoGrid: 1120 },
  areaPorColor: [
    [[247, 245, 240], 8_000_000],
    [[219, 239, 234], 6_000_000],
    [[0, 111, 98], 4_000_000],
    [[11, 51, 45], 2_000_000],
  ],
  fondosDistintos: 4,
  secciones: 12,
  movimiento: { intersectionObserver: 3, keyframesDeclarados: ['marquee'], keyframesUsados: ['marquee'] },
  movil: { tocablesTotal: 21, tocablesChicos: 0, scrollHorizontal: false },
};

const porTitulo = (hallazgos, titulo) => hallazgos.find((h) => h.titulo === titulo);

describe('croma', () => {
  it('distingue un gris de un color', () => {
    expect(croma([245, 246, 248])).toBeLessThan(UMBRAL_GRIS);
    expect(croma([255, 255, 255])).toBeLessThan(UMBRAL_GRIS);
    expect(croma([22, 29, 38])).toBeLessThan(UMBRAL_GRIS);
    expect(croma([44, 85, 120])).toBeGreaterThan(UMBRAL_GRIS);
    expect(croma([225, 29, 46])).toBeGreaterThan(UMBRAL_GRIS);
  });
});

describe('analizar, sobre el sitio que lo motivó', () => {
  const hallazgos = analizar(ZORZAL);

  it('señala el titular caído al piso del clamp', () => {
    expect(porTitulo(hallazgos, 'titular del hero').ok).toBe(false);
    expect(porTitulo(hallazgos, 'titular del hero').detalle).toMatch(/44px/);
  });

  it('señala el h2 de 160px', () => {
    expect(porTitulo(hallazgos, 'el h2 más grande').ok).toBe(false);
  });

  it('señala la pista de grid colapsada', () => {
    const h = porTitulo(hallazgos, 'ancho de la columna del titular');
    expect(h.ok).toBe(false);
    expect(h.detalle).toMatch(/minmax/);
  });

  it('señala la página sin color', () => {
    const h = porTitulo(hallazgos, 'área de la página con color');
    expect(h.ok).toBe(false);

    // 154k de 28.956k px² con color: 0,5%.
    expect(h.detalle).toMatch(/0\.5% con color/);
  });

  it('señala que no hay reveals', () => {
    expect(porTitulo(hallazgos, 'reveals al scroll').ok).toBe(false);
  });

  it('señala las animaciones escritas y nunca aplicadas', () => {
    const h = porTitulo(hallazgos, 'animaciones cableadas');
    expect(h.ok).toBe(false);
    expect(h.detalle).toContain('float');
    expect(h.detalle).toContain('draw-line');
    expect(h.detalle).not.toContain('marquee');
  });

  it('señala los targets tocables chicos', () => {
    expect(porTitulo(hallazgos, 'áreas tocables de 44px a 390px').ok).toBe(false);
  });

  it('en total, reprueba', () => {
    expect(hallazgos.filter((h) => !h.ok).length).toBeGreaterThanOrEqual(7);
  });
});

describe('analizar, sobre un sitio sano', () => {
  it('no inventa problemas', () => {
    /*
     * La otra mitad de la prueba. Un auditor que reprueba todo es tan inútil como uno que aprueba
     * todo, y mucho más molesto.
     */
    expect(analizar(SANO).filter((h) => !h.ok)).toEqual([]);
  });
});
