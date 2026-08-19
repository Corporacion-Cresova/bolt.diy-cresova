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

  TYPE PAIRINGS (Google Fonts, pick one, never Inter + Playfair Display):
  - Sober / corporate: Instrument Sans (display) + Public Sans (body)
  - Warm / local trade: Bricolage Grotesque (display) + Karla (body)
  - Editorial / premium: Fraunces (display) + Work Sans (body)
  - Technical / clean: Archivo (display) + Source Sans 3 (body)

  TOKENS (define once as CSS custom properties or Tailwind theme values, then never hardcode):
  - Spacing scale: 4 8 12 16 24 32 48 64 96 128 160
  - Radii: 0 for bands and images, 6px for inputs and buttons, 12px only for elevated panels.
    Do not round everything to the same value.
  - Elevation: at most two shadows in the whole page, both soft and low-opacity. No glow.
  - Container: 1200px max, 24px gutter mobile, 40px desktop.

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
  and an object-cover fit so it never stretches. A section with no suitable photo is better solid
  than filled with an unrelated one.

  FLOATING WHATSAPP: fixed bottom-right, 56px, accent background, lucide MessageCircle icon,
  aria-label in the page language, href https://wa.me/NUMERO.
</cresova_design_kit>
`;
