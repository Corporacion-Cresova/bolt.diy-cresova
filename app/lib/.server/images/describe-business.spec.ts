import { describe, expect, it } from 'vitest';
import { describeBusiness } from './describe-business';

/*
 * These tests exist because of what Flux was being sent. The image brief pasted the user's
 * message in whole, so the subject of the hero photograph was literally «create a web page for
 * El Zorzal Express…» — an image model photographs the sentence it is given, and that sentence
 * was a software request.
 */

describe('describeBusiness', () => {
  it('drops the build request and keeps the business', () => {
    const description = describeBusiness(
      'Crea una página web para El Zorzal Express, una empresa de mensajería y paquetería en Tegucigalpa, Honduras.',
    );

    expect(description).toBe('El Zorzal Express, una empresa de mensajería y paquetería en Tegucigalpa, Honduras');
    expect(description).not.toMatch(/página|web|crea/i);
  });

  it('handles the other ways a request opens', () => {
    const cases = [
      'Hazme un sitio web para la Clínica Dental Sonrisa en San Pedro Sula',
      'Necesito que me hagas una landing page para la Clínica Dental Sonrisa en San Pedro Sula',
      'Diseña una tienda en línea para la Clínica Dental Sonrisa en San Pedro Sula',
      'Página web para la Clínica Dental Sonrisa en San Pedro Sula',
      'Build a website for la Clínica Dental Sonrisa en San Pedro Sula',
    ];

    for (const request of cases) {
      expect(describeBusiness(request)).toBe('la Clínica Dental Sonrisa en San Pedro Sula');
    }
  });

  it('strips the model and provider prefix the chat adds to every message', () => {
    const description = describeBusiness(
      '[Model: deepseek/deepseek-v4-pro]\n\n[Provider: OpenRouter]\n\nCrea un sitio para Café Welchez, tostaduría en Copán',
    );

    expect(description).toBe('Café Welchez, tostaduría en Copán');
  });

  it('returns nothing when the message is framing and nothing else', () => {
    /*
     * The honest answer. A generic brief makes a generic photograph, which is bad; an invented
     * one makes a photograph of a business that does not exist, which is worse.
     */
    expect(describeBusiness('hazme una página web')).toBe('');
    expect(describeBusiness('   ')).toBe('');
  });

  it('keeps a description that never had any framing to begin with', () => {
    expect(describeBusiness('Barbería El Cortijo, barbería clásica en el centro de Tegucigalpa')).toBe(
      'Barbería El Cortijo, barbería clásica en el centro de Tegucigalpa',
    );
  });

  it('cuts long descriptions on a sentence boundary, never mid-word', () => {
    const long = `Café Welchez, tostaduría de especialidad en Copán Ruinas. ${'Vendemos café de altura cultivado por productores locales. '.repeat(6)}`;

    const description = describeBusiness(long);

    expect(description.length).toBeLessThanOrEqual(240);
    expect(description).toMatch(/[\p{L}\p{N})]$/u);
    expect(description).toContain('Café Welchez');
  });

  it('collapses newlines so an enhanced multi-line brief stays one phrase', () => {
    const description = describeBusiness('Crea una web para\n\nHotel Casa Fortuna,\nhotel boutique en Roatán');

    expect(description).toBe('Hotel Casa Fortuna, hotel boutique en Roatán');
  });

  it('leaves a business name that merely starts like a verb', () => {
    /*
     * "Hacienda San Lucas" is a real hotel in Copán. A verb stem broad enough to catch "hagas"
     * is also broad enough to eat the first word of that name, which is why the patterns demand
     * an article, a noun or a preposition after the verb before they strip anything.
     */
    const cases = [
      'Hacienda San Lucas, hotel de montaña en Copán Ruinas',
      'Creaciones Marisol, taller de costura en Comayagüela',
      'Diseños Luna, estudio de interiorismo en Tegucigalpa',
    ];

    for (const request of cases) {
      expect(describeBusiness(request)).toBe(request);
    }
  });

  it('removes angle brackets so the description is always safe to embed', () => {
    expect(describeBusiness('Crea un sitio para <script>alert(1)</script> Taller Mecánico Lopez')).not.toMatch(/[<>]/);
  });
});
