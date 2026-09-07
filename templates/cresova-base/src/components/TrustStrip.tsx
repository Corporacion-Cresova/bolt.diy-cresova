/**
 * The thin band of concrete facts, right under the hero.
 *
 * Concrete is the whole point: years in business, coverage, response time, a certification. "Buen
 * servicio" and "calidad garantizada" say nothing and the reader knows it.
 */
interface TrustStripProps {
  items: { value: string; label: string }[];
}

export function TrustStrip({ items }: TrustStripProps) {
  return (
    <div className="border-y border-ink/10 bg-surface">
      <dl className="mx-auto grid w-full max-w-container grid-cols-2 gap-8 px-6 py-10 md:grid-cols-4 md:px-10">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-sm text-muted">{item.label}</dt>
            <dd className="mt-1 text-lg font-semibold">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
