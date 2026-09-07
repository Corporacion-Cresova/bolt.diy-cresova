import { Section } from './Section';

/**
 * One large quote with attribution. Never a carousel: nobody clicks through testimonials, and a
 * carousel hides the two that were worth reading behind the one that was not.
 */
interface TestimonialProps {
  quote: string;
  author: string;
  role: string;
  ground?: 'bg' | 'surface' | 'tint' | 'ink';
}

export function Testimonial({ quote, author, role, ground = 'tint' }: TestimonialProps) {
  return (
    <Section ground={ground} size="roomy">
      <figure className="mx-auto max-w-3xl text-center">
        <blockquote className="text-section font-display">«{quote}»</blockquote>
        <figcaption className="mt-8 text-sm">
          <span className="font-semibold">{author}</span>
          <span className="text-muted"> · {role}</span>
        </figcaption>
      </figure>
    </Section>
  );
}
