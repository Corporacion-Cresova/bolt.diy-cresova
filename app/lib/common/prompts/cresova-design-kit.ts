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

  TYPE PAIRINGS. Pick one, never Inter + Playfair Display. Naming the family in CSS is only half of
  it: a family that is not loaded falls straight through to the system font, and the page then looks
  like every other unstyled page no matter how good the rest of the design is. That happened, to
  every site, for a long time.

  So COPY the matching <link> into index.html, in <head>, verbatim. Do not compose the URL yourself
  and do not change the weights: these four are verified to resolve.

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

  TOKENS (define once as CSS custom properties or Tailwind theme values, then never hardcode):
  - Spacing scale: 4 8 12 16 24 32 48 64 96 128 160
  - Radii: 0 for bands and images, 6px for inputs and buttons, 12px only for elevated panels.
    Do not round everything to the same value.
  - Elevation: at most two shadows in the whole page, both soft and low-opacity. No glow.
  - Container: 1200px max, 24px gutter mobile, 40px desktop.

  TYPE SCALE (the single biggest tell of a generated page is timid type):
  - Hero headline: clamp(2.5rem, 5vw, 4.5rem), line-height 1.05, tracking -0.02em, weight 600-700.
  - Section heading: clamp(1.75rem, 3vw, 2.5rem), line-height 1.15.
  - Body: 1.0625rem, line-height 1.6. Small print: 0.875rem.
  - Never more than two weights of the display face on one page.
  - Body text gets a measure of 60-75 characters (max-w-[65ch]). Full-width paragraphs read as
    unfinished no matter how good the rest is.

  VERTICAL RHYTHM:
  - Sections breathe: 96px of padding on mobile, 128-160px on desktop. Cramped, evenly padded
    sections are what make a page look like a template.
  - Vary it: the hero and the closing call to action get more room than a trust strip.

  PALETTE RECIPE:
  - One accent chosen for the sector (cleaning: deep teal or fresh blue-green; legal: navy or
    burgundy; food: warm terracotta or olive; trades: safety orange or slate blue).
  - Neutrals mixed with 3-6% of the accent hue so the greys feel chosen.
  - One darker shade of the accent for hover, one very light tint for section backgrounds.

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
</cresova_design_kit>
`;
