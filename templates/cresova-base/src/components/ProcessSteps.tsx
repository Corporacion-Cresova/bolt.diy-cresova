import { Section, Eyebrow, SectionTitle } from './Section';

/**
 * Three or four numbered steps, horizontal on desktop.
 *
 * The numbers are here because the order is real information — first this, then that. Numbering a
 * list whose order does not matter is one of the tells the design kit names, so if these steps
 * could happen in any sequence, use ServiceList instead.
 */
interface ProcessStepsProps {
  eyebrow: string;
  title: string;
  ground?: 'bg' | 'surface' | 'tint';
  steps: { title: string; description: string }[];
}

export function ProcessSteps({ eyebrow, title, steps, ground = 'bg' }: ProcessStepsProps) {
  return (
    <Section ground={ground}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <SectionTitle>{title}</SectionTitle>

      <ol className="mt-12 grid gap-10 md:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title}>
            <span className="font-display text-4xl font-semibold text-accent/30">{index + 1}</span>
            <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
            <p className="mt-2 text-muted">{step.description}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
