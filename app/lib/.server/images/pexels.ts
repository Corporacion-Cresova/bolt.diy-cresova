import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('CresovaImages');

const PEXELS_ENDPOINT = 'https://api.pexels.com/v1/search';
const REQUEST_TIMEOUT_MS = 8000;

export interface CatalogPhoto {
  url: string;
  alt: string;
}

interface PexelsPhoto {
  alt?: string;
  src?: { large2x?: string; large?: string; medium?: string };
}

/**
 * Resolves real photo URLs for a build request.
 *
 * Models cannot be trusted to write a working stock photo URL: they invent Pexels photo ids,
 * which 404, and the page ends up with holes where the hero image should be. Fetching the URLs
 * ourselves and handing them over verbatim removes the guesswork entirely.
 *
 * Returns an empty list when no API key is configured; the prompt then falls back to a
 * placeholder service that always resolves.
 */
export async function fetchPhotoCatalog(query: string, apiKey: string | undefined, count = 8): Promise<CatalogPhoto[]> {
  if (!apiKey || !query.trim()) {
    return [];
  }

  const url = `${PEXELS_ENDPOINT}?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: apiKey },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      // never log the key, only what happened
      logger.warn(`Pexels search failed with ${response.status}, continuing without a photo catalog`);
      return [];
    }

    const data = (await response.json()) as { photos?: PexelsPhoto[] };

    return (data.photos ?? [])
      .map((photo) => ({
        url: photo.src?.large2x || photo.src?.large || photo.src?.medium || '',
        alt: (photo.alt || '').trim() || 'Fotografía relacionada con el negocio',
      }))
      .filter((photo) => photo.url);
  } catch (error) {
    logger.warn('Could not reach Pexels, continuing without a photo catalog', error);
    return [];
  }
}

/**
 * Turns the user's request into a stock photo search query.
 *
 * The point is to describe the *sector*, not to repeat the whole brief: a query carrying the
 * business name or the word "profesional" returns unrelated results.
 */
export function buildPhotoQuery(message: string): string {
  const NOISE =
    /\b(crea|crear|construye|construir|hazme|haz|hacer|genera|generar|dise[ñn]a|dise[ñn]ar|quiero|necesito|por favor|una|unas|un|unos|la|el|los|las|de|del|para|con|que|se|llame|llamada|llamado|profesional|moderna|moderno|bonita|bonito|p[áa]gina|web|sitio|landing|page|website|create|build|make|design|generate|a|an|the|for|with|called|named|professional|modern|nice)\b/gi;

  const cleaned = message
    .replace(/^\s*(?:\[Model:[^\]]*\]\s*)?(?:\[Provider:[^\]]*\]\s*)?/i, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(NOISE, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // a handful of meaningful words beats a full sentence for image search
  return cleaned.split(' ').slice(0, 5).join(' ');
}
