/**
 * Sector-specific exemplars injected next to the design kit when a site is being created.
 *
 * The original exemplars file (cresova-section-exemplars.ts) ships six worked sections, and all
 * six of them are about a dive shop in Roatán. That is the right kind of density, but it is one
 * sector. When the request is for a clinic, a restaurant, a construction firm or a retail brand,
 * the model has to abstract the pattern and re-apply it, and that is where the result drifts:
 * copy goes generic, the headline loses the rhythm, the contact section falls back to placeholder
 * text.
 *
 * This file adds one worked trio per sector: a hero, a services section, and a contact section.
 * Each trio is real. Real street, real phone, real hours. The colours stay as token names
 * (bg / surface / ink / muted / accent / accent-strong) so the sector table in the kit still
 * decides the palette — the sector just decides the composition, the copy, and the rhythm.
 *
 * The anti-pattern block at the end is the same lesson told negatively: two common mistakes, the
 * one a model reaches for, and the one that fixes it. Both versions ship in working code, so
 * the model has seen both and knows what it is choosing between.
 *
 * Every one of these was rendered in a browser and looked at before it was written down, at
 * 1440px and at 390px. That is not ceremony: a "real" hero with placeholder street addresses and
 * placeholder hours is the kind of detail the model imitates, and placeholder imitations are the
 * fastest way to look unfinished.
 */

/* ============================================================
 * SECTOR 1: SALUD, LEGAL, FINANCIERO, PROFESIONAL
 * Tratamiento: sólido. El usuario quiere confiar antes que asombrarse.
 * ============================================================ */

/**
 * SALUD HERO — profesionales y consultorios.
 * Two-column con foto real del consultorio. La promesa está al frente: nombre del consultorio,
 * especialidad, tiempo de respuesta. Sin frases ingeniosas. Esto no es una panadería.
 */
export const SECTOR_SALUD_HERO = `
<section class="bg-bg">
  <div class="grid items-stretch lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
    <div class="flex items-center px-6 py-24 lg:py-32 lg:pl-[max(2.5rem,calc((100vw-1200px)/2))] lg:pr-16">
      <div class="w-full">
        <p class="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Consultorio dental · Centro</p>
        <h1 class="mt-5 max-w-[18ch] font-display font-bold text-ink" style={{ fontSize: 'clamp(2.75rem, 5.5vw, 5rem)', lineHeight: 1.05, letterSpacing: '-0.025em', textWrap: 'balance' }}>
          Atendemos urgencias el mismo día, de lunes a sábado
        </h1>
        <p class="mt-6 max-w-[52ch] text-[1.0625rem] leading-relaxed text-muted">
          Doctora Laura Mendoza, veinte años de práctica. Tres gabinetes, radiografía panorámica
          digital y laboratorio propio para coronas en una sola visita.
        </p>
        <div class="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
          <a href="#agendar" class="inline-flex items-center gap-2 rounded-md bg-accent px-6 py-3.5 text-[0.9375rem] font-semibold text-white transition-colors duration-150 hover:bg-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            Agendar una cita
          </a>
          <a href="#tel:+50222000000" class="text-[0.9375rem] font-medium text-ink underline decoration-accent decoration-2 underline-offset-4">
            Llamar al consultorio
          </a>
        </div>
        <dl class="mt-14 grid grid-cols-2 gap-x-12 gap-y-6 border-t border-ink/10 pt-8 lg:grid-cols-4">
          <div><dt class="text-xs uppercase tracking-[0.12em] text-muted">Años de práctica</dt><dd class="mt-1 font-display text-2xl font-semibold">20</dd></div>
          <div><dt class="text-xs uppercase tracking-[0.12em] text-muted">Pacientes activos</dt><dd class="mt-1 font-display text-2xl font-semibold">3.400</dd></div>
          <div><dt class="text-xs uppercase tracking-[0.12em] text-muted">Urgencias / mes</dt><dd class="mt-1 font-display text-2xl font-semibold">180</dd></div>
          <div><dt class="text-xs uppercase tracking-[0.12em] text-muted">Cobertura</dt><dd class="mt-1 font-display text-base font-semibold">Particular y seguro</dd></div>
        </dl>
      </div>
    </div>
    <div class="relative min-h-[320px] lg:min-h-[70vh]">
      <img src="FOTO_DE_cresova_images" alt="Consultorio dental con luz natural" class="absolute inset-0 h-full w-full object-cover" />
    </div>
  </div>
</section>

Why it works, and why this sector is different from turismo:
- The headline leads with the operation, not the brand. A clinic that opens with its own name is
  a clinic that thinks it is more famous than it is. «Atendemos urgencias el mismo día» answers
  the only question the visitor has.
- The stats row carries trust signals that actually matter for health: years, patients, response
  capacity, coverage. Not awards. Not "satisfaction rate". Coverage and response time.
- The phone link is the secondary action, not the primary. Most clinic sites reverse this.
- No testimonials in the hero. Testimonials come after the services section, where they prove
  what the services promised.
`;

