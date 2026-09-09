import { ArrowRight } from 'lucide-react';
import { Button } from './Button';
import { site, whatsappLink } from '../lib/site';

/**
 * The 60/40 hero: headline on the left, one photo bleeding to the right edge.
 *
 * Deliberately not a background image with text on top, and deliberately not centred — those are
 * the two shapes that read as a template at a glance. The photo carries the page, so it gets real
 * height and object-cover; it is also the only image on the page that loads eagerly.
 */
interface HeroProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  imageAlt: string;
  primaryAction?: { label: string; message: string };
  secondaryAction?: { label: string; href: string };
  facts?: { value: string; label: string }[];
}

export function Hero({
  eyebrow,
  title,
  subtitle,
  imageUrl,
  imageAlt,
  primaryAction,
  secondaryAction,
  facts,
}: HeroProps) {
  return (
    <header className="bg-bg">
      <div className="mx-auto grid w-full max-w-container gap-10 px-6 py-16 md:grid-cols-[3fr_2fr] md:items-center md:gap-14 md:px-10 md:py-24">
        <div className="mide-por-columna">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-accent">{eyebrow}</p>
          <h1 className="text-hero font-semibold">{title}</h1>
          <p className="mt-6 max-w-measure text-muted">{subtitle}</p>

          {(primaryAction || secondaryAction) && (
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {primaryAction && (
                <Button href={whatsappLink(primaryAction.message)} target="_blank" rel="noreferrer">
                  {primaryAction.label}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              {secondaryAction && (
                <Button href={secondaryAction.href} variant="secondary">
                  {secondaryAction.label}
                </Button>
              )}
            </div>
          )}

          {facts && facts.length > 0 && (
            <dl className="mt-12 flex flex-wrap gap-x-12 gap-y-6 border-t border-ink/10 pt-8">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt className="text-xs uppercase tracking-wide text-muted">{fact.label}</dt>
                  <dd className="mt-1 text-2xl font-semibold">{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <img
          src={imageUrl}
          alt={imageAlt}
          width={940}
          height={650}
          className="h-[52vh] w-full rounded-panel object-cover md:h-[70vh] md:rounded-none md:rounded-l-panel"
        />
      </div>
      <span className="sr-only">{site.city}</span>
    </header>
  );
}
