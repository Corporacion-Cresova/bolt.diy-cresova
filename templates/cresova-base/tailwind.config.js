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
        tint: 'rgb(var(--tint) / <alpha-value>)',
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
        /*
         * `cqw` y no `vw`: el titular se mide contra la columna donde vive, no contra la ventana.
         * Necesita un ancestro con `container-type: inline-size`; eso lo pone `.mide-por-columna`
         * en index.css.
         *
         * Los números vienen de medir un sitio generado, no de estimarlos. La versión anterior
         * —`clamp(2.75rem, 13cqw, 10rem)`— se escribió suponiendo que la columna del hero medía
         * 690px. Medida en un sitio real (zorzalexpress) medía 294, porque la pista del grid se
         * colapsaba, y el titular caía al piso del clamp: 44px con interlineado de 43px, o sea
         * líneas que se tocan. El mismo token, en un h2 de ancho completo, llegaba al techo de
         * 160px. Un token que produce 44 y 160 en la misma página no es una escala.
         *
         * 10cqw con techo de 5rem: ~64px en la columna del 60/40 ya arreglada (638px) y 80px como
         * máximo absoluto. La referencia es una clínica que el cliente aprobó, medida en el
         * navegador: h1 de 62px sobre cuerpo de 18px, proporción 3,4x. Acá queda 64 sobre 17, o
         * sea 3,8x. La versión anterior permitía 9,4x.
         *
         * El interlineado pasa de 0.98 a 1.03 por la misma razón: por debajo de 1 solo es seguro
         * en tamaños de display, y este token también se usa en el piso.
         */
        hero: ['clamp(2.5rem, 10cqw, 5rem)', { lineHeight: '1.03', letterSpacing: '-0.025em' }],
        display: ['clamp(3rem, 8vw, 6rem)', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
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