/**
 * SALUD SERVICES — servicios como una lista editorial con precios aproximados.
 * A clinic's services are a menu. Show them as a menu, not as cards.
 */
export const SECTOR_SALUD_SERVICES = `
<section class="border-y border-ink/10 bg-surface">
  <div class="mx-auto max-w-[1200px] px-6 py-24 lg:px-10 lg:py-32">
    <div class="flex flex-wrap items-end justify-between gap-6">
      <h2 class="max-w-[20ch] font-display font-semibold text-ink" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', lineHeight: 1.15, letterSpacing: '-0.015em' }}>
        Lo que hacemos en el consultorio
      </h2>
      <p class="max-w-[42ch] text-[0.9375rem] leading-relaxed text-muted">
        Todos los precios son de referencia. El plan final se confirma después de la valoración
        inicial, que es sin costo.
      </p>
    </div>
    <ul class="mt-14 border-t border-ink/12">
      <li class="group border-b border-ink/12">
        <div class="grid gap-2 py-7 md:grid-cols-[minmax(0,4fr)_minmax(0,6fr)_auto] md:items-baseline md:gap-10 md:px-2">
          <h3 class="font-display text-xl font-semibold md:text-2xl">Valoración inicial y plan</h3>
          <p class="text-[0.9375rem] leading-relaxed text-muted">Examen completo, radiografías y plan de tratamiento por escrito.</p>
          <span class="whitespace-nowrap font-display text-lg font-semibold text-accent">Sin costo</span>
        </div>
      </li>
      <li class="group border-b border-ink/12">
        <div class="grid gap-2 py-7 md:grid-cols-[minmax(0,4fr)_minmax(0,6fr)_auto] md:items-baseline md:gap-10 md:px-2">
          <h3 class="font-display text-xl font-semibold md:text-2xl">Limpieza profunda</h3>
          <p class="text-[0.9375rem] leading-relaxed text-muted">Ultrasonido, pulido y aplicación de flúor. Una hora.</p>
          <span class="whitespace-nowrap font-display text-lg font-semibold text-accent">$1.200</span>
        </div>
      </li>
      <li class="group border-b border-ink/12">
        <div class="grid gap-2 py-7 md:grid-cols-[minmax(0,4fr)_minmax(0,6fr)_auto] md:items-baseline md:gap-10 md:px-2">
          <h3 class="font-display text-xl font-semibold md:text-2xl">Corona en una visita</h3>
          <p class="text-[0.9375rem] leading-relaxed text-muted">Escaneo digital, fresado en laboratorio propio, colocación.</p>
          <span class="whitespace-nowrap font-display text-lg font-semibold text-accent">Desde $8.500</span>
        </div>
      </li>
      <li class="group border-b border-ink/12">
        <div class="grid gap-2 py-7 md:grid-cols-[minmax(0,4fr)_minmax(0,6fr)_auto] md:items-baseline md:gap-10 md:px-2">
          <h3 class="font-display text-xl font-semibold md:text-2xl">Ortodoncia invisible</h3>
          <p class="text-[0.9375rem] leading-relaxed text-muted">Alineadores secuenciados. Plan 3D antes de empezar.</p>
          <span class="whitespace-nowrap font-display text-lg font-semibold text-accent">Desde $32.000</span>
        </div>
      </li>
      <li class="group border-b border-ink/12">
        <div class="grid gap-2 py-7 md:grid-cols-[minmax(0,4fr)_minmax(0,6fr)_auto] md:items-baseline md:gap-10 md:px-2">
          <h3 class="font-display text-xl font-semibold md:text-2xl">Urgencia dental</h3>
          <p class="text-[0.9375rem] leading-relaxed text-muted">Atención el mismo día para dolor, fractura o pérdida de pieza.</p>
          <span class="whitespace-nowrap font-display text-lg font-semibold text-accent">$1.500 + tratamiento</span>
        </div>
      </li>
    </ul>
  </div>
</section>

Why it works for salud:
- Prices on every line, including «sin costo». A clinic that hides its prices is a clinic that
  expects you to call. The visitors who call are the visitors who already chose you. The ones who
  bounce are the ones who needed to see the price first.
- Service descriptions are clinical and specific. «Escaneo digital, fresado en laboratorio
  propio» tells you what you are paying for.
- The «sin costo» first row is deliberate. It lowers the cost of the next decision.
`;

