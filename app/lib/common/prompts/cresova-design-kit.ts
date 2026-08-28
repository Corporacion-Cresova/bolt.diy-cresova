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

  === STEP 2: THE SECTOR TABLE ===

  Find the closest sector and take its whole row. The palettes are designed as sets and their
  contrast is verified: do not mix rows and do not invent colours.

  | Sector | bg | surface | ink | muted | accent | accent-strong | Type | Treatment |
  |---|---|---|---|---|---|---|---|---|
  | Turismo, aventura, hotelería | #F7F5F0 | #FFFFFF | #14322C | #5B6F69 | #0E6E62 | #0A4F46 | Bricolage Grotesque + Karla | editorial |
  | Gastronomía, café, catering | #FAF7F2 | #FFFFFF | #2A2118 | #6B5D4D | #7A2E2E | #5A1F1F | DM Serif Display + DM Sans | editorial |
  | Belleza, bienestar, suplementos | #F8F7F5 | #FFFFFF | #1E2622 | #5F6B64 | #2F6B54 | #22503F | Cormorant Garamond + Karla | editorial |
  | Comercio, tienda, retail | #FAF8F4 | #FFFFFF | #241D14 | #6B6052 | #A4560A | #7C4008 | Fraunces + Work Sans | editorial |
  | Oficios, construcción, limpieza, transporte | #F5F6F8 | #FFFFFF | #161D26 | #566270 | #2C5578 | #1E3C56 | Archivo + Source Sans 3 | sólido |
  | Salud, legal, financiero, profesional | #F7F7F5 | #FFFFFF | #14192B | #565E75 | #1E3A6E | #14284D | Instrument Sans + Public Sans | sólido |

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

  TOKENS (define once as CSS custom properties or Tailwind theme values, then never hardcode):
  - Spacing scale: 4 8 12 16 24 32 48 64 96 128 160
  - Radii: 0 for bands and images, 6px for inputs and buttons, 12px only for elevated panels.
    Do not round everything to the same value.
  - Elevation: at most two shadows in the whole page, both soft and low-opacity. No glow.
  - Container: 1200px max, 24px gutter mobile, 40px desktop.

  TYPE SCALE (the single biggest tell of a generated page is timid type — type that fits):
  - Hero headline: clamp(2.75rem, 7vw, 6.5rem), line-height 1.0–1.05, tracking -0.025em, weight 600-700.
    This is a CEILING, not a floor. The Ciao Energy, MONOLOG and PP Neue Montreal sites all break
    past 6rem on the headline. The old ceiling was 4.5rem and pages looked timid by comparison;
    6.5rem is the new bottom of «editorial». If the section can hold more, hold more.
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

  SECTION SHAPES (use 4-6 of these, each one only once, in this order):
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
  - The same radius, the same shadow and the same padding on every single element.

  And the looks that currently read as «made by an AI» at a glance. These are not ugly; they are
  worn out, which is worse, because the client has seen them on every generated page this year:
  - Warm cream ground with a serif display and a terracotta accent.
  - Near-black ground with a single acid-green or vermilion pop.
  - Inter or Space Grotesk as the «safe» typeface.
  - Emoji as section markers, numbered 01 / 02 / 03 on things that are not a sequence.
  - rounded-lg on absolutely everything.
  - An accent bar or rail down the side of a rounded card.
  The exception that matters: if the client asks for one of these, do it. Their words win.

  FLOATING WHATSAPP: fixed bottom-right, 56px, accent background, lucide MessageCircle icon,
  aria-label in the page language, href https://wa.me/NUMERO.

  BEFORE YOU FINISH, check these against the files you just wrote. Everything above that is a number
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
