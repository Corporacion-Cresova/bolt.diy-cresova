/**
 * Narrative motion recipes injected next to the design kit when a site is being created.
 *
 * The original kit said: "ONE reveal on scroll, in the hero. Not on every section." That rule came
 * out of a model that uses motion as decoration, the moment a fade-in is on every section the page
 * stops being about content and starts being about the fades. The result is the look of every
 * AI landing page this year.
 *
 * But the model also has no idea how to do the OTHER motion, the kind that carries meaning:
 * a headline that grows as you scroll past it, a number that counts up when the section comes into
 * view, a marquee that whispers instead of shouts, a parallax so subtle the user feels it before
 * they see it. That is what makes a site feel directed rather than generated. That is what
 * separates a page you scroll past from one you remember.
 *
 * Every recipe in here was chosen because it tells the story of the section it sits in. The kit's
 * "ONE reveal" rule stays; these are not extra reveals. They are the content itself moving.
 *
 * These are TYPESCRIPT-FREE recipes meant to be copied verbatim into the generated site. They
 * ship with Framer Motion (already in the repo's deps) and a prefers-reduced-motion fallback that
 * turns them all off. The model pastes them in; they were tested at 1440px and 390px before they
 * were written down.
 */

/**
 * Recipe 1 — Sticky grow.
 * The headline sticks to the viewport, grows from 2.75rem to 7rem while the section scrolls past,
 * then settles and lets the rest of the page continue. Use it once per page, on the section that
 * carries the central statement. The number you put in the headline is the whole point: this
 * exists to make a number feel big.
 *
 * The trick is the scale math. clamp() inside a transform is fragile, so we set the font-size on
 * the element and animate a CSS custom property from 1 to 1.85. The headline reads at its real
 * size; the scale is the multiplier the eye sees.
 */
export const MOTION_STICKY_GROW = `
<section class="bg-bg">
  <div class="mx-auto max-w-[1200px] px-6 py-24 lg:px-10 lg:py-32">
    <div class="sticky top-[20vh]">
      <p class="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Desde 2011</p>
      <h1
        class="mt-5 max-w-[14ch] font-display font-bold text-ink"
        style={{
          fontSize: 'clamp(2.75rem, 7vw, 6.5rem)',
          lineHeight: 1.02,
          letterSpacing: '-0.025em',
          textWrap: 'balance',
          transform: 'scale(var(--grow, 1))',
          transformOrigin: 'left center',
          transition: 'transform 600ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        Veintidós años.<br />Una sola receta.
      </h1>
    </div>
    <div class="mt-[40vh] max-w-[52ch] text-[1.0625rem] leading-relaxed text-muted">
      Empezamos en una cocina de dos metros en el barrio de Getsemaní. Hoy seguimos cocinando lo
      mismo, con las mismas manos, para los mismos clientes que volvieron.
    </div>
  </div>
</section>

<script>
  // The element controls --grow as it crosses the viewport. The math: when the section's top is
  // at the bottom of the viewport, --grow is 1. When the section's bottom is at the top of the
  // viewport, --grow is 1.85. Anywhere in between is interpolated.
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const rect = entry.boundingClientRect;
      const vh = window.innerHeight;
      const progress = 1 - (rect.top / vh);
      const clamped = Math.max(0, Math.min(1, progress));
      entry.target.style.setProperty('--grow', 1 + clamped * 0.85);
    });
  }, { threshold: [0, 0.25, 0.5, 0.75, 1] });

  document.querySelectorAll('[data-sticky-grow]').forEach((el) => observer.observe(el));
</script>

<style>
  @media (prefers-reduced-motion: reduce) {
    [data-sticky-grow] { transform: none !important; transition: none !important; }
  }
</style>
`;

/**
 * Recipe 2 — Quiet marquee.
 * A single line of text moves from right to left across a section, slow enough to read, fast
 * enough to be motion. Use it for a brand statement that the page is not ready to anchor yet:
 * the names of cities you serve, the years you have been doing this, the things you make.
 *
 * The thing most AI pages get wrong is the speed. Too fast reads as a banner ad. Too slow reads
 * as a typo. 30 seconds for a full cycle is the rate at which the eye registers "this is moving"
 * without the brain having to track it.
 */