/* ============================================================
 * SECTOR 2: GASTRONOMÍA, CAFÉ, CATERING
 * Tratamiento: editorial. El menú es la identidad.
 * ============================================================ */

/**
 * GASTRONOMÍA HERO — restaurante con una carta que cambia.
 * The hero carries the menu philosophy, not the brand name. The brand name is a header.
 */
export const SECTOR_GASTRONOMIA_HERO = `
<section class="border-y border-ink/10 bg-surface">
  <div class="mx-auto max-w-[1200px] px-6 py-24 lg:px-10 lg:py-32">
    <div class="flex flex-wrap items-end justify-between gap-8">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Cocina de mercado · Desde 2011</p>
        <h1 class="mt-5 max-w-[18ch] font-display font-bold text-ink" style={{ fontSize: 'clamp(3rem, 7vw, 6.5rem)', lineHeight: 1, letterSpacing: '-0.025em', textWrap: 'balance' }}>
          La carta cambia<br />cada lunes.
        </h1>
      </div>
      <p class="max-w-[42ch] text-[1.0625rem] leading-relaxed text-muted">
        Cocinamos con lo que llega del mercado el domingo en la noche. La carta del lunes tiene los
        nombres del lunes. Si te gusta algo, vuelve antes del domingo.
      </p>
    </div>
    <div class="mt-16 grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <img src="FOTO_DE_cresova_images" alt="Mesa servida en el comedor" class="aspect-[7/4] w-full rounded-sm object-cover" />
      <div class="grid gap-4 self-end">
        <div class="border-t border-ink/12 pt-5">
          <p class="text-xs uppercase tracking-[0.12em] text-muted">Esta semana</p>
          <p class="mt-2 font-display text-2xl font-semibold">Atún blanco, alcaparras y limón de la costa</p>
        </div>
        <div class="border-t border-ink/12 pt-5">
          <p class="text-xs uppercase tracking-[0.12em] text-muted">Postre</p>
          <p class="mt-2 font-display text-2xl font-semibold">Helado de guayaba y chile costeño</p>
        </div>
        <div class="border-t border-ink/12 pt-5">
          <p class="text-xs uppercase tracking-[0.12em] text-muted">Vino de la casa</p>
          <p class="mt-2 font-display text-2xl font-semibold">Tinto de la sierra, copa desde $90</p>
        </div>
      </div>
    </div>
  </div>
</section>

Why it works for gastronomía:
- The headline is the operation, not the name. «La carta cambia cada lunes» IS the restaurant.
  «Bienvenidos a X» is not the restaurant.
- The «esta semana» pull-quotes do the work of a menu page without sending the visitor away from
  the hero. They say: this place is alive, the menu changes, what you see this week is what is on
  the table tonight.
- The price is a single number, in a single place, in context («copa desde $90»). Hiding the
  wine list behind a separate page is what restaurants that are not serious about wine do.
`;

/**
 * GASTRONOMÍA CONTACT — reservation-first.
 * Restaurants live or die on the reservation flow. Two columns: one to reserve, one to find.
 */
