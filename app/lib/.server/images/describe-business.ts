import { stripMessageMetadata } from '~/lib/cresova/build-intent';

/**
 * Turns the message that asked for a site into something an image model can photograph.
 *
 * This exists because of what Flux was actually being sent. The brief for the hero was built by
 * pasting the user's message in whole, so the subject of the photograph came out as:
 *
 *   «Editorial hero photograph showing the business described as: Crea una página web para
 *    El Zorzal Express, una empresa de mensajería…»
 *
 * An image model has no notion that "crea una página web para" is the frame and the rest is the
 * subject. It photographs the sentence it is given, and that sentence was a software request. The
 * words "página web" were reaching an image generator.
 *
 * So the framing comes off first, and what is left — the business, what it does, where it is — is
 * the subject.
 */

/*
 * The pieces a build request is built out of, in both languages.
 *
 * Verbs are matched by stem so conjugations come along ("haz", "hazme", "hagas", "hacer"), which
 * is also why the two patterns below both demand something specific after the verb. On its own,
 * a stem like `ha[zgc]` would eat the first word of "Hacienda San Lucas, hotel de montaña" — a
 * real name for a real hotel, and exactly the kind of thing this must never damage.
 */
const VERB =
  '(?:cre[a-zñáéíóú]*|constru[a-zñáéíóú]*|desarroll[a-zñáéíóú]*|dise[ñn][a-zñáéíóú]*|ha[zgc][a-zñáéíóú]*|gener[a-zñáéíóú]*|arm[a-zñáéíóú]*|maquet[a-zñáéíóú]*|implement[a-zñáéíóú]*|create|build|make|develop|design|generate)';

const LEAD_IN =
  '(?:\\s*(?:por\\s+favor,?)?\\s*(?:necesito|quiero|quisiera|me\\s+gustar[íi]a|ocupo)?\\s*(?:que\\s+)?(?:me\\s+)?)';

const ARTICLE = '(?:\\s+(?:una?|el|la|los|las|unos|unas|mi|a|an|the|my))?';

const NOUN =
  '(?:\\s+(?:p[áa]gina|landing(?:\\s+page)?|sitio|micrositio|web(?:site)?|page|portafolio|portfolio|tienda|e-?commerce|app|aplicaci[óo]n))?';

const QUALIFIER = '(?:\\s+(?:web|online|en\\s+l[íi]nea))?';

const PREPOSITION = '(?:\\s*(?:para|de|del|sobre|for|of|about)\\s+)';

/**
 * A request that names its subject: "Crea una página web **para** El Zorzal Express".
 *
 * The preposition is required, and that requirement is what makes this safe. Without it the
 * pattern would happily strip the opening words of a business name that merely starts like a
 * verb.
 */
const REQUEST_WITH_SUBJECT = new RegExp(`^${LEAD_IN}${VERB}${ARTICLE}${NOUN}${QUALIFIER}${PREPOSITION}`, 'i');

/** An opening that names no verb at all: "Página web para la clínica X". */
const BARE_NOUN_WITH_SUBJECT = new RegExp(
  `^\\s*(?:una?\\s+)?(?:p[áa]gina|landing(?:\\s+page)?|sitio|micrositio|web(?:site)?|portafolio|portfolio|tienda|e-?commerce)${QUALIFIER}${PREPOSITION}`,
  'i',
);

/**
 * A request that is nothing but framing: "hazme una página web".
 *
 * Anchored at both ends, so it only matches when there is no subject anywhere in the message.
 */
const FRAMING_ONLY = new RegExp(`^${LEAD_IN}${VERB}${ARTICLE}${NOUN}${QUALIFIER}\\s*[.!]*\\s*$`, 'i');

/**
 * How much of the description reaches the image prompt.
 *
 * Flux follows a couple of sentences well and loses the thread past that; the cap also keeps six
 * parallel prompts from turning into six long ones. Cut on a sentence or word boundary, never
 * mid-word — a truncated word is a word the model will try to interpret.
 */
const MAX_SUBJECT_LENGTH = 240;

function truncateOnABoundary(text: string, limit: number): string {
  if (text.length <= limit) {
    return text;
  }

  const head = text.slice(0, limit);
  const lastSentence = Math.max(head.lastIndexOf('. '), head.lastIndexOf('; '));

  if (lastSentence > limit * 0.5) {
    return head.slice(0, lastSentence);
  }

  const lastSpace = head.lastIndexOf(' ');

  return (lastSpace > 0 ? head.slice(0, lastSpace) : head).replace(/[,;:]$/, '');
}

/**
 * The business, as a phrase that can follow "a photograph of".
 *
 * Returns an empty string when nothing usable is left, and every caller treats that as "no
 * business context available" rather than substituting a guess — a generic brief produces a
 * generic photograph, which is bad; an invented one produces a photograph of a business that
 * does not exist, which is worse.
 */
export function describeBusiness(request: string): string {
  const content = stripMessageMetadata(request).replace(/\s+/g, ' ').replace(/[<>]/g, '').trim();

  if (!content) {
    return '';
  }

  /*
   * A message that is framing and nothing else has no subject to photograph, and an empty
   * description is the honest answer: every caller treats it as "no business context", which
   * produces a generic brief rather than an invented one.
   */
  if (FRAMING_ONLY.test(content)) {
    return '';
  }

  const withoutFraming = content.replace(REQUEST_WITH_SUBJECT, '').replace(BARE_NOUN_WITH_SUBJECT, '');

  const description = truncateOnABoundary(withoutFraming.trim(), MAX_SUBJECT_LENGTH).trim();

  return description.replace(/[.,;:\s]+$/, '');
}
