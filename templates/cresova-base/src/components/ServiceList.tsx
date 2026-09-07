import { Section, Eyebrow, SectionTitle } from './Section';

/**
 * Services as an editorial list separated by hairline rules — not three equal cards.
 *
 * Cards are the fallback here, not the default: a list holds a real sentence about what each
 * service includes and a price hint, which is what someone deciding actually reads.
 */
interface ServiceListProps {
  eyebrow: string;
  title: string;
  ground?: 'bg' | 'surface' | 'tint';
  services: { name: string; description: string; price?: string }[];
}

export function ServiceList({ eyebrow, title, services, ground = 'surface' }: ServiceListProps) {
  return (
    <Section ground={ground} id="servicios">
      <Eyebrow>{eyebrow}</Eyebrow>
      <SectionTitle>{title}</SectionTitle>

      <ul className="mt-12 border-t border-ink/10">
        {services.map((service) => (
          <li
            key={service.name}
            className="grid gap-2 border-b border-ink/10 py-7 md:grid-cols-[1fr_2fr_auto] md:items-baseline md:gap-10"
          >
            <h3 className="text-lg font-semibold">{service.name}</h3>
            <p className="max-w-measure text-muted">{service.description}</p>
            {service.price && <p className="font-semibold text-accent md:text-right">{service.price}</p>}
          </li>
        ))}
      </ul>
    </Section>
  );
}