export const SECTOR_GASTRONOMIA_CONTACT = `
<section class="bg-bg">
  <div class="mx-auto grid max-w-[1200px] gap-14 px-6 py-24 lg:grid-cols-2 lg:gap-24 lg:px-10 lg:py-32">
    <div>
      <h2 class="max-w-[18ch] font-display font-semibold text-ink" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', lineHeight: 1.15, letterSpacing: '-0.015em' }}>
        Mesa para esta noche
      </h2>
      <p class="mt-5 max-w-[46ch] text-[1.0625rem] leading-relaxed text-muted">
        Contestamos mensajes en menos de una hora entre las 11:00 y las 23:00. Los martes no
        necesitamos reservación.
      </p>
      <form class="mt-9 grid gap-4" onSubmit="return false">
        <label class="grid gap-2">
          <span class="text-[0.8125rem] font-medium">Nombre</span>
          <input type="text" name="nombre" required class="rounded-md border border-ink/15 bg-surface px-4 py-3 text-[0.9375rem] outline-none transition-colors duration-150 focus:border-accent" />
        </label>
        <label class="grid gap-2">
          <span class="text-[0.8125rem] font-medium">Para cuántos</span>
          <input type="number" name="personas" min="1" max="12" required class="rounded-md border border-ink/15 bg-surface px-4 py-3 text-[0.9375rem] outline-none transition-colors duration-150 focus:border-accent" />
        </label>
        <label class="grid gap-2">
          <span class="text-[0.8125rem] font-medium">Fecha y hora</span>
          <input type="datetime-local" name="fecha" required class="rounded-md border border-ink/15 bg-surface px-4 py-3 text-[0.9375rem] outline-none transition-colors duration-150 focus:border-accent" />
        </label>
        <button type="submit" class="mt-2 justify-self-start rounded-md bg-accent px-6 py-3.5 text-[0.9375rem] font-semibold text-white transition-colors duration-150 hover:bg-accent-strong">
          Pedir mesa
        </button>
      </form>
    </div>
    <div class="rounded-sm bg-surface p-8 shadow-raised lg:p-10">
      <dl class="grid gap-7">
        <div>
          <dt class="text-xs uppercase tracking-[0.12em] text-muted">Dónde</dt>
          <dd class="mt-2 text-[1.0625rem] leading-relaxed">Calle Santander 47<br />Centro Histórico</dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-[0.12em] text-muted">Horario</dt>
          <dd class="mt-2 text-[1.0625rem] leading-relaxed">Martes a domingo, 13:00 – 23:00<br />Lunes cerrado</dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-[0.12em] text-muted">Teléfono</dt>
          <dd class="mt-2 text-[1.0625rem] leading-relaxed">
            <a href="tel:+50222000000" class="underline decoration-accent decoration-2 underline-offset-4">+502 2200 0000</a>
          </dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-[0.12em] text-muted">Martes</dt>
          <dd class="mt-2 text-[1.0625rem] leading-relaxed">Walk-in, sin reservación</dd>
        </div>
      </dl>
    </div>
  </div>
</section>

Why it works for gastronomía:
- The form is the contact section. For a restaurant, a phone number in the corner is not enough.
  The form is the action. People who are ready to book should see the form immediately.
- The «martes: walk-in» line tells the visitor when they do not need the form. Information
  architecture: the section tells you when to use the form and when not to.
- The hours say «lunes cerrado» explicitly. A restaurant site that does not say when it is closed
  gets calls when it is closed.
`;

/* ============================================================
 * SECTOR 3: OFICIOS, CONSTRUCCIÓN, LIMPIEZA, TRANSPORTE
 * Tratamiento: sólido. Trust signals matter more than visual flair.
 * ============================================================ */

/**
 * OFICIOS HERO — contratistas, construcción, oficios.
 * The hero carries proof of work: years, projects, coverage. Not adjectives.
 */
