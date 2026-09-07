/**
 * The palette lives here, and it has to.
 *
 * Every section component writes `bg-surface`, `text-ink`, `border-ink/10`, `text-accent`. Those
 * class names only exist because they are declared below. Defining the colours only as CSS custom
 * properties does not create them: PostCSS then fails with «The `border-ink/10` class does not
 * exist», the stylesheet never compiles, and the dev server serves a blank page while looking
 * perfectly healthy. That is the single most common way a generated site has broken.
 *
 * The values point at custom properties anyway (see src/index.css) so switching the sector palette
 * is six lines in one file, and `<alpha-value>` is what makes the /10 and /15 suffixes work.
 */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-strong': 'rgb(var(--accent-strong) / <alpha-value>)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },

      /*
       * The display weight is a decision of the sector row, not a constant. 300 at 9rem is what
       * makes a jewellery page read as expensive; 800 condensed is what makes a workshop read as
       * strong. Using 600 for both is how they end up looking like the same page.
       */
      fontWeight: {
        heading: 'var(--weight-display)',
      },

      /* The scale the design kit asks for, so timid type is not reachable by accident. */
      fontSize: {
        hero: ['clamp(3rem, 9vw, 10rem)', { lineHeight: '0.98', letterSpacing: '-0.025em' }],
        display: ['clamp(4.5rem, 12vw, 9rem)', { lineHeight: '1', letterSpacing: '-0.03em' }],
        section: ['clamp(1.75rem, 3vw, 2.5rem)', { lineHeight: '1.15', letterSpacing: '-0.015em' }],
        body: ['1.0625rem', { lineHeight: '1.6' }],
      },
      maxWidth: {
        container: '1200px',
        measure: '65ch',
      },
      borderRadius: {
        control: '6px',
        panel: '12px',
      },
      boxShadow: {
        raised: '0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px rgb(0 0 0 / 0.06)',
      },
    },
  },
  plugins: [],
};
