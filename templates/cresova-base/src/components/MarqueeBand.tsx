/**
 * One line of words the business sells on, moving slowly across an accent ground.
 *
 * One per page, and only when the words are real: «seguridad · rendimiento · confianza» works
 * because a workshop can defend all three. A marquee of adjectives nobody would claim out loud is
 * the emptiest section a page can have.
 */
export function MarqueeBand({ words }: { words: string[] }) {
  const line = [...words, ...words];

  return (
    <div className="overflow-hidden bg-accent py-4 text-surface">
      <div className="flex w-max animate-[marquee_28s_linear_infinite] gap-10 motion-reduce:animate-none">
        {line.map((word, index) => (
          <span key={`${word}-${index}`} className="font-display font-heading text-sm uppercase tracking-[0.2em]">
            {word}
            <span aria-hidden className="pl-10 opacity-50">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}