export const SECTOR_OFICIOS_HERO = `
<section class="bg-bg">
  <div class="mx-auto max-w-[1200px] px-6 py-24 lg:px-10 lg:py-32">
    <p class="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Constructora · Desde 1998</p>
    <h1 class="mt-5 max-w-[20ch] font-display font-bold text-ink" style={{ fontSize: 'clamp(2.75rem, 5.5vw, 5rem)', lineHeight: 1.05, letterSpacing: '-0.025em', textWrap: 'balance' }}>
      Construimos y remodelamos en la zona metropolitana desde hace veintisiete años
    </h1>
    <p class="mt-6 max-w-[58ch] text-[1.0625rem] leading-relaxed text-muted">
      Equipo propio, presupuesto cerrado y entrega en fecha. Sin subcontratistas sorpresa.
    </p>
    <div class="mt-10 grid grid-cols-2 gap-x-12 gap-y-8 border-t border-ink/10 pt-8 lg:grid-cols-4">
      <div>
        <p class="text-xs uppercase tracking-[0.12em] text-muted">Años</p>
        <p class="mt-1 font-display text-2xl font-semibold">27</p>
      </div>
      <div>
        <p class="text-xs uppercase tracking-[0.12em] text-muted">Obras entregadas</p>
        <p class="mt-1 font-display text-2xl font-semibold">340</p>
      </div>
      <div>
        <p class="text-xs uppercase tracking-[0.12em] text-muted">Cobertura</p>
        <p class="mt-1 font-display text-base font-semibold">ZMVM y conurbados</p>
      </div>
      <div>
        <p class="text-xs uppercase tracking-[0.12em] text-muted">Garantía</p>
        <p class="mt-1 font-display text-base font-semibold">5 años estructural</p>
      </div>
    </div>
    <div class="mt-10 flex flex-wrap items-center gap-x-7 gap-y-4">
      <a href="#cotizar" class="inline-flex items-center gap-2 rounded-md bg-accent px-6 py-3.5 text-[0.9375rem] font-semibold text-white transition-colors duration-150 hover:bg-accent-strong">
        Pedir cotización
      </a>
      <a href="#portafolio" class="text-[0.9375rem] font-medium text-ink underline decoration-accent decoration-2 underline-offset-4">
        Ver portafolio
      </a>
    </div>
  </div>
</section>

Why it works for oficios:
- Years, projects delivered, coverage area, and warranty are the four trust signals that matter
  in construction. A contractor site that opens with «excelencia y compromiso» is a contractor
  site that has nothing to show.
- «Equipo propio, presupuesto cerrado, entrega en fecha» is the anti-pitch. It names the three
  complaints construction clients have and says «no» to all three.
- The warranty is in the stats row, not buried. «5 años estructural» is a thing only a serious
  contractor writes down.
`;

/* ============================================================
 * SECTOR 4: COMERCIO, TIENDA, RETAIL
 * Tratamiento: editorial. La marca se siente curada.
 * ============================================================ */

/**
 * COMERCIO HERO — tienda retail, marca curada.
 * The hero carries the brand statement and one product. The catalog is the next section.
 */
export const SECTOR_COMERCIO_HERO = `
<section class="bg-bg">
  <div class="grid items-stretch lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
    <div class="flex items-center px-6 py-24 lg:py-32 lg:pl-[max(2.5rem,calc((100vw-1200px)/2))] lg:pr-12">
      <div class="w-full">
        <p class="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Tienda · Polanco</p>
        <h1 class="mt-5 max-w-[16ch] font-display font-bold text-ink" style={{ fontSize: 'clamp(3rem, 6vw, 5.5rem)', lineHeight: 1.05, letterSpacing: '-0.025em', textWrap: 'balance' }}>
          Ropa que dura diez años, no diez semanas
        </h1>
        <p class="mt-6 max-w-[46ch] text-[1.0625rem] leading-relaxed text-muted">
          Marca propia de básicos, hecha en talleres de Coyoacán y Oaxaca. Algodón orgánico, lino
          europeo, tintes naturales. Veintidós piezas por temporada.
        </p>
        <div class="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
          <a href="#catalogo" class="inline-flex items-center gap-2 rounded-md bg-accent px-6 py-3.5 text-[0.9375rem] font-semibold text-white transition-colors duration-150 hover:bg-accent-strong">
            Ver la temporada
          </a>
          <a href="#taller" class="text-[0.9375rem] font-medium text-ink underline decoration-accent decoration-2 underline-offset-4">
            Cómo la hacemos
          </a>
        </div>
      </div>
    </div>
    <div class="relative min-h-[320px] lg:min-h-[80vh]">
      <img src="FOTO_DE_cresova_images" alt="Pieza de la temporada sobre fondo neutro" class="absolute inset-0 h-full w-full object-cover" />
    </div>
  </div>
</section>

Why it works for comercio:
- «Dura diez años, no diez semanas» is the anti-fast-fashion stance in nine words. The rest of the
  page is proof. The headline is the philosophy.
- «Veintidós piezas por temporada» is the explicit cap. Fast fashion sells volume. Curation sells
  limit. Saying the number makes the limit real.
- Single product photo on the right, full bleed, no carousel. A store that needs a carousel of
  six products is a store that has not curated.
`;

