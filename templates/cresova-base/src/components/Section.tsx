import type { ReactNode } from 'react';

/**
 * A page section, with its ground and its breathing room already decided.
 *
 * The two rules this exists to make automatic are the ones a generated page always breaks: every
 * section on the same white (which is what «flat» actually means), and the same cramped padding
 * everywhere. Alternate the ground as you go down the page — bg, surface, bg, tint — and never run
 * four sections on the same one.
 */
type Ground = 'bg' | 'surface' | 'tint' | 'ink';

const GROUNDS: Record<Ground, string> = {
  bg: 'bg-bg text-ink',
  surface: 'bg-surface text-ink',
  tint: 'bg-accent/[0.06] text-ink',
  ink: 'bg-ink text-surface',
};

interface SectionProps {
  children: ReactNode;
  ground?: Ground;
  id?: string;

  /** The closing call to action and the hero earn more room than a trust strip does. */
  size?: 'normal' | 'roomy' | 'tight';
}

const SIZES = {
  tight: 'py-12 md:py-16',
  normal: 'py-24 md:py-32',
  roomy: 'py-28 md:py-40',
};

export function Section({ children, ground = 'bg', id, size = 'normal' }: SectionProps) {
  return (
    <section id={id} className={`${GROUNDS[ground]} ${SIZES[size]}`}>
      <div className="mx-auto w-full max-w-container px-6 md:px-10">{children}</div>
    </section>
  );
}

/** The line above a section heading. Only where it names something true, never as decoration. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-accent">{children}</p>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="max-w-measure text-section font-semibold">{children}</h2>;
}
