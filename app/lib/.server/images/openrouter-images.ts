import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('CresovaImagesOpenRouter');

/**
 * OpenRouter Image API client for Flux 2 Pro.
 *
 * Why OpenRouter over a direct Replicate call: Diego asked for image generation through the
 * same provider that already powers the LLM calls, with a separate API key so the image
 * spend is visible on its own billing line. OpenRouter serves Flux 2 Pro for $0.04/image,
 * which is cheaper than Replicate's $0.05 for Flux 1.1 Pro, and it returns the image as
 * base64, which works directly in the WebContainer runtime where every generated site
 * executes in the browser. No file I/O, no public URL, no TTL to worry about.
 *
 * The endpoint is documented at https://openrouter.ai/docs/guides/overview/multimodal/
 * image-generation. The relevant fields for our use are: model, prompt, aspect_ratio,
 * output_format, n. We pin output_format to jpeg because the LLM is going to write the
 * URL verbatim into an <img src> and base64 jpeg is the smallest encoding that still
 * looks editorial.
 */

const OPENROUTER_IMAGES_ENDPOINT = 'https://openrouter.ai/api/v1/images';
const FLUX_2_PRO_MODEL = 'black-forest-labs/flux.2-pro';

const REQUEST_TIMEOUT_MS = 90_000;
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
}

interface OpenRouterImageResponse {
  data?: Array<{ b64_json?: string }>;
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
    about: 'Candid documentary frame, subject at conversational distance, natural posture, environmental context visible',
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
 * Calls OpenRouter once and returns a base64 data URL, or null on any failure.
 *
 * The OpenRouter Image API returns b64_json (raw image bytes base64-encoded). We wrap it
 * in a data: URL so the LLM can paste it directly into <img src=...> without the browser
 * having to fetch from a CDN. This is what makes the WebContainer runtime work without
 * a public file host.
 */
async function runSingleImage(apiKey: string, prompt: string, role: FluxImagePrompt['role']): Promise<string | null> {
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

    return `data:image/jpeg;base64,${firstImage.b64_json}`;
  } catch (error) {
    logger.warn(`OpenRouter image generation threw: ${error instanceof Error ? error.message : 'unknown'}`);
    return null;
  }
}

/**
 * Generates one image per prompt, in parallel. Returns one CatalogPhoto per prompt that
 * succeeded, and logs (does not throw) for each that failed. Callers concatenate the result
 * with whatever Pexels returned to keep the prompt-time catalog dense.
 */
export async function generateOpenRouterCatalog(req: OpenRouterImagesRequest): Promise<CatalogPhoto[]> {
  if (!req.apiKey) {
    logger.debug('No OpenRouter image API key configured, returning empty catalog');
    return [];
  }

  if (req.prompts.length === 0) {
    return [];
  }

  const results = await Promise.all(
    req.prompts.map(async (imagePrompt) => {
      const fluxPrompt = buildImagePrompt(imagePrompt, req.sector);
      const url = await runSingleImage(req.apiKey!, fluxPrompt, imagePrompt.role);

      if (!url) {
        return null;
      }

      const photo: CatalogPhoto = {
        url,
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
  const safeSector = sector.toLowerCase();
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