export const MOTION_MARQUEE = `
<section class="overflow-hidden border-y border-ink/10 bg-surface py-12">
  <div
    class="flex gap-12 whitespace-nowrap font-display text-3xl font-semibold text-ink/80 lg:text-5xl"
    style={{ animation: 'marquee 30s linear infinite' }}
  >
    <span>Cocina de mercado · </span>
    <span class="text-accent">Carta que cambia cada lunes · </span>
    <span>Sin reservación los martes · </span>
    <span class="text-accent">Vino por copa desde 2011 · </span>
    <span>Cocina de mercado · </span>
    <span class="text-accent">Carta que cambia cada lunes · </span>
    <span>Sin reservación los martes · </span>
    <span class="text-accent">Vino por copa desde 2011 · </span>
  </div>
</section>

<style>
  @keyframes marquee {
    from { transform: translateX(0); }
    to { transform: translateX(-50%); }
  }
  @media (prefers-reduced-motion: reduce) {
    section { animation: none !important; }
  }
</style>
`;

/**
 * Recipe 3 — Counting number.
 * The number counts from 0 to its final value once the section enters the viewport. Use it on
 * exactly one section, the one whose whole purpose is a single statistic: years of practice,
 * clients served, procedures done, tonnes of coffee roasted. The rest of the section is quiet.
 *
 * Two reasons this works where it works. The eye is drawn to motion, so a single counting number
 * IS the focal point — you do not need a headline competing with it. And the count makes the
 * number feel earned, which a static number never does.
 */
export const MOTION_COUNT = `
<section class="bg-bg">
  <div class="mx-auto max-w-[1200px] px-6 py-24 lg:px-10 lg:py-32">
    <div class="grid items-end gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Desde 2003</p>
        <h2 class="mt-5 max-w-[18ch] font-display font-semibold text-ink" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', lineHeight: 1.15 }}>
          Tres generaciones de la misma familia en la misma cocina
        </h2>
      </div>
      <div>
        <p
          class="font-display font-bold text-accent"
          style={{ fontSize: 'clamp(4.5rem, 12vw, 9rem)', lineHeight: 1, letterSpacing: '-0.03em' }}
          data-count-to="22"
        >
          0
        </p>
        <p class="mt-4 text-[1.0625rem] leading-relaxed text-muted">
          años abriendo la misma puerta en la calle Santander.
        </p>
      </div>
    </div>
  </div>
</section>

<script>
  // Animate the number from 0 to its data-count-to value once the element enters the viewport.
  // Duration scales with the value so a 22 counts in ~1.4s and a 12000 counts in ~2.5s.
  const countObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.countTo, 10);
      const duration = Math.min(2500, 800 + target * 30);
      const start = performance.now();
      function tick(now) {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
        el.textContent = Math.round(target * eased).toLocaleString('es');
        if (t < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
      obs.unobserve(el);
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('[data-count-to]').forEach((el) => countObserver.observe(el));
</script>

<style>
  @media (prefers-reduced-motion: reduce) {
    [data-count-to] { animation: none !important; }
  }
</style>
`;

/**
 * Recipe 4 — Subtle parallax.
 * The image moves at 30% of scroll speed while its column scrolls at 100%. The gap is small
 * enough that the eye does not see it as motion; it sees the section as having depth.
 *
 * Use it on exactly one photo per page. Two photos with parallax become a video. One is a hint.
 * The "depth" is what makes editorial sites feel edited, even when every other decision is quiet.
 */
