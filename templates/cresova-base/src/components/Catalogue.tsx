import { useMemo, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { Section, Eyebrow, SectionTitle } from './Section';
import { Button } from './Button';
import { site, whatsappLink, type Product } from '../lib/site';

/**
 * The section that convinces a shop owner, and the one most often left out.
 *
 * Real items with photo, name, category and price, filters that actually filter, and a quick view
 * that opens the item with a WhatsApp action carrying its name already written. All of it is local
 * state over an array — no routing, no backend, nothing to provision before it can be shown.
 */
interface CatalogueProps {
  eyebrow: string;
  title: string;
  products: Product[];
  ground?: 'bg' | 'surface' | 'tint';
}

export function Catalogue({ eyebrow, title, products, ground = 'surface' }: CatalogueProps) {
  const categories = useMemo(() => ['Todos', ...new Set(products.map((p) => p.category))], [products]);
  const [active, setActive] = useState('Todos');
  const [open, setOpen] = useState<Product | null>(null);

  const shown = active === 'Todos' ? products : products.filter((p) => p.category === active);

  return (
    <Section ground={ground} id="catalogo">
      <Eyebrow>{eyebrow}</Eyebrow>
      <SectionTitle>{title}</SectionTitle>

      <div className="mt-8 flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setActive(category)}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors duration-150 ${
              active === category
                ? 'border-accent bg-accent text-surface'
                : 'border-ink/15 bg-transparent text-muted hover:border-ink/40 hover:text-ink'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((product) => (
          <button key={product.name} onClick={() => setOpen(product)} className="lift group bg-transparent text-left">
            <img
              src={product.imageUrl}
              alt={product.imageAlt}
              loading="lazy"
              width={940}
              height={650}
              className="aspect-[4/3] w-full rounded-control object-cover"
            />
            <p className="mt-3 text-xs uppercase tracking-wide text-muted">{product.category}</p>
            <h3 className="mt-1 font-heading">{product.name}</h3>
            <p className="mt-1 font-semibold text-accent">{product.price}</p>
          </button>
        ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={open.name}
          onClick={() => setOpen(null)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-3xl overflow-auto rounded-panel bg-surface"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={() => setOpen(null)}
              aria-label="Cerrar"
              className="absolute right-4 top-4 rounded-full bg-surface/90 p-2"
            >
              <X className="h-5 w-5" />
            </button>

            <img src={open.imageUrl} alt={open.imageAlt} className="aspect-[16/9] w-full object-cover" />

            <div className="p-8">
              <p className="text-xs uppercase tracking-wide text-muted">{open.category}</p>
              <h3 className="mt-1 text-section font-heading">{open.name}</h3>
              <p className="mt-3 max-w-measure text-muted">{open.description}</p>
              <p className="mt-4 text-2xl font-semibold text-accent">{open.price}</p>

              <Button
                href={whatsappLink(`Hola ${site.name}, me interesa ${open.name}.`)}
                target="_blank"
                rel="noreferrer"
                className="mt-6"
              >
                <MessageCircle className="h-4 w-4" />
                Consultar por WhatsApp
              </Button>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}
