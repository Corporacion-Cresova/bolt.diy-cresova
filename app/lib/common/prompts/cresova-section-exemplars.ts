/**
 * Six worked sections, injected next to the design kit when a site is being created.
 *
 * The kit describes; these show. That distinction is the whole reason this file exists: build 216
 * measured that the model follows values to the digit and loses prose, and an exemplar is the
 * ultimate value — it does not describe what good is, it is an instance of it.
 *
 * They cover exactly the places where the kit has to say «never» (cards instead of a list, four
 * equal squares, a carousel, a centred hero). A «never» is a confession that the model's instinct
 * goes the wrong way there, and prose has not moved it.
 *
 * Every one of these was rendered in a browser and looked at before it was written here, at
 * 1440px and at 390px. That is not ceremony: the first draft of hero A wrapped its headline into
 * five lines and its photo never reached the edge it was supposed to bleed off, and neither is
 * visible by reading the code. Shipping an exemplar nobody has seen would teach the model to
 * produce something nobody has seen.
 *
 * The risk this file carries is that the model copies them verbatim and every site comes out the
 * same. Three things hold that off, and they are load-bearing: two heroes that are deliberate
 * opposites, so there is no single answer to reproduce; annotations on every one, so they read as
 * lessons rather than templates; and colours as token names rather than hex, so the sector table
 * still decides the palette.
 */
