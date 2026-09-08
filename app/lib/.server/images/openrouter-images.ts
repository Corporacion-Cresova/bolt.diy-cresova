import { createScopedLogger } from '~/utils/logger';
import { imagePath, putImage } from './image-store';

const logger = createScopedLogger('CresovaImagesOpenRouter');

/**
 * OpenRouter Image API client for Flux 2 Pro.
 *
 * Why OpenRouter over a direct Replicate call: Diego asked for image generation through the
 * same provider that already powers the LLM calls, with a separate API key so the image
 * spend is visible on its own billing line. OpenRouter serves Flux 2 Pro for $0.04/image,
 * which is cheaper than Replicate's $0.05 for Flux 1.1 Pro.
 *
 * OpenRouter returns generated images **only** as base64; there is no hosted-URL option. The
 * first version of this file therefore handed the prompt a `data:` URL, which broke builds
 * outright — see the comment at the top of `image-store.ts` for what that cost and why. The
 * bytes now go into that store and the catalog carries a short URL pointing back at this app,
 * which is the only form the model can actually copy into an `<img src>`.
 *
 * The endpoint is documented at https://openrouter.ai/docs/features/multimodal/
 * image-generation. The relevant fields for our use are: model, prompt, aspect_ratio,
 * output_format, n. We pin output_format to jpeg because it is the smallest encoding that
 * still looks editorial, and these images are served to a public page.
 */

const OPENROUTER_IMAGES_ENDPOINT = 'https://openrouter.ai/api/v1/images';
const FLUX_2_PRO_MODEL = 'black-forest-labs/flux.2-pro';

/**
 * How long one image may take before it is given up on.
 *
 * Not a network-timeout number: this runs *before* the first token of the build, inside a request
 * whose stall watchdog aborts after 180 seconds with nothing written — and a retry of that request
 * regenerates the whole catalog, so a slow image is billed twice. Flux answers in five to fifteen
 * seconds and the six run in parallel; one that has taken forty-five is holding up the build, and
 * a build with five photos instead of six is not a build anyone can tell apart.
 */
const REQUEST_TIMEOUT_MS = 45_000;
const ASPECT_BY_ROLE: Record<FluxImagePrompt['role'], string> = {
  hero: '16:9',
  gallery: '1:1',
  about: '3:2',
  context: '16:9',
  product: '1:1',
};

export interface CatalogPhoto {
  url: string;
  alt: string;
  source?: 'pexels' | 'flux' | 'picsum' | 'openrouter';
}

export interface FluxImagePrompt {
  subject: string;
  composition?: string;
  role: 'hero' | 'gallery' | 'about' | 'context' | 'product';
}

export interface OpenRouterImagesRequest {
  prompts: FluxImagePrompt[];
  sector: string;
  apiKey: string | undefined;

  /**
   * Absolute origin of this app, e.g. `https://builder.cresova.com`.
   *
   * A generated image is served back by this app, and the page that embeds it runs on the
   * runner under a different host, so the catalog needs an absolute URL. Without an origin
   * there is nowhere to serve the bytes from, so generation is skipped rather than paying
   * $0.04 an image for something no page could load.
   */
  origin: string | undefined;
}

interface OpenRouterImageResponse {
  data?: Array<{ b64_json?: string; media_type?: string }>;
  error?: { message?: string; code?: number };
}

/**
 * Builds the prompt that goes to Flux from a Cresova image request.
 *
 * The prompt is intentionally a single declarative sentence followed by short style cues,
 * because Flux follows structure better than loose prose. The sector decides the lighting
 * and palette cue; the role decides the composition cue; the subject is the actual brief.
 *
 * The sector table is duplicated here on purpose (it already lives in the design-kit prompt).
 * Wiring it through would create a circular dependency between runtime and prompt files, and
 * the table is short enough that one duplicated copy is cheaper than a refactor.
 */
export function buildImagePrompt(req: FluxImagePrompt, sector: string): string {
  const paletteBySector: Record<string, { mood: string; palette: string }> = {
    'turismo, aventura, hotelería': {
      mood: 'warm natural light, editorial travel photography',
      palette: 'muted greens, teals, warm sands',
    },
    'gastronomía, café, catering': {
      mood: 'intimate restaurant lighting, editorial food photography',
      palette: 'warm earth tones, deep wine reds, golden hour light',
    },
    'belleza, bienestar, suplementos': {
      mood: 'soft studio light, minimal beauty photography',
      palette: 'ivory, sage greens, soft pinks',
    },
    'comercio, tienda, retail': {
      mood: 'clean product photography, natural light, editorial',
      palette: 'warm cream, terracotta, deep brown',
    },
    'oficios, construcción, limpieza, transporte': {
      mood: 'documentary work photography, candid, sharp detail',
      palette: 'cool blues, steel grays, high contrast',
    },
    'salud, legal, financiero, profesional': {
      mood: 'clean professional environment, soft natural light',
      palette: 'cool whites, navy blues, warm grays',
    },
  };

  const defaults = paletteBySector[sector] ?? {
    mood: 'editorial photography',
    palette: 'muted natural tones',
  };

  const compositionByRole: Record<FluxImagePrompt['role'], string> = {
    hero: 'Subject on the right third, generous negative space on the left for headline overlay, full-bleed landscape composition',
    gallery: 'Square composition, subject filling 70% of frame, shallow depth of field, editorial crop',
    about:
      'Candid documentary frame, subject at conversational distance, natural posture, environmental context visible',
    context: 'Wide environmental shot, subject integrated into a real working space, no staged posing',
    product: 'Subject on a neutral surface, soft directional light, slight angle, no harsh shadows',
  };

  return [
    `${req.subject.trim()}.`,
    `${defaults.mood}.`,
    `${compositionByRole[req.role]}.`,
    `Color palette: ${defaults.palette}.`,
    'Photographic, no text, no logos, no watermark.',
    'Sharp focus, 24-70mm lens equivalent, natural grain.',
  ].join(' ');
}

