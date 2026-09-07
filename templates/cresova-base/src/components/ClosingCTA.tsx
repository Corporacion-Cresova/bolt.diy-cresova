import { ArrowRight } from 'lucide-react';
import { Button } from './Button';
import { whatsappLink } from '../lib/site';

/**
 * The headline at display size on an inverted ground, one action, nothing else.
 *
 * Last thing before the footer. A page that just stops after its testimonials leaves the visitor
 * with nowhere to go, and this is the cheapest section to get right.
 */
export function ClosingCTA({ title, message, label }: { title: string; message: string; label: string }) {
  return (
    <section className="bg-ink py-28 text-surface md:py-40">
      <div className="mx-auto flex w-full max-w-container flex-col items-start gap-8 px-6 md:px-10">
        <h2 className="max-w-3xl text-hero font-heading leading-[0.98]">{title}</h2>
        <Button href={whatsappLink(message)} target="_blank" rel="noreferrer">
          {label}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
