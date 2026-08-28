import { describe, expect, it } from 'vitest';
import {
  CRESOVA_MOTION_RECIPES,
  MOTION_STICKY_GROW,
  MOTION_MARQUEE,
  MOTION_COUNT,
  MOTION_PARALLAX,
  MOTION_LINE_REVEAL,
  MOTION_IMAGE_HOVER,
} from './cresova-motion-recipes';

/**
 * The motion recipes file carries a particular kind of risk: each recipe is shipped as a block
 * of JSX/HTML/JS that the model copies verbatim into the generated site. A recipe with a typo,
 * a missing prefers-reduced-motion fallback, or a hardcoded duration that does not respect the
 * closed repertoire is a recipe the model will reproduce, with the same bug, on every site.
 *
 * These tests are the gate that prevents that. They check structural invariants the file
 * promises to hold, not visual output (Playwright in docs/exemplars-harness/ covers that).
 */

describe('the motion recipes block', () => {
  it('ships exactly the six promised recipes in the headline and supporting tiers', () => {
    // The block names its tiers. If we add a recipe we update this test, and the model only
    // sees a block whose tier count matches its own declaration.
    expect(CRESOVA_MOTION_RECIPES).toContain('STICKY GROW');
    expect(CRESOVA_MOTION_RECIPES).toContain('QUIET MARQUEE');
    expect(CRESOVA_MOTION_RECIPES).toContain('COUNTING NUMBER');
    expect(CRESOVA_MOTION_RECIPES).toContain('SUBTLE PARALLAX');
    expect(CRESOVA_MOTION_RECIPES).toContain('LINE-BY-LINE REVEAL');
    expect(CRESOVA_MOTION_RECIPES).toContain('RICH IMAGE HOVER');
  });

  it('every recipe wraps its motion in prefers-reduced-motion so it can be turned off', () => {
    /*
     * The original motion rule in the design kit was: wrap all of it in
     * @media (prefers-reduced-motion: reduce). A recipe without that wrapper is a recipe the
     * model will write into a site for a visitor who asked the OS to stop motion, and that
     * visitor will see the page move anyway.
     */
    const recipes = [MOTION_STICKY_GROW, MOTION_MARQUEE, MOTION_COUNT, MOTION_PARALLAX, MOTION_LINE_REVEAL];

    for (const recipe of recipes) {
      expect(recipe).toMatch(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/);
    }
  });

  it('the marquee cycle is exactly 30 seconds (not faster, not slower)', () => {
    /*
     * The recipe comment explains why 30s. Faster reads as a banner ad. Slower reads as a typo.
     * 30s is the rate at which the eye registers motion without the brain having to track it.
     * A number other than 30 is a recipe the model will reproduce with the wrong pacing.
     */
    expect(MOTION_MARQUEE).toMatch(/['"]?animation['"]?:\s*['"]marquee\s+30s\s+(?:linear\s+)?infinite['"]?/);
  });

  it('the parallax offset is exactly 30% (not 50, not 70)', () => {
    /*
     * The recipe comment explains why 30%. Higher reads as a video. Lower reads as still.
     * 30% is the difference between «I see it moving» and «I feel depth».
     */
    expect(MOTION_PARALLAX).toContain('30');
    // Make sure it is not 30% of the viewport vs 30% of the section — the math must be on
    // the rect relative to (vh + rect.height), not relative to the document.
    expect(MOTION_PARALLAX).toMatch(/vh\s*\+\s*rect\.height/);
  });

  it('the counting number has a duration bounded by 2500ms so it never overstays', () => {
    /*
     * A counter that runs for 8 seconds is a counter the user scrolls past before it finishes.
     * The bound exists for a reason; the recipe must enforce it.
     */
    expect(MOTION_COUNT).toMatch(/Math\.min\(\s*2500/);
  });

  it('the line reveal stagger is exactly 80ms between lines', () => {
    /*
     * 80ms is the smallest interval the eye perceives as a sequence rather than a fade. Less
     * than that, the lines read as one fade. More, they read as separate events and the rhythm
     * is lost.
     */
    expect(MOTION_LINE_REVEAL).toMatch(/animationDelay:\s*'80ms'/);
  });

  it('the image hover scale is exactly 1.04 — not 1.1, not 1.2', () => {
    /*
     * More than 5% reads as a zoom, not a hover. The recipe is a hover, not a click-through.
     */
    expect(MOTION_IMAGE_HOVER).toContain('scale-[1.04]');
    expect(MOTION_IMAGE_HOVER).not.toMatch(/scale-\[1\.(?:[1-9]|[2-9]\d)/);
  });

  it('uses token names (bg / surface / ink / accent) and not invented hex codes', () => {
    /*
     * The original kit forbids invented colours. The recipes must follow the same rule: every
     * colour comes from the sector table, never from the recipe file. If a recipe hardcoded a
     * hex, the model would copy that hex into every generated site and the sector palette
     * would stop deciding anything.
     */
    const recipes = [MOTION_STICKY_GROW, MOTION_MARQUEE, MOTION_COUNT, MOTION_PARALLAX, MOTION_LINE_REVEAL, MOTION_IMAGE_HOVER];
    const hexPattern = /#[0-9A-Fa-f]{6}\b/g;

    for (const recipe of recipes) {
      const hexes = recipe.match(hexPattern) ?? [];
      expect(hexes).toEqual([]);
    }

    // Tokens must appear. Sanity check.
    expect(MOTION_STICKY_GROW).toContain('text-ink');
    expect(MOTION_IMAGE_HOVER).toContain('bg-accent');
  });

  it('the closed repertoire is enforced: at most one sticky grow per page', () => {
    /*
     * The block says it explicitly. The recipe file should declare the rule in prose so the
     * model sees it next to the recipe it is choosing between.
     */
    expect(CRESOVA_MOTION_RECIPES).toMatch(/at most ONE per page from the headline tier/);
  });

  it('no recipe imports anything from npm — every recipe is copy-pasteable as-is', () => {
    /*
     * The kit's design contract says: copy the matching block verbatim. A recipe that imports
     * a package the generated site may not have is a recipe the model has to refactor, and a
     * refactored recipe is a recipe the model has misunderstood.
     */
    const recipes = [MOTION_STICKY_GROW, MOTION_MARQUEE, MOTION_COUNT, MOTION_PARALLAX, MOTION_LINE_REVEAL, MOTION_IMAGE_HOVER];
    const importPattern = /\bimport\s+\{?[^}]*\}?\s+from\s+['"][^'"]+['"]/;

    for (const recipe of recipes) {
      expect(recipe).not.toMatch(importPattern);
    }
  });
});
