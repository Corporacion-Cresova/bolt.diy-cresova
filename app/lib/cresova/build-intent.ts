/**
 * Detects whether a user message asks Cresova Builder to *build* something
 * (as opposed to asking a question about code).
 *
 * This is only used to decide whether an answer without an executable artifact
 * deserves one automatic recovery attempt, so it is intentionally conservative:
 * false negatives cost nothing, false positives cost tokens.
 */
const BUILD_INTENT_PATTERNS: RegExp[] = [
  // Spanish
  /\b(crea|crear|créame|creame|construye|construir|desarrolla|desarrollar|dise[ñn]a|dise[ñn]ar|haz|hazme|hacer|genera|generar|arma|armar|program(a|ar)|implementa|implementar|maqueta|maquetar)\b/i,
  /\b(p[áa]gina web|landing|sitio web|aplicaci[óo]n|app|web esencial|web pro|portafolio|tienda online|e-?commerce)\b/i,

  // English
  /\b(create|build|make|develop|design|generate|implement|code|scaffold|bootstrap)\b/i,
  /\b(landing page|web ?site|web ?app|application|portfolio|online store|e-?commerce)\b/i,
];

/**
 * Phrases that clearly signal a question rather than a build request.
 * A question wins only when no explicit build verb is present.
 */
const QUESTION_PATTERNS: RegExp[] = [
  /^\s*(qu[ée]|cu[áa]l|cu[áa]les|c[óo]mo|por qu[ée]|cu[áa]ndo|d[óo]nde|qui[ée]n|what|which|how|why|when|where|who|is|are|does|do|can|should)\b/i,
  /\b(diferencia|diferencias|difference|explica|expl[ií]came|explain|significa|means?)\b/i,
];

const MODEL_PREFIX_REGEX = /^\s*(?:\[Model:[^\]]*\]\s*)?(?:\[Provider:[^\]]*\]\s*)?/i;
const SELECTED_ELEMENT_REGEX = /<div class="__boltSelectedElement__"[\s\S]*?<\/div>/g;

export function stripMessageMetadata(message: string): string {
  return message.replace(MODEL_PREFIX_REGEX, '').replace(SELECTED_ELEMENT_REGEX, '').trim();
}

export function detectBuildIntent(message: string): boolean {
  const content = stripMessageMetadata(message);

  if (!content) {
    return false;
  }

  const buildMatches = BUILD_INTENT_PATTERNS.filter((pattern) => pattern.test(content)).length;

  if (buildMatches === 0) {
    return false;
  }

  const looksLikeQuestion = QUESTION_PATTERNS.some((pattern) => pattern.test(content));

  /*
   * "¿Cómo creo una landing page?" matches both. Only treat it as a build request when the
   * build signal is strong (verb + subject) and the message is not phrased as a question.
   */
  if (looksLikeQuestion) {
    return buildMatches >= 2 && !content.trimEnd().endsWith('?');
  }

  return true;
}
