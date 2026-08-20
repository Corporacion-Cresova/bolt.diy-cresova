import { describe, expect, it } from 'vitest';
import { detectBuildIntent } from './build-intent';

/*
 * This gate decides whether the design kit and the photo catalog are sent to the model at all, so a
 * miss is not a small loss: it is a generic page with no images. The cases below are written the
 * way a real request arrives, not the way a regex would like it.
 */
const peticionesReales = [
  'Una web para una empresa de limpieza en Guatemala',
  'Necesito un sitio para mi taller mecánico',
  'Quiero una landing para mi despacho de abogados',
  'Sitio web para restaurante de comida típica',
  'Web de una clínica dental con formulario de citas',
  'Página para una barbería, con precios y galería',
  'Portafolio de fotografía minimalista',
  'Landing de una app de delivery',
  'Un ecommerce sencillo de ropa',
  'Necesito presencia online para mi negocio de jardinería',
  'Crea una página web para una constructora',
  'Hazme un sitio para vender pasteles',
  'a landing page for a dental clinic',
  'build me a website for my coffee shop',
];

/* A question costs tokens and a Pexels call if it is mistaken for a build request. */
const preguntas = [
  '¿Qué es una landing page?',
  '¿Cómo funciona la web?',
  'Explícame qué diferencia hay entre una app y un sitio web',
  '¿Por qué mi página no carga?',
  'What is a landing page?',
];

describe('detectBuildIntent', () => {
  for (const peticion of peticionesReales) {
    it(`reconoce como petición: "${peticion}"`, () => {
      expect(detectBuildIntent(peticion)).toBe(true);
    });
  }

  for (const pregunta of preguntas) {
    it(`no confunde con petición: "${pregunta}"`, () => {
      expect(detectBuildIntent(pregunta)).toBe(false);
    });
  }

  it('ignora el prefijo de modelo que la aplicación antepone', () => {
    expect(detectBuildIntent('[Model: deepseek][Provider: OpenRouter] Una web para mi cafetería')).toBe(true);
  });

  it('no ve una petición donde no hay nada', () => {
    expect(detectBuildIntent('   ')).toBe(false);
  });
});
