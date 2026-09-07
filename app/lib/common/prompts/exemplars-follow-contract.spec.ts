import { describe, expect, it } from 'vitest';
import { CRESOVA_SECTION_EXEMPLARS } from './cresova-section-exemplars';
import { CRESOVA_SECTORIAL_EXEMPLARS } from './cresova-sectorial-exemplars';
import { CRESOVA_MOTION_RECIPES } from './cresova-motion-recipes';

/**
 * The exemplars are copied far more literally than the prose is followed, so an exemplar that
 * breaks one of our own rules ships that break into every generated site. Both cases below were
 * real: the motion recipes animated cards with `transition-all` while the build contract forbids
 * it, and the sectorial forms removed the focus ring without putting one back.
 */
const EXEMPLARS: [string, string][] = [
  ['section exemplars', CRESOVA_SECTION_EXEMPLARS],
  ['sectorial exemplars', CRESOVA_SECTORIAL_EXEMPLARS],
  ['motion recipes', CRESOVA_MOTION_RECIPES],
];

/** The durations Tailwind ships. A number outside this list generates no CSS at all. */
const TAILWIND_DURATIONS = new Set([0, 75, 100, 150, 200, 300, 500, 700, 1000]);

describe.each(EXEMPLARS)('%s', (_name, source) => {
  it('never uses transition-all', () => {
    expect(source).not.toContain('transition-all');
  });

  it('only uses durations that exist in the Tailwind scale', () => {
    const durations = [...source.matchAll(/duration-(\d+)/g)].map((match) => Number(match[1]));
    const invented = [...new Set(durations)].filter((value) => !TAILWIND_DURATIONS.has(value));

    expect(invented).toEqual([]);
  });

  it('gives every field that clears the default outline a visible focus state back', () => {
    const clearsOutline = source.split(/\s(?=class(?:Name)?=)/).filter((chunk) => chunk.includes('outline-none'));

    for (const chunk of clearsOutline) {
      expect(chunk).toContain('focus-visible:outline');
    }
  });
});
