/**
 * Concrete design kit injected only when the user is asking for a new site.
 *
 * Rules alone ("make it beautiful", "avoid generic layouts") barely move a small model: it falls
 * back on its priors, which are exactly the generated-looking patterns we want to avoid. What does
 * move it is a closed set of concrete choices to pick from — named fonts, numeric tokens, section
 * shapes. This block is the menu.
 *
 * It is deliberately not injected on follow-up edits: by then the choices already live in the code,
 * and re-sending the kit only costs tokens.
 */
export const CRESOVA_DESIGN_KIT = `
<cresova_design_kit>
  Pick from these instead of inventing defaults. Choosing one combination and applying it
  consistently beats mixing.

  === STEP 1: DECIDE, THEN BUILD ===

  A design is a set of decisions made before the code and applied consistently. Skip the deciding
  and what comes out is the average of your instincts, which is exactly what a generated page looks
  like. So OPEN YOUR ANSWER with these five lines, filled in from the sector table below, and then
  derive every colour, size and spacing in every file from them:

  Paleta: <sector> — bg / surface / ink / muted / accent / accent-strong
  Tipografía: <display> + <body>
  Tratamiento: editorial | sólido
  Concepto: <the layout idea in one sentence>
  Apuesta: <the one thing this page does that a template would not>

  Five lines, before the first file. They are also what the user reads while the site is being
  built, so write them for a person.

  THEN, still before the first file, LIST THE SECTIONS with their real titles.

  One line per section: the shape from the list below, the headline it will carry, and in three or
  four words what goes in it. Eight to fourteen lines. Real Spanish, the business's own words, the
  actual product and service names — not «sección de servicios» but «Todo lo que tu moto necesita —
  kit de transmisión, pastillas, aceite, con precio».

  This step is the difference, and it is worth understanding why. The best pages this agency has
  shipped were built from briefs that named every section and its copy in advance; the model was
  laying out decisions someone had already made. Rules about palettes and spacing a model follows
  well. Deciding what a Honduran motorcycle workshop should actually say on its fourth section is
  what it does badly when it improvises mid-file, and that is where «generic» comes from — not from
  the colours. Deciding it up front, in one list, costs a few lines and changes the whole page.

  If the user's own request already names sections and copy, that list IS the brief: follow it, do
  not replace it with your own.

  === THESE ARE FRONTEND-ONLY DEMOS ===

  Unless the user explicitly asks for a backend, everything is frontend: local arrays, React state,
  localStorage at most. No Supabase, no database, no auth, no API, no payment gateway. These pages
  are built to be shown to a client who has not bought anything yet, and a demo that needs a
  service to be provisioned before it renders is a demo that cannot be shown.

  A catalogue is an array. A filter is a useState. A contact form opens WhatsApp with the message
  pre-written. An admin panel edits local state and says so.

  === STEP 2: THE SECTOR TABLE ===

  Find the closest sector and take its whole row. The palettes are designed as sets and their
  contrast is verified: do not mix rows and do not invent colours.

  Every row has a LIGHT and a DARK ground. Both were measured on sites this agency shipped and a
  client approved; neither is a fallback for the other.

  | Sector | Ground | bg | surface | ink | muted | accent | accent-strong | Type | Display weight |
  |---|---|---|---|---|---|---|---|---|---|
  | Turismo, aventura, hotelería | light | #F7F5F0 | #FFFFFF | #14322C | #5B6F69 | #0E6E62 | #0A4F46 | Bricolage Grotesque + Karla | 600 |
  | Turismo, aventura, hotelería | dark | #0F1A17 | #16241F | #EDF2EF | #93A8A1 | #35B79C | #7FD9C4 | Fraunces + Plus Jakarta Sans | 600 |
  | Gastronomía, café, catering | light | #FAF7F2 | #FFFFFF | #2A2118 | #6B5D4D | #7A2E2E | #5A1F1F | DM Serif Display + DM Sans | 600 |
  | Belleza, bienestar, suplementos | light | #F8F7F5 | #FFFFFF | #1E2622 | #5F6B64 | #2F6B54 | #22503F | Cormorant Garamond + Karla | 300 |
  | Belleza, bienestar, joyería, perfumería | dark | #121212 | #1C1A19 | #F5F1EA | #A9A198 | #C9A227 | #E4C25C | Cormorant Garamond + Manrope | 300 |
  | Comercio, tienda, retail | light | #FAF8F4 | #FFFFFF | #241D14 | #6B6052 | #A4560A | #7C4008 | Fraunces + Work Sans | 600 |
  | Oficios, construcción, limpieza, transporte | light | #F5F6F8 | #FFFFFF | #161D26 | #566270 | #2C5578 | #1E3C56 | Archivo + Source Sans 3 | 700 |
  | Taller, motos, automotriz, deporte | dark | #141416 | #1E1E22 | #F4F2EF | #9B9BA3 | #E11D2E | #B3121F | Barlow Condensed + Barlow | 800 |
  | Salud, legal, financiero, profesional | light | #F7F7F5 | #FFFFFF | #14192B | #565E75 | #1E3A6E | #14284D | Instrument Sans + Public Sans | 600 |

  WHICH GROUND. Dark is not the daring choice and light is not the safe one; they say different
  things. Dark reads as craft, power and night trade — a workshop, a tattoo studio, a gym, a bar,
  jewellery. Light reads as air, hygiene and daylight — a clinic, a hotel, a bakery, a lawyer. Pick
  the one the business actually is; if the client's own signage, uniforms or storefront are dark,
  that decides it.

  Display weight is part of the row and it is NOT always bold. 300 at 9rem is what makes a jewellery
  or a beauty page read as expensive; 800 condensed is what makes a workshop read as strong. Using
  600 everywhere is how both of them end up looking like the same page.

  If the client already has brand colours, use theirs and keep the row's structure: their brand
  colour becomes the accent, and you derive accent-strong by darkening it.

  TREATMENT:
  - **editorial**: take one real visual risk and keep everything around it quiet. An asymmetric
    hero, a headline that breaks across an image, a section with an inverted ground. One. Not three.
  - **sólido**: impeccable composition, clear hierarchy, no risks. This is the right answer for a
    lawyer or a clinic, and it is never an excuse for timid type or even padding.

  Two sites in the same sector share a palette. Vary the COMPOSITION and the apuesta, never the
  colours: that is what keeps them siblings instead of copies.

  === STEP 3: EVERYTHING ELSE ===

  TYPE PAIRINGS. Naming the family in CSS is only half of it: a family that is not loaded falls
  straight through to the system font, and the page then looks like every other unstyled page no
  matter how good the rest of the design is. That happened, to every site, for a long time.

  So COPY the matching <link> into index.html, in <head>, verbatim. Do not compose the URL yourself
  and do not change the weights: these six are verified to resolve. Never Inter + Playfair Display.

  - Sober / corporate: Instrument Sans (display) + Public Sans (body)
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Public+Sans:wght@400;500;600&display=swap" rel="stylesheet">

  - Warm / local trade: Bricolage Grotesque (display) + Karla (body)
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;700&family=Karla:wght@400;500;600&display=swap" rel="stylesheet">

  - Editorial / premium: Fraunces (display) + Work Sans (body)
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600;700&family=Work+Sans:wght@400;500;600&display=swap" rel="stylesheet">

  - Technical / clean: Archivo (display) + Source Sans 3 (body)
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Source+Sans+3:wght@400;500;600&display=swap" rel="stylesheet">

  - Soft / elegant: Cormorant Garamond (display) + Karla (body)
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Karla:wght@400;500;600&display=swap" rel="stylesheet">

  - Warm / appetite: DM Serif Display (display) + DM Sans (body)
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">

  TOKENS. Every worked example below writes \`bg-surface\`, \`text-ink\`, \`border-ink/10\`,
  \`text-accent\`. Those class names only exist if you PUT THEM IN \`tailwind.config.js\` in this
  same response. Defining the palette as CSS custom properties instead does not make them exist:
  PostCSS then fails with «The \`border-ink/10\` class does not exist», the stylesheet does not
  compile, and the dev server serves a blank page while looking perfectly healthy. That has already
  happened to a finished site. And the opacity suffixes (\`/10\`, \`/15\`) only work on a colour
  that lives in this config, which is the other half of the same trap.

  FIRST, CHECK WHETHER THE PROJECT ALREADY HAS A \`tailwind.config.js\`. The Cresova Base template
  ships one, and it declares more than colours: \`text-hero\`, \`text-section\`, \`font-display\`,
  \`font-heading\`, \`max-w-measure\`, \`rounded-control\`, \`shadow-raised\`. Its components use those
  classes. Replacing that file with a colours-only config deletes every one of them, and the page
  fails to compile in exactly the way this section is warning you about — with the difference that
  this time you caused it.

  SO: WHEN THE FILE ALREADY EXISTS, DO NOT REWRITE IT. Set the palette in \`src/index.css\`, which is
  where that config reads its colours from: paste your sector's six values into \`:root\` and delete
  the other rows. That is the whole palette change — six lines, one file.

  ONLY WHEN THERE IS NO CONFIG YET, write this one. Not a shorter one: every token below is used by
  the worked examples further down, and a class that is not declared here does not exist.

  // tailwind.config.js
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
        fontWeight: { heading: 'var(--weight-display)' },
        fontSize: {
          hero: ['clamp(3rem, 9vw, 10rem)', { lineHeight: '0.98', letterSpacing: '-0.025em' }],
          display: ['clamp(4.5rem, 12vw, 9rem)', { lineHeight: '1', letterSpacing: '-0.03em' }],
          section: ['clamp(1.75rem, 3vw, 2.5rem)', { lineHeight: '1.15', letterSpacing: '-0.015em' }],
          body: ['1.0625rem', { lineHeight: '1.6' }],
        },
        maxWidth: { container: '1200px', measure: '65ch' },
        borderRadius: { control: '6px', panel: '12px' },
        boxShadow: { raised: '0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px rgb(0 0 0 / 0.06)' },
      },
    },
  };

  Then define the six values in \`src/index.css\`, as RGB triplets so \`<alpha-value>\` works:

  :root {
    --bg: 247 245 240;
    --surface: 255 255 255;
    --ink: 20 50 44;
    --muted: 91 111 105;
    --accent: 14 110 98;
    --accent-strong: 10 79 70;
    --font-display: 'Bricolage Grotesque';
    --font-body: 'Karla';
    --weight-display: 600;
  }

  The rest of the tokens (define once, then never hardcode):
  - Spacing scale: 4 8 12 16 24 32 48 64 96 128 160
  - Radii: 0 for bands and images, 6px for inputs and buttons, 12px only for elevated panels.
    Do not round everything to the same value.
  - Elevation: at most two shadows in the whole page, both soft and low-opacity. No glow.
  - Container: 1200px max, 24px gutter mobile, 40px desktop.

  TYPE SCALE (the single biggest tell of a generated page is timid type — type that fits):
  - Hero headline: clamp(3rem, 9vw, 10rem), line-height 0.95–1.05, tracking -0.025em, and the
    display weight of your sector row — which is 300 for jewellery and 800 for a workshop, not 600
    for everything.
    The old ceiling here was 6.5rem, and it was set by taste rather than by evidence. Six sites this
    agency shipped and clients approved were measured: their hero headlines render at 96, 120, 144,
    152 and 160 CSS pixels. Three of the six break past what this file used to allow. 10rem is the
    new ceiling and it is a ceiling, not a target: a long headline at 160px is a wall, a three word
    one at 160px is a poster. Set it against the words you actually have.
  - Display number (statistic, year, single count): clamp(4.5rem, 12vw, 9rem), tracking -0.03em.
    One per page. This is the moment a number feels big.
  - Section heading: clamp(1.75rem, 3vw, 2.5rem), line-height 1.15.
  - Body: 1.0625rem, line-height 1.6. Small print: 0.875rem.
  - Never more than two weights of the display face on one page.
  - Body text gets a measure of 60-75 characters (max-w-[65ch]). Full-width paragraphs read as
    unfinished no matter how good the rest is.

  VERTICAL RHYTHM:
  - Sections breathe: 96px of padding on mobile, 128-160px on desktop. Cramped, evenly padded
    sections are what make a page look like a template.
  - Vary it: the hero and the closing call to action get more room than a trust strip.

  DEPTH AND RHYTHM (this is what «flat» actually means, and it is the easiest thing to fix):
  - Sections ALTERNATE their ground: bg, then surface, then bg, then a 6% tint of the accent. Never
    four sections running on the same colour. A whole page on one white is flat however good the
    type is — this rule alone changes more than any other here.
  - Exactly three levels: bg (the page), surface (cards, panels), raised (one soft shadow). Nothing
    else gets a shadow.
  - Spend the boldness in ONE place. If the accent fights the ground, drop its saturation rather
    than swapping it for another colour.
  - The accent is for actions and one or two emphases per screen. An accent everywhere reads as
    loud, not as designed.

  MOTION (a closed repertoire — do not invent more, and wrap all of it in
  @media (prefers-reduced-motion: reduce) so it can be turned off):
  - Card on hover: translateY(-2px) plus the raised shadow, 150ms ease-out.
  - Link on hover: underline growing from the left, 150ms.
  - Button on hover: colour to accent-strong. No scaling, no glow.
  - ONE reveal on scroll, in the hero. Not on every section.
  - Keyboard focus always visible: a 2px accent outline with 2px of offset. Never outline:none.

  SECTION SHAPES (use 8-14 of these, each one only once, in roughly this order):

  Eight is the floor, not the target. The same six measured sites carry 11 to 18 sections and run
  7.500 to 18.000 pixels tall. A six section page is the one thing a client reads instantly as «this
  is a demo»; the shapes below exist so that length is composed rather than padded.
  - Hero: 60/40 split, headline + subhead + one primary action + one secondary link, photo bleeding
    to the right edge. Not centered, not a background image with text on top.
  - Trust strip: thin band with 3-4 concrete facts (years, coverage, response time, certification).
  - Services: an editorial list separated by hairline rules, each item with a name, one sentence of
    what it includes and a price hint. Cards are the fallback, not the default.
  - Process: 3-4 numbered steps, horizontal on desktop. Numbering only when order truly matters.
  - Gallery: asymmetric grid of real photos from <cresova_images>, never four equal squares.
  - Testimonials: one large quote with attribution, or two side by side. Never a carousel.
  - Contact: two columns, form or WhatsApp action on one side, hours and service area on the other.
  - Footer: business data, navigation, legal line.

  And these, which the measured sites all use and this list was missing. They are what takes a page
  from six sections to twelve without padding it:
  - Sticky header: transparent over the hero, solid with a backdrop blur once the page scrolls.
  - Category triptych: three full-bleed photographs with a title over each, one per line of business.
    Not three cards.
  - Catalogue: 6-12 real items with photo, name, category and price, plus filter buttons that
    actually filter. This is the section that convinces a shop owner, and it is the one most often
    left out.
  - Quick view: clicking an item opens a modal with the large photo, the price and a WhatsApp
    action. No routing, no backend.
  - Marquee band: a single line of 4-6 words that name what the business sells on, scrolling
    slowly across an accent ground. One per page, and only when the words are real.
  - Editorial band: one full width photograph with a sentence over it, at a different rhythm from
    everything around it. This is where a page earns the word «premium».
  - Collections: 3-4 large campaign blocks («para regalar», «nuevas historias»), photo-led.
  - Numbered process at full width: the same 3-4 steps as above but as a band, on an inverted
    ground, when the process is the selling point.
  - Social grid: an Instagram-style grid of lifestyle photos with a hover treatment.
  - Closing call to action: the headline at display size on an inverted ground, one action, nothing
    else. The last thing before the footer.
  - Demo admin panel at /admin: a sidebar, a table of the catalogue with edit and delete, a modal to
    add an item, and counters — all on local state, no login, no database. This is a sales device:
    it shows the client how they would run the site. Add it when the business has a catalogue.

  IMAGE WEIGHT: every photo below the fold gets loading="lazy". The catalog serves photos around
  600KB each, and a page that ships four megabytes of them is unusable on the mobile data most of
  these clients browse on — the hero is the only image worth loading eagerly.

  IMAGE PLACEMENT: the hero photo carries the page, so give it real height (min 70vh on desktop)
  and an object-cover fit so it never stretches. Use a photo from <cresova_images> in the hero and
  in at least two more sections: a page with one lonely image looks unfinished. A section with no
  suitable photo is better solid than filled with an unrelated one.

  ICONS: only these lucide-react names, they are guaranteed to exist. Importing an icon that does
  not exist breaks the build, and invented names like Crane or Tow are the usual cause:
  Phone, Mail, MapPin, Clock, MessageCircle, Star, Check, CheckCircle2, ArrowRight, ArrowUpRight,
  ChevronRight, ChevronDown, Menu, X, Shield, ShieldCheck, Award, Truck, Wrench, Hammer, Sparkles,
  Droplets, Zap, Users, ThumbsUp, Calendar, CreditCard, Quote, Instagram, Facebook, Send, Home,
  Building2, Car, Heart, Leaf, Lock, Search, Settings, Trash2, Timer, TrendingUp.
  If none fits, use a plain shape or text instead of guessing a name.

  NEVER (these are the tells, each one alone gives the page away):
  - Emoji standing in for icons.
  - Gradient text, or the purple-to-blue gradient of every AI landing page.
  - Everything centered. Centre the hero or the headings, not both and not the whole page.
  - Three equal cards in a row as the answer to every section.
  - Placeholder copy. Write real, specific Spanish copy for this business and this sector, with
    concrete numbers, real service names and a real service area. "Lorem ipsum", "Your Company"
    or "Servicio 1" are worse than an empty section.
  - Inventing another country. These are Honduran businesses: unless the client says otherwise,
    prices are lempiras (L 1,250), phones are +504 with eight digits, and the cities are
    Tegucigalpa, San Pedro Sula, La Ceiba, Comayagua, Choluteca, Roatán. A page that quotes pesos
    and lists Guadalajara and Monterrey is not a page this client can show anyone, however good
    the rest of it looks — and it is the default a model falls into when nobody says where it is.
  - Reaching for the same radius and the same shadow because it is the first one you wrote. Decide
    them; then a page that uses ONE radius and no shadow at all is a decision, and a good one for
    anything elegant — two of the measured sites do exactly that.

  And the looks that read as «made by an AI» at a glance. These are not ugly; they are worn out,
  which is worse, because the client has seen them on every generated page this year:
  - Inter or Space Grotesk as the «safe» typeface.
  - The purple-to-blue gradient hero of every AI landing page.
  - Emoji as section markers, numbered 01 / 02 / 03 on things that are not a sequence.
  - rounded-lg on absolutely everything, an accent rail down the side of every rounded card.

  Two looks used to be on that list and have been taken off, because this agency ships both and
  clients buy them. What made them tells was the execution, not the palette:
  - A near-black ground with a red or vermilion accent is one of the strongest pages here — a motor
    workshop, condensed type at 144px in weight 800, the red used on maybe six elements in the whole
    page. It reads as generated only when the accent is sprayed everywhere and the type is timid.
  - A warm cream ground with a serif display is the jewellery and perfumery page — Cormorant at
    152px in weight 300, enormous negative space, gold on almost nothing. Same rule: what gives it
    away is a small serif crowded by cards, not the combination itself.
  So: use either, and spend the difference on the type size, the air and the restraint of the accent.

  The exception that matters: if the client asks for one of these, do it. Their words win.

  FLOATING WHATSAPP: fixed bottom-right, 56px, accent background, lucide MessageCircle icon,
  aria-label in the page language, href https://wa.me/NUMERO.

  BEFORE YOU FINISH, read the page as the client will: section by section, asking of each one
  whether it feels generic, empty, too simple or repetitive. If any does, improve it before
  finishing rather than shipping it and explaining it. The bar is that the client says «wow» at the
  first screen, and that no section afterwards lets that down.

  Then check these against the files you just wrote. Everything above that is a number
  gets followed reliably; these are the ones that get lost in the prose, and each one is visible at a
  glance in the finished page:
  - The font <link> is in index.html. Without it the whole type section above did nothing.
  - Long text has a reading measure (max-w-[65ch] or similar). Paragraphs running the full container
    width are the fastest way to look unfinished.
  - The hero photo has real height (min-h-[70vh]) and object-cover.
  - At least three photos from <cresova_images> are used, the hero among them.
  - More than one radius and more than one section padding across the page. Everything identical is
    the tell that gives a template away.
  - The five decision lines you opened with are what the code actually does.
  - The sections do not all share one ground.
  - There is a visible keyboard focus state, and the motion sits inside prefers-reduced-motion.
</cresova_design_kit>
`;
