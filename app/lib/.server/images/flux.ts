import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('CresovaImagesFlux');

/**
 * Replicate API endpoint for Flux Pro via the predictions route.
 *
 * The Replicate API is async by design: POST /v1/predictions starts a job, the response includes
 * a polling URL, and the image URL lives in the eventual output array. We poll synchronously
 * because the LLM call is already on the critical path; adding a webhook round-trip would slow
 * the build by seconds we do not have.
 *
 * Flux Pro was chosen over DALL-E 3 because it follows compositional instructions more reliably
 * (a hero described as "subject on the left, negative space on the right" actually comes out
 * that way), and because Replicate's CDN hosts the output for ~1 hour, long enough for the
 * model to use the URL in the artifact.
 */

const REPLICATE_PREDICTIONS_ENDPOINT = 'https://api.replicate.com/v1/predictions';
const FLUX_PRO_MODEL_VERSION = 'black-forest-labs/flux-1.1-pro';

const REQUEST_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 1_500;

export interface CatalogPhoto {
  url: string;
  alt: string;
  source?: 'pexels' | 'flux' | 'picsum';
}

export interface FluxImagePrompt {
  /*
   * The raw description of what should appear in the image. This is composed by the
   * prompt builder (see buildImagePrompt) from the sector table and the user's request,
   * so the model never invents the visual brief.
   */
  subject: string;

  /*
   * Optional hint that the model should respect, e.g. "subject on the right third,
   * negative space on the left for headline overlay". When omitted, the builder picks a
   * composition that matches the section the image is for.
   */
  composition?: string;

  /*
   * The section this image will be used in. The builder turns this into a composition
   * cue and a mood cue without leaking any of those details into the prompt itself —
   * the prompt stays a single declarative sentence so Flux does not over-think.
   */
  role: 'hero' | 'gallery' | 'about' | 'context' | 'product';
}

export interface FluxGenerationRequest {
  prompts: FluxImagePrompt[];
  sector: string;
  apiKey: string | undefined;
}

interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string[];
  error?: string;
  urls?: { get: string };
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
 * Runs a single Flux prediction and returns the output URL. Times out after REQUEST_TIMEOUT_MS
 * by aborting the poll loop; the caller decides whether to fall back to Pexels.
 */
async function runSinglePrediction(apiKey: string, prompt: string, role: FluxImagePrompt['role']): Promise<string | null> {
  const headers = {
    Authorization: `Token ${apiKey}`,
    'Content-Type': 'application/json',
    Prefer: 'wait',
  };

  const body = JSON.stringify({
    version: FLUX_PRO_MODEL_VERSION,
    input: {
      prompt,
      aspect_ratio: role === 'gallery' ? '1:1' : '16:9',
      output_format: 'jpg',
      output_quality: 90,
      safety_tolerance: 2,
      prompt_upsampling: true,
    },
  });

  try {
    const response = await fetch(REPLICATE_PREDICTIONS_ENDPOINT, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.warn(`Flux prediction start failed with ${response.status}`);
      return null;
    }

    const prediction = (await response.json()) as ReplicatePrediction;

    // When Prefer: wait succeeds, the response is already terminal. Otherwise we poll.
    if (prediction.status === 'succeeded') {
      return prediction.output?.[0] ?? null;
    }

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      logger.warn(`Flux prediction ${prediction.id} ended ${prediction.status}: ${prediction.error ?? 'no error'}`);
      return null;
    }

    return await pollUntilDone(apiKey, prediction.id);
  } catch (error) {
    logger.warn(`Flux prediction threw: ${error instanceof Error ? error.message : 'unknown'}`);
    return null;
  }
}

async function pollUntilDone(apiKey: string, predictionId: string): Promise<string | null> {
  const deadline = Date.now() + REQUEST_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const response = await fetch(`${REPLICATE_PREDICTIONS_ENDPOINT}/${predictionId}`, {
      headers: { Authorization: `Token ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      logger.warn(`Flux poll failed with ${response.status} for ${predictionId}`);
      continue;
    }

    const prediction = (await response.json()) as ReplicatePrediction;

    if (prediction.status === 'succeeded') {
      return prediction.output?.[0] ?? null;
    }

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      logger.warn(`Flux prediction ${predictionId} ended ${prediction.status}: ${prediction.error ?? 'no error'}`);
      return null;
    }
  }

  logger.warn(`Flux prediction ${predictionId} timed out after ${REQUEST_TIMEOUT_MS}ms`);
  return null;
}

/**
 * Generates one image per prompt, in parallel. Returns one CatalogPhoto per prompt that
 * succeeded, and logs (does not throw) for each that failed. Callers concatenate the result
 * with whatever Pexels returned to keep the prompt-time catalog dense.
 *
 * The model promises up to six images per site in the implementation plan; we accept an
 * arbitrary length here so a future config flag can change it without touching this code.
 */
export async function generateFluxCatalog(req: FluxGenerationRequest): Promise<CatalogPhoto[]> {
  if (!req.apiKey) {
    logger.debug('No Flux API key configured, returning empty catalog');
    return [];
  }

  if (req.prompts.length === 0) {
    return [];
  }

  const results = await Promise.all(
    req.prompts.map(async (imagePrompt, index) => {
      const fluxPrompt = buildImagePrompt(imagePrompt, req.sector);
      const url = await runSinglePrediction(req.apiKey!, fluxPrompt, imagePrompt.role);

      if (!url) {
        return null;
      }

      const photo: CatalogPhoto = {
        url,
        alt: imagePrompt.subject,
        source: 'flux',
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

  logger.info(`Flux catalog: ${successful.length}/${req.prompts.length} images generated for sector "${req.sector}"`);

  return successful;
}

/**
 * Composes the image prompt list for a build, sized to the role the image plays in the page.
 *
 * The brief is built from the same sector + intent that the design-kit uses for typography,
 * so a request for a "clínica dental" generates photos that match the clínica palette in the
 * design-kit's sector table. The subjects are deliberately diverse: one hero, three gallery
 * shots that are not interchangeable, one about, one context. Six per site is the upper bound
 * because more than that and the cost per site passes $0.30 without a proportional quality
 * jump.
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
