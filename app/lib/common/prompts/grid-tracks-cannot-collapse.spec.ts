import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CRESOVA_DESIGN_KIT } from './cresova-design-kit';
import { CRESOVA_SECTION_EXEMPLARS } from './cresova-section-exemplars';
import { CRESOVA_MOTION_RECIPES } from './cresova-motion-recipes';
import { cresovaSectorialExemplars } from './cresova-sectorial-exemplars';

/**
 * Ninguna pista de grid puede escribirse como `Nfr` pelado.
 *
 * Esto no es estilo. `grid-cols-[3fr_2fr]` significa `minmax(auto, 3fr)`, y ese `auto` es el
 * tamaño **min-content** del contenido de la pista. Una foto dentro de la segunda columna arrastra
 * su ancho intrínseco como mínimo, así que se queda con lo que necesita y la primera columna
 * recibe las sobras.
 *
 * Medido en un sitio generado de verdad (zorzalexpress, hero 60/40 sobre 1200px): las pistas
 * resolvieron **294px / 770px** en lugar de 638/426. La columna del texto quedó en 294, el titular
 * del hero cayó al piso de su clamp —44px con interlineado de 43, líneas tocándose— y la página
 * abría con un titular más chico que sus propios subtítulos.
 *
 * Lo peor es dónde estaba el error: en `templates/cresova-base`, la plantilla que el builder
 * entrega y que el prompt manda explícitamente no reescribir. Los exemplars del prompt lo hacían
 * bien desde siempre; la plantilla, no. El modelo copió la plantilla, que es exactamente lo que le
 * pedimos que haga.
 */

/** `grid-cols-[...]` con una pista `Nfr` que no esté envuelta en `minmax(0, ...)`. */
const BARE_FR_TRACK = /grid-cols-\[([^\]]*)\]/g;

function bareFrTracks(source: string): string[] {
  const offenders: string[] = [];

  for (const [, tracks] of source.matchAll(BARE_FR_TRACK)) {
    /*
     * Se quitan los `minmax(...)` completos antes de buscar: lo que quede con `fr` es una pista
     * escrita a pelo. `auto` no se cuenta — es explícito y quien lo escribe sabe lo que pide.
     */
    const withoutMinmax = tracks.replace(/minmax\([^)]*\)/g, '');

    if (/\d*\.?\d*fr/.test(withoutMinmax)) {
      offenders.push(tracks);
    }
  }

  return offenders;
}

function templateSources(): Array<[string, string]> {
  const dir = join(process.cwd(), 'templates/cresova-base/src/components');

  return readdirSync(dir)
    .filter((name) => name.endsWith('.tsx'))
    .map((name) => [name, readFileSync(join(dir, name), 'utf8')] as [string, string]);
}

describe('las pistas de grid no se pueden colapsar', () => {
  it.each(templateSources())('%s no declara ninguna pista fr pelada', (_name, source) => {
    expect(bareFrTracks(source)).toEqual([]);
  });

  it.each([
    ['design kit', CRESOVA_DESIGN_KIT],
    ['section exemplars', CRESOVA_SECTION_EXEMPLARS],
    ['motion recipes', CRESOVA_MOTION_RECIPES],
    ['sectorial exemplars', cresovaSectorialExemplars('salud, legal, financiero, profesional')],
    ['sectorial exemplars (gastronomía)', cresovaSectorialExemplars('gastronomía, café, catering')],
    ['sectorial exemplars (oficios)', cresovaSectorialExemplars('oficios, construcción, limpieza, transporte')],
    ['sectorial exemplars (comercio)', cresovaSectorialExemplars('comercio, tienda, retail')],
  ])('%s tampoco', (_name, source) => {
    expect(bareFrTracks(source)).toEqual([]);
  });

  it('el detector reconoce la forma que rompía', () => {
    /*
     * La prueba de la prueba. Sin esto, un regex que no matchea nada pasa para siempre y este
     * archivo se vuelve decoración.
     */
    expect(bareFrTracks('<div class="md:grid-cols-[3fr_2fr]">')).toEqual(['3fr_2fr']);
    expect(bareFrTracks('<div class="md:grid-cols-[1fr_2fr_auto]">')).toEqual(['1fr_2fr_auto']);
    expect(bareFrTracks('<div class="lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">')).toEqual([]);
    expect(bareFrTracks('<div class="grid-cols-[minmax(0,4fr)_minmax(0,6fr)_auto]">')).toEqual([]);
  });
});