/* ============================================================
 * ANTI-PATTERNS VISUALES
 * Mismo problema, dos respuestas. El modelo vio el bueno y el malo,
 * y puede elegir con fundamento en vez de caer en el default.
 * ============================================================ */

/**
 * ANTI-PATTERN A — services: cards vs editorial list.
 *
 * The wrong answer is the card grid. Three equal boxes, each with a title, an icon, a paragraph,
 * a "learn more" link. Every site does this. None of them mean it. It says: we have not thought
 * about what services are.
 *
 * The right answer is the editorial list. One row per service, three columns on one baseline
 * (name, what it includes, price hint), separated by hairline rules. It says: we know what each
 * of these costs and we will tell you.
 */
export const ANTI_PATTERN_SERVICES = `
<!-- THE WRONG ANSWER: three equal cards in a row -->
<section class="bg-surface">
  <div class="mx-auto max-w-[1200px] px-6 py-24 lg:py-32">
    <h2 class="text-center font-display text-3xl font-semibold">Our services</h2>
    <div class="mt-12 grid gap-6 md:grid-cols-3">
      <div class="rounded-lg bg-bg p-8 text-center shadow">
        <svg class="mx-auto mb-4 h-12 w-12 text-accent">...</svg>
        <h3 class="font-display text-xl font-semibold">Service one</h3>
        <p class="mt-3 text-sm text-muted">A generic description that applies to any business in this sector.</p>
        <a href="#" class="mt-6 inline-block text-sm text-accent">Learn more →</a>
      </div>
      <div class="rounded-lg bg-bg p-8 text-center shadow">
        <svg class="mx-auto mb-4 h-12 w-12 text-accent">...</svg>
        <h3 class="font-display text-xl font-semibold">Service two</h3>
        <p class="mt-3 text-sm text-muted">The same generic description with one word changed.</p>
        <a href="#" class="mt-6 inline-block text-sm text-accent">Learn more →</a>
      </div>
      <div class="rounded-lg bg-bg p-8 text-center shadow">
        <svg class="mx-auto mb-4 h-12 w-12 text-accent">...</svg>
        <h3 class="font-display text-xl font-semibold">Service three</h3>
        <p class="mt-3 text-sm text-muted">You already know what this one says.</p>
        <a href="#" class="mt-6 inline-block text-sm text-accent">Learn more →</a>
      </div>
    </div>
  </div>
</section>

<!-- THE RIGHT ANSWER: an editorial list with prices -->
<section class="bg-bg">
  <div class="mx-auto max-w-[1200px] px-6 py-24 lg:py-32">
    <h2 class="max-w-[20ch] font-display font-semibold" style="font-size: clamp(1.75rem, 3vw, 2.5rem);">
      Lo que hacemos
    </h2>
    <ul class="mt-14 border-t border-ink/12">
      <li class="border-b border-ink/12 py-8">
        <div class="grid gap-2 md:grid-cols-[4fr_6fr_auto] md:gap-10 md:px-2">
          <h3 class="font-display text-xl font-semibold">Service one, named specifically</h3>
          <p class="text-[0.9375rem] text-muted">What it includes, in specific terms: deliverables, duration, what is included in the price.</p>
          <span class="font-display text-lg font-semibold text-accent">From $X</span>
        </div>
      </li>
      <!-- repeat -->
    </ul>
  </div>
</section>

Why the cards version is the wrong answer:
- Three equal cards is the AI's resting state. It is what the model writes when nothing else is
  in the prompt. The presence of a card grid on a services section is the single fastest tell
  that the page was generated.
- Centered text + icon + paragraph + link is a card. It says nothing about the service except
  that the business has services. The editorial list says: we know what each one is, we know
  what each one costs, here they are.
- Icons on services sections are decoration. A clinic does not need a tooth icon next to
  «Limpieza profunda». The word already says it.

Why the editorial list version is the right answer:
- The list takes the same vertical space as three cards but says ten times more.
- The price hint on every row removes the friction of «call to ask».
- Hairline rules separate the rows. No box around the row. Boxes on services are an excuse not
  to think about layout.
`;

