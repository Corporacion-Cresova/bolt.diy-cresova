import { describe, expect, it } from 'vitest';
import { cresovaBriefPrompt } from './cresova-brief';
import { CRESOVA_DESIGN_KIT } from './cresova-design-kit';

/**
 * The brief names a sector row and the build then looks that row up in the design kit to get its
 * palette. The two tables live in different files for different reasons — the brief's is trimmed
 * so a cheap call stays cheap — so nothing but this test stops them from drifting apart, and a row
 * named here but missing there fails silently: the build finds no palette and invents one.
 */
function rowsOf(source: string): string[] {
  return [...source.matchAll(/^\s*\|\s*([A-ZÁÉÍÓÚÑ][^|]*?)\s*\|/gm)]
    .map((match) => match[1].trim())
    .filter((name) => name !== 'Sector');
}

describe('the brief and the design kit', () => {
  const brief = cresovaBriefPrompt('un taller de motos en San Pedro Sula');

  it('names only sectors the design kit can resolve', () => {
    const kitRows = new Set(rowsOf(CRESOVA_DESIGN_KIT));
    const missing = [...new Set(rowsOf(brief))].filter((row) => !kitRows.has(row));

    expect(missing).toEqual([]);
  });

  it('offers every sector the kit has, so no business is left without a row', () => {
    const briefRows = new Set(rowsOf(brief));
    const missing = [...new Set(rowsOf(CRESOVA_DESIGN_KIT))].filter((row) => !briefRows.has(row));

    expect(missing).toEqual([]);
  });

  it('carries the request through to the model', () => {
    expect(brief).toContain('un taller de motos en San Pedro Sula');
  });

  it('asks for contact data instead of inventing it', () => {
    expect(brief).toContain('DATOS POR CONFIRMAR CON EL CLIENTE');
  });
});
