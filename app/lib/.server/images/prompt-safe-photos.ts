import { createScopedLogger } from '~/utils/logger';
import type { CatalogPhoto } from './pexels';

const logger = createScopedLogger('CresovaPhotoCatalog');

/**
 * The longest a photo URL may be before it is dropped from the catalog.
 *
 * This is a hard boundary, not a style preference. The catalog tells the model to copy each URL
 * "character for character" into an `<img src>`, so a URL is only usable if a model can actually
 * write it out — and everything upstream of here is a URL we did not construct ourselves. When a
 * `data:` URL reached this function, six of them added several megabytes to the system prompt,
 * OpenRouter rejected the request with an empty body, and every build died on
 * `Custom error: Bad Request`. Nothing that far outside the shape of a URL should reach a prompt,
 * whatever produced it.
 *
 * 300 characters clears the longest Pexels URL (~110) and every generated-image URL this app
 * serves (~90) with room to spare.
 */
const MAX_PROMPT_URL_LENGTH = 300;

/**
 * Keeps only the photos the model can put in a page: a normal-length http(s) URL.
 *
 * Anything else is dropped rather than truncated, because half a URL renders as a broken image
 * and a broken image is worse than one photo fewer.
 */
export function keepPromptSafePhotos(photos: CatalogPhoto[]): CatalogPhoto[] {
  return photos.filter((photo) => {
    const url = photo.url?.trim() ?? '';

    if (!/^https?:\/\//i.test(url)) {
      logger.warn(`Dropping a photo whose URL is not http(s): ${url.slice(0, 40)}…`);
      return false;
    }

    if (url.length > MAX_PROMPT_URL_LENGTH) {
      logger.warn(`Dropping a ${url.length}-character photo URL, over the prompt ceiling`);
      return false;
    }

    return true;
  });
}
