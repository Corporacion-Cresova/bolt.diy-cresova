/**
 * One full width photograph with a sentence over it, at a different rhythm from its neighbours.
 *
 * This is where a page earns the word «premium»: it is the only section allowed to break the
 * container, and there is exactly one per page.
 */
interface EditorialBandProps {
  imageUrl: string;
  imageAlt: string;
  quote: string;
  attribution?: string;
}

export function EditorialBand({ imageUrl, imageAlt, quote, attribution }: EditorialBandProps) {
  return (
    <section className="relative isolate flex min-h-[70vh] items-center justify-center overflow-hidden">
      <img src={imageUrl} alt={imageAlt} loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover" />
      <div className="absolute inset-0 -z-10 bg-ink/60" aria-hidden />

      <blockquote className="mx-auto max-w-4xl px-6 py-24 text-center text-surface">
        <p className="text-section font-display font-heading">{quote}</p>
        {attribution && <footer className="mt-6 text-sm opacity-80">{attribution}</footer>}
      </blockquote>
    </section>
  );
}