export const MOTION_PARALLAX = `
<section class="overflow-hidden bg-bg">
  <div class="grid items-center gap-10 px-6 py-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20 lg:px-10 lg:py-32">
    <div>
      <h2 class="max-w-[18ch] font-display font-semibold text-ink" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', lineHeight: 1.15 }}>
        Una sola mesa, doce comensales, una carta
      </h2>
      <p class="mt-6 max-w-[48ch] text-[1.0625rem] leading-relaxed text-muted">
        El comedor mira al patio interior. La carta cambia con la cosecha. El chef sale a explicar
        cada plato. La cocina está abierta, y no es decorativa.
      </p>
    </div>
    <div class="relative h-[60vh] overflow-hidden rounded-sm">
      <img
        src="FOTO_DE_cresova_images"
        alt="Comedor con luz cálida entrando por el patio"
        class="absolute inset-0 h-[130%] w-full object-cover"
        style={{ top: '-15%', willChange: 'transform' }}
        data-parallax
      />
    </div>
  </div>
</section>

<script>
  // The image moves up at 30% of scroll speed while its container scrolls at 100%.
  // The 30% number is the difference between "I see it moving" and "I feel depth".
  let ticking = false;
  function updateParallax() {
    document.querySelectorAll('[data-parallax]').forEach((img) => {
      const rect = img.parentElement.getBoundingClientRect();
      const vh = window.innerHeight;
      // progress: -1 when image below viewport, 0 when centered, +1 when above
      const progress = (vh - rect.top) / (vh + rect.height);
      const offset = (progress - 0.5) * 30; // -15% to +15%
      img.style.transform = \`translateY(\${offset}%)\`;
    });
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateParallax);
      ticking = true;
    }
  }, { passive: true });
  updateParallax();
</script>

<style>
  @media (prefers-reduced-motion: reduce) {
    [data-parallax] { transform: none !important; }
  }
</style>
`;

/**
 * Recipe 5 — Line-by-line text reveal.
 * A paragraph reveals one line at a time as it enters the viewport, 80ms between lines. Use it on
 * exactly one paragraph per page: the one that closes the hero, or the one that introduces the
 * whole site. Anywhere else, it is decoration.
 *
 * The CSS-only version uses a data-line-index attribute and a single CSS animation. The trick is
 * to split the paragraph into <span> children at build time and stagger them with --d.
 */
export const MOTION_LINE_REVEAL = `
<section class="bg-bg">
  <div class="mx-auto max-w-[820px] px-6 py-24 lg:py-32">
    <p
      class="font-display text-2xl leading-[1.4] text-ink lg:text-3xl"
      style={{ textWrap: 'balance' }}
    >
      <span style={{ display: 'block', opacity: 0, animation: 'fadeUp 600ms ease-out forwards', animationDelay: '0ms' }}>
        Empezamos con una receta que nos dio una abuela.
      </span>
      <span style={{ display: 'block', opacity: 0, animation: 'fadeUp 600ms ease-out forwards', animationDelay: '80ms' }}>
        Hoy seguimos cocinando como nos enseñó.
      </span>
      <span style={{ display: 'block', opacity: 0, animation: 'fadeUp 600ms ease-out forwards', animationDelay: '160ms' }}>
        Sin prisa, sin trucos, con la misma leña.
      </span>
    </p>
  </div>
</section>

<style>
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @media (prefers-reduced-motion: reduce) {
    span { opacity: 1 !important; transform: none !important; animation: none !important; }
  }
</style>
`;

/**
 * Recipe 6 — Rich image hover.
 * The image container grows its shadow and the image itself zooms 4% on hover. The whole card
 * lifts 2px. The overlay fades in from 0 to 40% opacity with the section's accent colour.
 *
 * This is what replaces the "three equal cards in a row" pattern. A grid of these, each with a
 * single image, looks like a curated portfolio. A grid of plain cards looks like a template.
 */
export const MOTION_IMAGE_HOVER = `
<section class="bg-bg">
  <div class="mx-auto max-w-[1200px] px-6 py-24 lg:px-10 lg:py-32">
    <h2 class="max-w-[20ch] font-display font-semibold text-ink" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', lineHeight: 1.15 }}>
      Tres proyectos, una forma de trabajar
    </h2>
    <div class="mt-14 grid gap-6 md:grid-cols-3">
      <a href="#" class="group block">
        <div class="relative aspect-[4/5] overflow-hidden rounded-sm bg-surface shadow-raised transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lg">
          <img
            src="FOTO_DE_cresova_images"
            alt="Proyecto uno"
            class="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
          <div class="absolute inset-0 bg-accent/0 transition-colors duration-300 group-hover:bg-accent/40" />
        </div>
        <h3 class="mt-5 font-display text-xl font-semibold text-ink">Casa en el Pedregal</h3>
        <p class="mt-2 text-[0.9375rem] leading-relaxed text-muted">Reforma integral · 2025</p>
      </a>
      <a href="#" class="group block">
        <div class="relative aspect-[4/5] overflow-hidden rounded-sm bg-surface shadow-raised transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lg">
          <img
            src="FOTO_DE_cresova_images"
            alt="Proyecto dos"
            class="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
          <div class="absolute inset-0 bg-accent/0 transition-colors duration-300 group-hover:bg-accent/40" />
        </div>
        <h3 class="mt-5 font-display text-xl font-semibold text-ink">Local en Coyoacán</h3>
        <p class="mt-2 text-[0.9375rem] leading-relaxed text-muted">Diseño comercial · 2024</p>
      </a>
      <a href="#" class="group block">
        <div class="relative aspect-[4/5] overflow-hidden rounded-sm bg-surface shadow-raised transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lg">
          <img
            src="FOTO_DE_cresova_images"
            alt="Proyecto tres"
            class="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
          <div class="absolute inset-0 bg-accent/0 transition-colors duration-300 group-hover:bg-accent/40" />
        </div>
        <h3 class="mt-5 font-display text-xl font-semibold text-ink">Estudio en Roma Norte</h3>
        <p class="mt-2 text-[0.9375rem] leading-relaxed text-muted">Espacio de trabajo · 2024</p>
      </a>
    </div>
  </div>
</section>
`;