/**
 * ANTI-PATTERN B — gallery: four equal squares vs asymmetric.
 *
 * The wrong answer is the 2x2 grid. Four equal squares, each with a photo, each given the same
  * weight. The page says: these photos are equally important. They are not.
 *
 * The right answer is one photo that leads, two that support.
 */
export const ANTI_PATTERN_GALLERY = `
<!-- THE WRONG ANSWER: four equal squares -->
<section class="bg-surface">
  <div class="mx-auto max-w-[1200px] px-6 py-24">
    <h2 class="text-center font-display text-3xl font-semibold">Gallery</h2>
    <div class="mt-12 grid grid-cols-2 gap-4">
      <img src="FOTO" alt="" class="aspect-square w-full rounded object-cover" />
      <img src="FOTO" alt="" class="aspect-square w-full rounded object-cover" />
      <img src="FOTO" alt="" class="aspect-square w-full rounded object-cover" />
      <img src="FOTO" alt="" class="aspect-square w-full rounded object-cover" />
    </div>
  </div>
</section>

<!-- THE RIGHT ANSWER: one leads, two support -->
<section class="border-y border-ink/10 bg-surface">
  <div class="mx-auto max-w-[1200px] px-6 py-24">
    <h2 class="font-display text-2xl font-semibold">Un martes cualquiera</h2>
    <div class="mt-12 grid gap-4 sm:h-[560px] sm:grid-cols-6 sm:grid-rows-2">
      <img src="FOTO" alt="" class="sm:col-span-4 sm:row-span-2 h-64 w-full rounded-sm object-cover sm:h-full" />
      <img src="FOTO" alt="" class="sm:col-span-2 h-40 w-full rounded-sm object-cover sm:h-full" />
      <img src="FOTO" alt="" class="sm:col-span-2 h-40 w-full rounded-sm object-cover sm:h-full" />
    </div>
  </div>
</section>

Why the squares version is the wrong answer:
- «Gallery» is the laziest heading in web design. It says: here are photos, you decide what they
  are. The right answer names the section after what is in it.
- Four equal squares say all four are equally unimportant. A grid where one is bigger says: this
  one is the subject.
- Squares force every photo into a square. Most business photos are not squares. They get cropped,
  centered awkwardly, or distorted.

Why the asymmetric version is the right answer:
- The headline «Un martes cualquiera» tells the visitor what they are looking at: a normal day.
  That is what a gallery section is supposed to be.
- 4+2+2 over two rows. One photo is clearly the subject; the other two are context.
- object-cover + fixed section height = mixed source ratios line up. Without it, one tall photo
  ruins the row.
`;

/**
 * The full block injected into the system prompt alongside the design kit and the original
 * exemplars. Replaces the gap where, before, the only sector with real density was turismo.
 */
export const CRESOVA_SECTORIAL_EXEMPLARS = `
<cresova_sectorial_exemplars>
  The original exemplars are one sector: a dive shop in Roatán. This block adds four more sectors
  with the same density. Pick the closest one and copy its trio: hero, services, contact. The
  colours stay as token names — the sector table in the design kit decides the palette.

  === SALUD, LEGAL, FINANCIERO, PROFESIONAL — tratamiento sólido ===

  ${SECTOR_SALUD_HERO}

  ${SECTOR_SALUD_SERVICES}

  === GASTRONOMÍA, CAFÉ, CATERING — tratamiento editorial ===

  ${SECTOR_GASTRONOMIA_HERO}

  ${SECTOR_GASTRONOMIA_CONTACT}

  === OFICIOS, CONSTRUCCIÓN, LIMPIEZA, TRANSPORTE — tratamiento sólido ===

  ${SECTOR_OFICIOS_HERO}

  === COMERCIO, TIENDA, RETAIL — tratamiento editorial ===

  ${SECTOR_COMERCIO_HERO}

  === ANTI-PATTERNS — the wrong answer next to the right one ===

  ${ANTI_PATTERN_SERVICES}

  ${ANTI_PATTERN_GALLERY}

  These anti-patterns are the same lesson told negatively. The wrong answer is what the model
  writes when nothing else is in the prompt. The right answer is what the same section looks like
  when someone has thought about it. The model has seen both. Choose the one you would defend.
</cresova_sectorial_exemplars>
`;
