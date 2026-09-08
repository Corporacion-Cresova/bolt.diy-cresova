import { createScopedLogger } from '~/utils/logger';
import { imagePath, putImage, recordImageFailures } from './image-store';
import { describeBusiness } from './describe-business';

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

/** The catalogue of models this endpoint serves. Not `/api/v1/models`, which is chat only. */
export const OPENROUTER_IMAGE_MODELS_ENDPOINT = 'https://openrouter.ai/api/v1/images/models';

/**
 * The image model.
 *
 * Flux 2 Pro is what Diego chose and what the logs show working: about $0.03 for a 16:9 frame and
 * $0.045 for the taller crops. It is left as the default deliberately — the one time it was
 * changed, it was changed on a bad reading (see the note on the catalogue endpoint above), not on
 * anything wrong with the model.
 *
 * The override exists because picking an image model is a taste decision made by looking at
 * output, and it should not need a deploy of new code.
 */
export const DEFAULT_IMAGE_MODEL = 'black-forest-labs/flux.2-pro';

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

  /**
   * The business the photograph is of, as a phrase.
   *
   * Carried separately from `subject` rather than spliced into it: the subject describes the kind
   * of shot ("wide environmental photograph of the working space"), and a description dropped
   * into the middle of that turns a clean sentence into a run-on that Flux has to untangle. It
   * belongs as its own declarative cue, which is how the rest of this prompt is built.
   *
   * Empty when the request gave nothing to go on. The prompt then leans on the sector alone,
   * which is weak — but inventing a business would be worse.
   */
  business?: string;
}

export interface OpenRouterImagesRequest {
  prompts: FluxImagePrompt[];
  sector: string;
  apiKey: string | undefined;

  /** Overrides the default model. Comes from OPENROUTER_IMAGES_MODEL when it is set. */
  model?: string;

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

  const business = req.business?.trim();