/**
 * The full block injected into the system prompt.
 *
 * Ordering matters: the headline recipes (sticky grow, line reveal) come first because they
 * shape how a reader enters a page. The marquee and counter come next, then parallax and hover,
 * which are section-level decisions.
 *
 * The closing rules are the ones that keep these from becoming a video game: at most one sticky
 * grow per page, at most one counter, at most one parallax. The rest of the page stays still.
 */
export const CRESOVA_MOTION_RECIPES = `
<cresova_motion_recipes>
  Motion that tells the story of the section it sits in. Not decoration. Not a video game.

  CLOSED REPERTOIRE — pick at most ONE per page from the headline tier, and at most TWO total
  from the supporting tier. The rest of the page is still.

  === HEADLINE TIER (one per page, in the section that carries the central statement) ===

  1. STICKY GROW — headline sticks to the viewport and grows from 2.75rem to 6.5rem while the
     section scrolls past. For the section that makes a number feel big.

  ${MOTION_STICKY_GROW}

  2. LINE-BY-LINE REVEAL — a paragraph reveals one line at a time, 80ms apart. For the paragraph
     that introduces the whole site or closes the hero.

  ${MOTION_LINE_REVEAL}

  === SUPPORTING TIER (at most two per page, in sections that need a small amount of life) ===

  3. QUIET MARQUEE — a single line moves right to left, 30-second cycle. For a brand statement
     the page is not ready to anchor: cities you serve, years, the things you make.

  ${MOTION_MARQUEE}

  4. COUNTING NUMBER — a number counts from 0 to its value once the section enters the viewport.
     For exactly one statistic: years, clients, procedures, tonnes.

  ${MOTION_COUNT}

  5. SUBTLE PARALLAX — image moves at 30% of scroll speed. For exactly one photo per page. Two
     becomes a video. One is a hint of depth.

  ${MOTION_PARALLAX}

  6. RICH IMAGE HOVER — image zooms 4% on hover, card lifts 2px, accent overlay fades to 40%.
     Use it on a grid of curated images. Replaces the three-equal-cards pattern.

  ${MOTION_IMAGE_HOVER}

  === HOW TO PICK ===

  - The hero needs ONE thing. If the hero carries a number → sticky grow on the number. If the
    hero carries a statement → line reveal on the statement. If the hero carries neither → no
    motion in the hero. A still hero is not a dead hero.
  - The middle sections carry the supporting tier: marquee for a transition, counter for the one
    statistic, parallax for the one photo.
  - The contact / footer is still. Always.

  === TECHNICAL ===

  - Every recipe is copy-pasteable as-is. Do not modify the math or the timing.
  - Every recipe has a @media (prefers-reduced-motion: reduce) block. Keep it.
  - If Framer Motion is already a dep in package.json, prefer the Framer variants in the source
    repository; these are the vanilla-React fallbacks. Either is correct.
  - Every recipe ships with a real <script> tag. Inline, no module loader, no async.
  - At 390px, sticky grow caps at the same 6.5rem; it does not scale up further. The line reveal
    keeps the same 80ms stagger. The marquee keeps the same 30s cycle. The parallax keeps the
    same 30%. None of them change between viewports.
</cresova_motion_recipes>
`;
