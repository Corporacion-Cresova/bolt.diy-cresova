import { describe, expect, it } from 'vitest';
import * as lucide from 'lucide-react';
import { CRESOVA_DESIGN_KIT } from './cresova-design-kit';

/**
 * The icon safelist exists because importing an icon that does not exist breaks the generated
 * project's build, and a model inventing a plausible name is the usual cause. A safelist that
 * itself names a non-existent icon would be worse than no safelist at all, so it is checked
 * against the real package rather than trusted.
 */
function safelistedIcons(): string[] {
  const section = CRESOVA_DESIGN_KIT.split('the usual cause:')[1]?.split('If none fits')[0] ?? '';

  return section
    .split(',')
    .map((name) => name.trim().replace(/\s+/g, ''))
    .filter((name) => /^[A-Z][A-Za-z0-9]*$/.test(name));
}

describe('the design kit icon safelist', () => {
  it('names icons that all really exist in lucide-react', () => {
    const names = safelistedIcons();

    expect(names.length).toBeGreaterThan(30);

    const missing = names.filter((name) => !(name in lucide));

    expect(missing).toEqual([]);
  });

  it('covers the things a small business site always needs', () => {
    const names = new Set(safelistedIcons());

    for (const essential of ['Phone', 'Mail', 'MapPin', 'Clock', 'MessageCircle', 'Check', 'ArrowRight']) {
      expect(names).toContain(essential);
    }
  });
});
