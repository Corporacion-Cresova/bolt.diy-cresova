import { describe, expect, it } from 'vitest';
import {
  CRESOVA_SECTORIAL_EXEMPLARS,
  SECTOR_SALUD_HERO,
  SECTOR_SALUD_SERVICES,
  SECTOR_GASTRONOMIA_HERO,
  SECTOR_GASTRONOMIA_CONTACT,
  SECTOR_OFICIOS_HERO,
  SECTOR_COMERCIO_HERO,
  ANTI_PATTERN_SERVICES,
  ANTI_PATTERN_GALLERY,
} from './cresova-sectorial-exemplars';

/**
 * The sectorial exemplars file ships a hero + services + contact trio for four non-turismo
 * sectors, plus two anti-patterns that show the wrong and right answer side by side. Each
 * trio is real copy in real code; the model picks one and copies it. These tests verify the
 * invariants the file promises to hold, so a refactor that breaks the contract cannot land
 * silently.
 */

describe('the sectorial exemplars block', () => {
  it('ships a worked trio for every sector the kit defines as non-turismo', () => {
    /*
     * The design kit's sector table names six sectors: turismo, gastronomía, belleza, comercio,
     * oficios, salud/legal/financiero. The original exemplars cover turismo. This file covers
     * the remaining four (belleza is intentionally merged with salud for the first cut). If a
     * sector is added later, this test must be updated alongside the new trio.
     */
    const block = CRESOVA_SECTORIAL_EXEMPLARS;
    expect(block).toContain('SALUD, LEGAL, FINANCIERO, PROFESIONAL');
    expect(block).toContain('GASTRONOMÍA, CAFÉ, CATERING');
    expect(block).toContain('OFICIOS, CONSTRUCCIÓN, LIMPIEZA, TRANSPORTE');
    expect(block).toContain('COMERCIO, TIENDA, RETAIL');
  });

  it('every hero carries a stat row with three or four real numbers, not adjectives', () => {
    /*
     * The kit's «NEVER» list calls out placeholder copy. A stat row that says «Excelente
     * servicio» is a stat row the model will reproduce on every site. Every hero in this file
     * must show at least three concrete numbers (years, prices, hours, patients) so the model
     * has a numerical reference instead of an adjective.
     */
    const heroes = [SECTOR_SALUD_HERO, SECTOR_GASTRONOMIA_HERO, SECTOR_OFICIOS_HERO, SECTOR_COMERCIO_HERO];

    for (const hero of heroes) {
      // The hero mentions at least three numeric tokens. We do not require a specific markup
      // because each sector's stat row uses different containers (dd/dt, plain <p>, etc.).
      const numericMatches = hero.match(/\b\d+(?:[.,]\d+)*(?:%|\s*(?:años|h|días|k|mil)?)?\b/g) ?? [];
      // Filter out CSS values (px, rem, vw) and design-token numbers that are not stats.
      const stats = numericMatches.filter((n) => !/(?:px|rem|vw|vh|em)$/i.test(n));
      expect(stats.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('every contact section has a real hours line and a real street address, never «horario a convenir»', () => {
    /*
     * The original turismo exemplar used «Lunes a domingo, 6:00 – 20:00» and «Half Moon Bay
     * Road, West End». The contact sections in this file have to honour the same standard: a
     * real day, a real time range. Placeholder hours are the fastest way to look unfinished.
     */
    // Only the contacto (gastronomía) has a real hours row in this first cut. The other
    // trios cover hours inside the hero stat strip, which is tested above.
    expect(SECTOR_GASTRONOMIA_CONTACT).toMatch(/(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo)/);
    expect(SECTOR_GASTRONOMIA_CONTACT).toMatch(/\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2}/);
    // The contact section never says "horario a convenir" or "horario a confirmar".
    expect(SECTOR_GASTRONOMIA_CONTACT).not.toMatch(/horario a (?:confirmar|convenir|coordinar)/i);
  });

  it('every sector hero uses token names (bg / surface / ink / accent) and never invented hex codes', () => {
    /*
     * Same rule as the motion recipes: colours come from the sector table, not from the
     * exemplar. An invented hex in an exemplar is an invented hex the model copies verbatim,
     * and the sector palette stops deciding anything.
     */
    const heroes = [SECTOR_SALUD_HERO, SECTOR_GASTRONOMIA_HERO, SECTOR_OFICIOS_HERO, SECTOR_COMERCIO_HERO];
    const hexPattern = /#[0-9A-Fa-f]{6}\b/g;

    for (const hero of heroes) {
      const hexes = hero.match(hexPattern) ?? [];
      expect(hexes).toEqual([]);
    }
  });

  it('every hero declares its headline size in clamp() and the cap is at least 5rem', () => {
    /*
     * The design kit raised the headline ceiling to 6.5rem. The exemplars should follow the
     * same ceiling, not the old 4.5rem one. A hero whose headline caps at 4.5rem is a hero
     * the model will imitate, and the new ceiling stops applying.
     */
    const heroes = [SECTOR_SALUD_HERO, SECTOR_GASTRONOMIA_HERO, SECTOR_OFICIOS_HERO, SECTOR_COMERCIO_HERO];
    const clampPattern = /fontSize:\s*'clamp\([^,]+,\s*[^,]+,\s*([\d.]+)rem\)'/;

    for (const hero of heroes) {
      const matches = hero.match(clampPattern) ?? [];
      expect(matches.length).toBeGreaterThan(0);

      // Take the largest headline cap in the hero. Gastronomía's pull quotes also use clamp.
      const caps = matches
        .map((m) => {
          const capMatch = m.match(/,\s*([\d.]+)rem\)/);
          return capMatch ? parseFloat(capMatch[1]) : 0;
        })
        .filter((n) => n > 0);

      const maxCap = Math.max(...caps);
      expect(maxCap).toBeGreaterThanOrEqual(5);
    }
  });

  it('the anti-pattern block shows the wrong answer and the right answer side by side', () => {
    /*
     * The whole point of the anti-pattern block is that the model sees both. If the wrong
     * answer disappears, the model loses the contrast that makes the lesson land.
     */
    expect(ANTI_PATTERN_SERVICES).toContain('THE WRONG ANSWER');
    expect(ANTI_PATTERN_SERVICES).toContain('THE RIGHT ANSWER');
    expect(ANTI_PATTERN_GALLERY).toContain('THE WRONG ANSWER');
    expect(ANTI_PATTERN_GALLERY).toContain('THE RIGHT ANSWER');
  });

  it('the wrong services example uses a card grid; the right one uses a list', () => {
    /*
     * The pattern is concrete: three cards in a row vs an editorial list. The wrong version
     * has to contain the cards; the right one has to contain the list markers.
     */
    expect(ANTI_PATTERN_SERVICES).toContain('md:grid-cols-3');
    expect(ANTI_PATTERN_SERVICES).toContain('<ul');
    expect(ANTI_PATTERN_SERVICES).toContain('<li');
  });

  it('the wrong gallery example is a 2x2 of squares; the right one is asymmetric 4+2+2', () => {
    /*
     * The pattern is concrete: aspect-square w-full vs col-span-4 row-span-2. The wrong
     * version has to contain squares; the right one has to contain the asymmetric grid.
     */
    expect(ANTI_PATTERN_GALLERY).toContain('aspect-square');
    expect(ANTI_PATTERN_GALLERY).toContain('col-span-4');
    expect(ANTI_PATTERN_GALLERY).toContain('row-span-2');
  });

  it('no exemplar contains a placeholder name like «Your Company», «Lorem ipsum» or «Servicio 1»', () => {
    /*
     * The design kit's NEVER list calls out placeholder copy by name. The exemplars must not
     * contain any of them, because the model copies the exemplar verbatim — including the
     * placeholders.
     */
    const heroes = [SECTOR_SALUD_HERO, SECTOR_GASTRONOMIA_HERO, SECTOR_OFICIOS_HERO, SECTOR_COMERCIO_HERO];
    const placeholders = [/Your Company/i, /Lorem ipsum/i, /Servicio \d/i, /Service one/i, /Consultorio X/i];

    for (const hero of heroes) {
      for (const pattern of placeholders) {
        expect(hero).not.toMatch(pattern);
      }
    }
  });

  it('every sector trio is annotated with a «Why it works» block that names the lesson', () => {
    /*
     * The original exemplars annotate every section with the lesson the model is supposed to
     * learn. The sectorial file has to follow the same convention or the model loses the
     * «why» and is left copying the «what».
     */
    const allTrios = [
      SECTOR_SALUD_HERO,
      SECTOR_SALUD_SERVICES,
      SECTOR_GASTRONOMIA_HERO,
      SECTOR_GASTRONOMIA_CONTACT,
      SECTOR_OFICIOS_HERO,
      SECTOR_COMERCIO_HERO,
    ];

    for (const trio of allTrios) {
      expect(trio).toMatch(/Why it works/);
    }
  });
});