/**
 * Calls OpenRouter once and returns the raw base64 payload, or null on any failure.
 *
 * Deliberately returns the payload rather than a URL: turning bytes into something addressable
 * is the store's job, and keeping that out of here means a failure to store looks the same as a
 * failure to generate — a missing image, never a broken build.
 */
async function runSingleImage(
  apiKey: string,
  prompt: string,
  role: FluxImagePrompt['role'],
): Promise<{ base64: string; contentType: string } | null> {
  try {
    const response = await fetch(OPENROUTER_IMAGES_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: FLUX_2_PRO_MODEL,
        prompt,
        n: 1,
        output_format: 'jpeg',
        aspect_ratio: ASPECT_BY_ROLE[role],
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.warn(`OpenRouter image generation failed with ${response.status}`);
      return null;
    }

    const payload = (await response.json()) as OpenRouterImageResponse;

    if (payload.error) {
      logger.warn(`OpenRouter image generation errored: ${payload.error.message ?? 'no message'}`);
      return null;
    }

    const firstImage = payload.data?.[0];

    if (!firstImage?.b64_json) {
      logger.warn('OpenRouter image generation returned an empty payload');
      return null;
    }

    /*
     * `media_type` is documented as present whenever the format could be identified and omitted
     * when it could not. We asked for jpeg, so that is the assumption when it is missing.
     */
    return { base64: firstImage.b64_json, contentType: firstImage.media_type || 'image/jpeg' };
  } catch (error) {
    logger.warn(`OpenRouter image generation threw: ${error instanceof Error ? error.message : 'unknown'}`);
    return null;
  }
}

/**
 * Generates one image per prompt, in parallel, stores the bytes and returns one CatalogPhoto per
 * prompt that succeeded. Logs (never throws) for each that failed. Callers concatenate the result
 * with whatever Pexels returned to keep the prompt-time catalog dense.
 */
export async function generateOpenRouterCatalog(req: OpenRouterImagesRequest): Promise<CatalogPhoto[]> {
  if (!req.apiKey) {
    logger.debug('No OpenRouter image API key configured, returning empty catalog');
    return [];
  }

  /*
   * No origin means the generated bytes would have no address, and an image the page cannot load
   * is worth less than the $0.24 the six of them cost. Skip before spending, not after.
   */
  if (!req.origin) {
    logger.warn('No origin available to serve generated images from, skipping image generation');
    return [];
  }

  if (req.prompts.length === 0) {
    return [];
  }

  const results = await Promise.all(
    req.prompts.map(async (imagePrompt) => {
      const fluxPrompt = buildImagePrompt(imagePrompt, req.sector);
      const generated = await runSingleImage(req.apiKey!, fluxPrompt, imagePrompt.role);

      if (!generated) {
        return null;
      }

      const id = putImage(generated.base64, generated.contentType);

      if (!id) {
        return null;
      }

      const photo: CatalogPhoto = {
        url: `${req.origin!.replace(/\/$/, '')}${imagePath(id, generated.contentType)}`,
        alt: imagePrompt.subject,
        source: 'openrouter',
      };

      return photo;
    }),
  );

  const successful: CatalogPhoto[] = [];

  for (const photo of results) {
    if (photo !== null) {
      successful.push(photo);
    }
  }

  logger.info(
    `OpenRouter catalog: ${successful.length}/${req.prompts.length} images generated for sector "${req.sector}"`,
  );

  return successful;
}

/**
 * Composes the image prompt list for a build, sized to the role the image plays in the page.
 *
 * Six per site is the upper bound because more than that and the cost per site passes
 * $0.25 without a proportional quality jump.
 */
export function composeImageBriefs(sector: string, request: string): FluxImagePrompt[] {
  const safeRequest = request.replace(/[<>]/g, '').slice(0, 280);

  return [
    {
      subject: `Editorial hero photograph showing the business described as: ${safeRequest}`,
      role: 'hero',
    },
    {
      subject: `Wide environmental photograph of the working space, no people, natural light`,
      role: 'gallery',
    },
    {
      subject: `Close-up of a detail that suggests craft or care, hand at work, materials, surfaces`,
      role: 'gallery',
    },
    {
      subject: `The subject of the business in their element, candid, mid-action, documentary style`,
      role: 'gallery',
    },
    {
      subject: `Portrait-style photograph of the team or owner at work, candid, warm`,
      role: 'about',
    },
    {
      subject: `Environmental photograph of the surrounding area or neighborhood that gives the business its place`,
      role: 'context',
    },
  ];
}