export const CRESOVA_SECTION_EXEMPLARS = `
<cresova_section_exemplars>
  Six sections built to the standard this builder is held to. They are here because the design kit
  has to say «never» in four places — cards instead of a list, four equal squares, a carousel, a
  centred hero — and a «never» is a confession that the instinct goes the wrong way there. Prose has
  not moved it. An example does.

  HOW TO READ THESE, and it matters more than the code:
  - COPY THE DENSITY OF DECISIONS, NOT THE ARRANGEMENT. Count what is decided in one of these: an
    eyebrow, a measure on the paragraph, two different paddings, a hover, a focus ring, a real
    number. That count is the standard. The layout is not.
  - There are TWO heroes on purpose, and they are opposites. There is no «the» hero to reproduce.
  - Colours are token names (bg, surface, ink, muted, accent, accent-strong) so these work with any
    row of the sector table. Take the hex from your sector, never from here.
  - The copy is real and specific because that is part of the standard. Write yours the same way,
    about the actual business.

  ---- HERO A · the split, photo bleeding off the right edge ----
  Demonstrates: an asymmetric hero with a stat strip that earns its place.

  <section className="bg-bg">
    <div className="grid items-stretch lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
      <div className="flex items-center px-6 py-24 lg:py-32 lg:pl-[max(2.5rem,calc((100vw-1200px)/2))] lg:pr-16">
        <div className="w-full">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Roatán · Isla de la Bahía</p>
          <h1 className="mt-5 max-w-[15ch] font-display font-bold text-ink" style={{ fontSize: 'clamp(2.5rem,4.4vw,4rem)', lineHeight: 1.05, letterSpacing: '-0.02em', textWrap: 'balance' }}>
            Bucea el arrecife más grande del Caribe
          </h1>
          <p className="mt-6 max-w-[52ch] text-[1.0625rem] leading-relaxed text-muted">
            Salidas diarias a las 7:30 y 13:00 con instructor PADI, equipo completo y un máximo de seis buzos por lancha.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
            <a href="#reservar" className="inline-flex items-center gap-2 rounded-md bg-accent px-6 py-3.5 text-[0.9375rem] font-semibold text-white transition-colors duration-150 hover:bg-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              Reservar una salida
            </a>
            <a href="#precios" className="group inline-flex items-center gap-1.5 text-[0.9375rem] font-medium text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-no-repeat bg-left-bottom transition-[background-size] duration-150 group-hover:bg-[length:100%_1px]">Ver precios y horarios</span>
              <span aria-hidden="true">→</span>
            </a>
          </div>
          <dl className="mt-14 flex flex-wrap gap-x-12 gap-y-6 border-t border-ink/10 pt-8">
            <div><dt className="text-xs uppercase tracking-[0.12em] text-muted">Desde</dt><dd className="mt-1 font-display text-2xl font-semibold">$85</dd></div>
            <div><dt className="text-xs uppercase tracking-[0.12em] text-muted">Duración</dt><dd className="mt-1 font-display text-2xl font-semibold">4 h</dd></div>
            <div><dt className="text-xs uppercase tracking-[0.12em] text-muted">Grupo máximo</dt><dd className="mt-1 font-display text-2xl font-semibold">6</dd></div>
          </dl>
        </div>
      </div>
      <div className="relative min-h-[320px] lg:min-h-[70vh]">
        <img src="FOTO_DE_cresova_images" alt="Buzo sobre el arrecife" className="absolute inset-0 h-full w-full object-cover" />
      </div>
    </div>
  </section>

  Why it works:
  - The bleed is real. \`lg:pl-[max(2.5rem,calc((100vw-1200px)/2))]\` keeps the text aligned with a
    1200px container while the photo runs to the viewport edge. A photo inside the container is a
    photo in a box, and it looks like one.
  - The headline is capped at 15ch, not left to wrap where it likes. Uncapped it broke into five
    lines and read as a paragraph. \`text-wrap: balance\` evens out what is left.
  - The stats are three real numbers, not three adjectives. That strip is the difference between a
    hero that says something and a hero that decorates.
  - \`min-h-[70vh]\` on desktop only. On a phone the photo becomes a 320px band under the text.

  ---- HERO B · the opposite answer: type first, photo second ----
  Demonstrates: that a hero can carry the page on typography alone.

  <section className="border-y border-ink/10 bg-surface">
    <div className="mx-auto max-w-[1200px] px-6 py-24 lg:px-10 lg:py-32">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Desde 2011</p>
      <h1 className="mt-5 max-w-[16ch] font-display font-bold" style={{ fontSize: 'clamp(2.5rem,6vw,5rem)', lineHeight: 1, letterSpacing: '-0.025em', textWrap: 'balance' }}>
        Cuatro tours.<br />Ni uno con prisa.
      </h1>
      <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:items-end">
        <img src="FOTO_DE_cresova_images" alt="Recorrido de canopy sobre la selva" className="aspect-[7/4] w-full rounded-sm object-cover" />
        <div className="lg:pb-2">
          <p className="max-w-[38ch] text-[1.0625rem] leading-relaxed text-muted">
            Grupos de ocho personas como máximo, guía bilingüe y transporte desde tu hotel. Sin filas y sin reloj.
          </p>
          <a href="#tours" className="mt-7 inline-flex items-center gap-2 rounded-md bg-accent px-6 py-3.5 text-[0.9375rem] font-semibold text-white transition-colors duration-150 hover:bg-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            Ver los cuatro tours
          </a>
        </div>
      </div>
    </div>
  </section>

  Why it works, and why it is here next to hero A:
  - Same job, opposite solution. A is a split with the image carrying half the weight; B puts the
    headline alone at the top and demotes the photo. Both are right. That is the lesson.
  - The manual \`<br />\` is a decision, not laziness: «Cuatro tours. / Ni uno con prisa.» is a joke
    with a beat, and the line break is the timing. Break lines when the words have a rhythm.
  - \`items-end\` drops the paragraph to the bottom of the image. Aligning to the top would have been
    the default; aligning to the bottom is the composition.

  ---- SERVICES · an editorial list, which is what the kit means by «cards are the fallback» ----
  Demonstrates: services that read like a menu instead of a grid of boxes.

  <section className="bg-bg">
    <div className="mx-auto max-w-[1200px] px-6 py-24 lg:px-10 lg:py-32">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <h2 className="max-w-[20ch] font-display font-semibold" style={{ fontSize: 'clamp(1.75rem,3vw,2.5rem)', lineHeight: 1.15, letterSpacing: '-0.015em' }}>
          Lo que hacemos
        </h2>
        <p className="max-w-[42ch] text-[0.9375rem] leading-relaxed text-muted">
          Todos los precios incluyen equipo, seguro y traslado dentro de West End.
        </p>
      </div>
      <ul className="mt-14 border-t border-ink/12">
        {servicios.map((servicio) => (
          <li key={servicio.nombre} className="group border-b border-ink/12">
            <a href={servicio.href} className="grid gap-2 py-8 transition-colors duration-150 hover:bg-ink/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:grid-cols-[minmax(0,4fr)_minmax(0,6fr)_auto] md:items-baseline md:gap-10 md:px-2">
              <h3 className="font-display text-xl font-semibold md:text-2xl">{servicio.nombre}</h3>
              <p className="text-[0.9375rem] leading-relaxed text-muted">{servicio.incluye}</p>
              <span className="whitespace-nowrap font-display text-lg font-semibold text-accent">{servicio.desde}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  </section>

  Why it works:
  - Three columns on one baseline: name, what it includes, price. A card would have stacked the
    same three things and taken four times the space to say less.
  - Hairline rules at ink/12, not a border box per item. The rules do the separating; the row does
    not need walls.
  - A price hint on every row. «Consultar» on all three is the fastest way to look like a template.
  - The whole row is the link, and it has a focus ring. A card grid usually links only the title.

  ---- GALLERY · asymmetric, never four equal squares ----
  Demonstrates: a grid where one photo leads and the others support.

  <section className="border-y border-ink/10 bg-surface">
    <div className="mx-auto max-w-[1200px] px-6 py-24 lg:px-10 lg:py-32">
      <h2 className="max-w-[20ch] font-display font-semibold" style={{ fontSize: 'clamp(1.75rem,3vw,2.5rem)', lineHeight: 1.15, letterSpacing: '-0.015em' }}>
        Un martes cualquiera
      </h2>
      <div className="mt-12 grid gap-4 sm:h-[560px] sm:grid-cols-6 sm:grid-rows-2">
        <img src="FOTO_DE_cresova_images" alt="Salida de la lancha al amanecer" className="h-64 w-full rounded-sm object-cover sm:col-span-4 sm:row-span-2 sm:h-full" />
        <img src="FOTO_DE_cresova_images" alt="Equipo listo en cubierta" className="h-40 w-full rounded-sm object-cover sm:col-span-2 sm:h-full" />
        <img src="FOTO_DE_cresova_images" alt="Tortuga sobre el arrecife" className="h-40 w-full rounded-sm object-cover sm:col-span-2 sm:h-full" />
      </div>
    </div>
  </section>

  Why it works:
  - 4+2+2 over two rows. One photo is clearly the subject; the other two are context. Four equal
    squares say all three are equally unimportant.
  - A fixed section height on desktop with \`object-cover\` means mixed source ratios still line up.
    Without it one tall photo ruins the row.
  - The heading is «Un martes cualquiera», not «Galería». Name the section after what is in it.

  ---- TESTIMONIAL · one quote, large, never a carousel ----
  Demonstrates: social proof treated as typography.

  <section className="bg-accent/[0.06]">
    <div className="mx-auto max-w-[1200px] px-6 py-24 lg:px-10 lg:py-32">
      <figure className="max-w-[26ch] sm:max-w-[34ch]">
        <blockquote className="font-display font-semibold text-ink" style={{ fontSize: 'clamp(1.75rem,3.4vw,2.75rem)', lineHeight: 1.2, letterSpacing: '-0.015em', textWrap: 'balance' }}>
          <p>“Llevaba diez años sin meterme al agua. Salí pidiendo la segunda inmersión.”</p>
        </blockquote>
        <figcaption className="mt-8 flex items-center gap-4">
          <img src="FOTO_DE_cresova_images" alt="" className="h-12 w-12 rounded-full object-cover" />
          <span className="text-[0.9375rem] leading-tight">
            <span className="block font-semibold">Marta Sandoval</span>
            <span className="block text-muted">San Pedro Sula · marzo 2026</span>
          </span>
        </figcaption>
      </figure>
    </div>
  </section>

  Why it works:
  - The quote is set at heading size. A testimonial in body copy is a testimonial nobody reads.
  - A narrow measure (26–34ch) forces the short line breaks that make a quote feel spoken.
  - The quote says something specific and slightly unflattering («llevaba diez años sin meterme»).
    «Excelente servicio, muy recomendado» is the sound of a made-up review.
  - This is the section that carries the accent tint as its ground. That is the page's rhythm doing
    its job: it is the only tinted band.
  - \`alt=""\` on the portrait, on purpose: the name is right next to it, so the image is decoration
    and a screen reader should skip it.

  ---- CONTACT · two columns, the ask on one side, the facts on the other ----
  Demonstrates: the section where most generated sites give up.

  <section className="bg-bg">
    <div className="mx-auto grid max-w-[1200px] gap-14 px-6 py-24 lg:grid-cols-2 lg:gap-24 lg:px-10 lg:py-32">
      <div>
        <h2 className="max-w-[18ch] font-display font-semibold" style={{ fontSize: 'clamp(1.75rem,3vw,2.5rem)', lineHeight: 1.15, letterSpacing: '-0.015em' }}>
          ¿Reservamos?
        </h2>
        <p className="mt-5 max-w-[46ch] text-[1.0625rem] leading-relaxed text-muted">
          Contestamos por WhatsApp en menos de una hora, de 6:00 a 20:00.
        </p>
        <form className="mt-9 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2">
            <span className="text-[0.8125rem] font-medium">Nombre</span>
            <input type="text" name="nombre" required className="rounded-md border border-ink/15 bg-surface px-4 py-3 text-[0.9375rem] outline-none transition-colors duration-150 focus:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" />
          </label>
          <label className="grid gap-2">
            <span className="text-[0.8125rem] font-medium">WhatsApp</span>
            <input type="tel" name="telefono" required className="rounded-md border border-ink/15 bg-surface px-4 py-3 text-[0.9375rem] outline-none transition-colors duration-150 focus:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" />
          </label>
          <label className="grid gap-2">
            <span className="text-[0.8125rem] font-medium">¿Qué tour te interesa?</span>
            <textarea rows={3} name="mensaje" className="rounded-md border border-ink/15 bg-surface px-4 py-3 text-[0.9375rem] outline-none transition-colors duration-150 focus:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" />
          </label>
          <button type="submit" className="mt-2 justify-self-start rounded-md bg-accent px-6 py-3.5 text-[0.9375rem] font-semibold text-white transition-colors duration-150 hover:bg-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            Enviar
          </button>
        </form>
      </div>
      <div className="rounded-sm bg-surface p-8 shadow-raised lg:p-10">
        <dl className="grid gap-7">
          <div><dt className="text-xs uppercase tracking-[0.12em] text-muted">Dónde estamos</dt><dd className="mt-2 text-[1.0625rem] leading-relaxed">Half Moon Bay Road, West End<br />Roatán, Islas de la Bahía</dd></div>
          <div><dt className="text-xs uppercase tracking-[0.12em] text-muted">Horario</dt><dd className="mt-2 text-[1.0625rem] leading-relaxed">Lunes a domingo, 6:00 – 20:00</dd></div>
          <div><dt className="text-xs uppercase tracking-[0.12em] text-muted">Teléfono</dt><dd className="mt-2 text-[1.0625rem] leading-relaxed"><a href="tel:+50490000000" className="underline decoration-accent decoration-2 underline-offset-4">+504 9000 0000</a></dd></div>
        </dl>
        <img src="FOTO_DE_cresova_images" alt="Mapa de la zona de West End" className="mt-8 aspect-[16/9] w-full rounded-sm object-cover" />
      </div>
    </div>
  </section>

  Why it works:
  - The right card is the only raised surface on the page. One shadow, used once, reads as
    deliberate; a shadow on everything reads as a default.
  - Every field has a visible label above it. Placeholder-as-label disappears the moment you type
    and is the single most common accessibility failure in generated forms.
  - Real hours, a real street, a real phone that dials (\`tel:\`). «Lunes a viernes» with no times is
    the tell that nobody filled this in.
  - The heading is a question the visitor would answer, not the word «Contacto».
</cresova_section_exemplars>
`;