  return [
    `${req.subject.trim()}.`,

    /*
     * Second, right after the kind of shot and before the style cues: Flux weights the front of
     * the prompt most heavily, and what the photograph is *of* matters more than how it is lit.
     */
    business ? `The business: ${business}.` : '',
    `${defaults.mood}.`,
    `${compositionByRole[req.role]}.`,
    `Color palette: ${defaults.palette}.`,
    'Photographic, no text, no logos, no watermark.',
    'Sharp focus, 24-70mm lens equivalent, natural grain.',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Why one image did not come back, in the words the service used. */
export interface ImageFailure {
  role: string;
  reason: string;
}

type SingleImageResult = { ok: true; base64: string; contentType: string } | { ok: false; reason: string };

/**
 * Calls OpenRouter once and returns the raw base64 payload, or why it did not.
 *
 * The reason is carried out rather than only logged. When the model id was wrong every request
 * was rejected and the only trace was a `logger.warn` inside a container — so from the outside a
 * misconfiguration and a working feature looked identical, and a client's site shipped with stock
 * photos while the switch said images were on. A failure nobody can see is a failure nobody
 * fixes.
 */
async function runSingleImage(
  apiKey: string,
  model: string,
  prompt: string,
  role: FluxImagePrompt['role'],
): Promise<SingleImageResult> {
  try {
    const response = await fetch(OPENROUTER_IMAGES_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        output_format: 'jpeg',
        aspect_ratio: ASPECT_BY_ROLE[role],
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      /*
       * The body says which of the many 400s this is — an unknown model, no credit, a rejected
       * prompt — and those need different fixes. Truncated because it is rendered in a page.
       */
      const detail = await response.text().catch(() => '');
      const reason = `HTTP ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`;
      logger.warn(`OpenRouter image generation failed — ${reason}`);

      return { ok: false, reason };
    }

    const payload = (await response.json()) as OpenRouterImageResponse;

    if (payload.error) {
      const reason = payload.error.message ?? 'the service reported an error with no message';
      logger.warn(`OpenRouter image generation errored: ${reason}`);

      return { ok: false, reason };
    }

    const firstImage = payload.data?.[0];

    if (!firstImage?.b64_json) {
      logger.warn('OpenRouter image generation returned an empty payload');
      return { ok: false, reason: 'the answer carried no image' };
    }

    /*
     * `media_type` is documented as present whenever the format could be identified and omitted
     * when it could not. We asked for jpeg, so that is the assumption when it is missing.
     */
    return { ok: true, base64: firstImage.b64_json, contentType: firstImage.media_type || 'image/jpeg' };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    logger.warn(`OpenRouter image generation threw: ${reason}`);

    return { ok: false, reason };
  }
}

export interface OpenRouterCatalogResult {
  photos: CatalogPhoto[];

  /** One entry per image that did not come back. Empty on a clean run. */
  failures: ImageFailure[];
}

/**
 * Generates one image per prompt, in parallel, stores the bytes and returns one CatalogPhoto per
 * prompt that succeeded — plus why each of the others did not. Never throws: a build must not
 * fail because the image service is misconfigured.
 */
export async function generateOpenRouterCatalog(req: OpenRouterImagesRequest): Promise<OpenRouterCatalogResult> {
  if (!req.apiKey) {
    logger.debug('No OpenRouter image API key configured, returning empty catalog');
    return { photos: [], failures: [] };
  }

  /*
   * No origin means the generated bytes would have no address, and an image the page cannot load
   * is worth less than the $0.24 the six of them cost. Skip before spending, not after.
   */
  if (!req.origin) {
    logger.warn('No origin available to serve generated images from, skipping image generation');
    return { photos: [], failures: [{ role: 'all', reason: 'no origin to serve the images from' }] };
  }

  if (req.prompts.length === 0) {
    return { photos: [], failures: [] };
  }

  const model = req.model || DEFAULT_IMAGE_MODEL;

  type PerPrompt = { photo: CatalogPhoto } | { failure: ImageFailure };

  const results = await Promise.all(
    req.prompts.map(async (imagePrompt): Promise<PerPrompt> => {
      const fluxPrompt = buildImagePrompt(imagePrompt, req.sector);
      const generated = await runSingleImage(req.apiKey!, model, fluxPrompt, imagePrompt.role);

      if (!generated.ok) {
        return { failure: { role: imagePrompt.role, reason: generated.reason } };
      }

      const stored = putImage(generated.base64, generated.contentType, {
        role: imagePrompt.role,
        subject: imagePrompt.subject,
        business: imagePrompt.business ?? '',
        prompt: fluxPrompt,
      });

      if (!stored.ok) {
        /*
         * The image arrived and was paid for; it is this app that would not keep it. That is a
         * different fault from the service refusing to make one, and it needs saying as such.
         */
        return { failure: { role: imagePrompt.role, reason: `generated but not stored — ${stored.reason}` } };
      }

      const photo: CatalogPhoto = {
        url: `${req.origin!.replace(/\/$/, '')}${imagePath(stored.id, generated.contentType)}`,
        alt: imagePrompt.subject,
        source: 'openrouter',
      };

      return { photo };
    }),
  );

  const photos: CatalogPhoto[] = [];
  const failures: ImageFailure[] = [];

  for (const result of results) {
    if ('photo' in result) {
      photos.push(result.photo);
    } else {
      failures.push(result.failure);
    }
  }

  recordImageFailures(model, failures);

  logger.info(
    `OpenRouter catalog with ${model}: ${photos.length}/${req.prompts.length} images for sector "${req.sector}"` +
      (failures.length ? ` — first failure: ${failures[0].reason}` : ''),
  );

  return { photos, failures };
}

/**
 * Composes the image prompt list for a build, sized to the role each image plays in the page.
 *
 * Every brief names the business. That sounds obvious and it was not true: only the hero brief
 * carried the request, and the other five said things like "wide environmental photograph of the
 * working space" — with no hint of *whose* working space. Flux was being asked to photograph a
 * business it had never been told about, so five of six images came back as generic stock for
 * the sector and nothing more. That is the gap between "the API is being called" and "the photos
 * are of this client".
 *
 * When there is no description to be had, the briefs fall back to the sector alone rather than
 * inventing a business. A generic photograph is a weak photograph; a photograph of a business
 * that does not exist is a lie on a client's page.
 *
 * Six per site is the upper bound because more than that and the cost per site passes $0.25
 * without a proportional quality jump.
 */
export function composeImageBriefs(sector: string, request: string): FluxImagePrompt[] {
  const business = describeBusiness(request);

  const briefs: Array<Pick<FluxImagePrompt, 'subject' | 'role'>> = [
    {
      subject: 'Editorial hero photograph showing what this business does, in the place it does it',
      role: 'hero',
    },
    {
      subject: 'Wide environmental photograph of the working space, no people, natural light',
      role: 'gallery',
    },
    {
      subject:
        'Close-up of a detail from the day-to-day work that suggests craft or care: hands at work, materials, surfaces',
      role: 'gallery',
    },
    {
      subject: 'The work in progress, candid, mid-action, documentary style',
      role: 'gallery',
    },
    {
      /*
       * Not a posed portrait, on purpose. This brief used to ask for "the team or owner", and a
       * generated face on a client's About section is a person who does not exist, presented as
       * the people the client actually is. Hands and posture carry the same warmth and claim
       * nothing about who anyone is.
       */
      subject:
        'Someone at work, seen from behind or in profile, hands and posture in frame rather than a posed face, candid and warm',
      role: 'about',
    },
    {
      subject:
        'Environmental photograph of the surroundings — the street, the neighbourhood, the landscape that gives this business its place',
      role: 'context',
    },
  ];

  return briefs.map((brief) => ({ ...brief, business }));
}
