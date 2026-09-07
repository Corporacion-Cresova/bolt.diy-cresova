import { Section, Eyebrow, SectionTitle } from './Section';

/**
 * Three full-bleed photographs with a title over each — one per line of business.
 *
 * Not three cards. Three cards in a row is the answer a generated page gives to every section, and
 * a business with three real lines deserves to have them shown at photograph size.
 */
interface CategoryTriptychProps {
  eyebrow: string;
  title: string;
  ground?: 'bg' | 'surface' | 'tint';
  categories: { name: string; line: string; imageUrl: string; imageAlt: string; href?: string }[];
}

export function CategoryTriptych({ eyebrow, title, categories, ground = 'bg' }: CategoryTriptychProps) {
  return (
    <Section ground={ground} id="categorias">
      <Eyebrow>{eyebrow}</Eyebrow>
      <SectionTitle>{title}</SectionTitle>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {categories.map((category) => (
          <a
            key={category.name}
            href={category.href ?? '#catalogo'}
            className="lift group relative isolate flex min-h-[26rem] items-end overflow-hidden rounded-control"
          >
            <img
              src={category.imageUrl}
              alt={category.imageAlt}
              loading="lazy"
              className="absolute inset-0 -z-10 h-full w-full object-cover"
            />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/85 via-ink/25 to-transparent" aria-hidden />

            <div className="p-7 text-surface">
              <h3 className="text-2xl font-heading">{category.name}</h3>
              <p className="mt-2 max-w-[28ch] text-sm opacity-85">{category.line}</p>
            </div>
          </a>
        ))}
      </div>
    </Section>
  );
}
