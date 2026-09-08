import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('CresovaImageStore');

/**
 * Where the bytes of a generated image live between the moment Flux returns them and the moment
 * a browser asks for them.
 *
 * The reason this file exists at all: OpenRouter returns generated images **only** as base64
 * (there is no hosted-URL option), and the first version of the integration put that base64
 * straight into the prompt as a `data:` URL. Both halves of that were wrong.
 *
 *   - The request half: six editorial JPEGs are several megabytes of base64. Concatenated into
 *     the system prompt they made the request to OpenRouter so large it was rejected before it
 *     ever reached a model, with an empty body — which the AI SDK reports as the response's
 *     status text. That is the `Custom error: Bad Request` that made every build fail the moment
 *     image generation was switched on.
 *   - The answer half: even had it been accepted, the catalog asks the model to copy each URL
 *     "character for character" into an `<img src>`. A 500 KB string cannot be copied by a model
 *     whose entire output budget is 64.000 tokens. A `data:` URL is unusable in this catalog by
 *     construction, not just too big by accident.
 *
 * So the bytes stay here and the prompt gets a short URL. Held in memory rather than on disk
 * because the builder runs on workerd (`wrangler pages dev`), which has no filesystem, and no
 * KV or R2 binding is configured for this deployment. The consequence is honest and bounded: an
 * image survives as long as the builder container does. That covers previews, which are reaped
 * after thirty minutes anyway, and it covers a site from generation through publish — and the
 * runner copies these images into the published directory at publish time, so a published site
 * does not depend on this cache staying warm.
 */

export interface StoredImage {
  bytes: Uint8Array;
  contentType: string;

  /**
   * What was asked of Flux, kept alongside the bytes.
   *
   * Without this there is no way to answer the only question that matters once the API is
   * confirmed to be answering: not «is it generating images» but «is it generating images of
   * *this* business». The prompt is the evidence, and it is only evidence if it sits next to the
   * picture it produced.
   */
  brief: ImageBrief;

  createdAt: string;

  /**
   * How many times the bytes have actually been served.
   *
   * Zero on an image that exists is the interesting case: it means the photo was generated and
   * paid for, and then the model did not put it in the page.
   */
  hits: number;

  lastHitAt?: string;
}

export interface ImageBrief {
  /** The role the image was generated for: hero, gallery, about, context. */
  role: string;

  /** The kind of shot asked for. */
  subject: string;

  /** The business, as it was extracted from the request. Empty when the request gave nothing. */
  business: string;

  /** The full text sent to Flux, verbatim. */
  prompt: string;
}

/**
 * Roughly forty editorial JPEGs. Sized against workerd's 128 MB so a burst of generations can
 * never be what takes the builder down; the eviction below keeps it at the ceiling rather than
 * letting it grow.
 */
const MAX_TOTAL_BYTES = 24 * 1024 * 1024;

/** Larger than any 16:9 JPEG Flux returns, small enough that a runaway response cannot be stored. */
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/*
 * Insertion-ordered, which is what makes the eviction below a real LRU-by-age: Map iterates in
 * insertion order, so the first entry is always the oldest.
 */
const images = new Map<string, StoredImage>();
let storedBytes = 0;

function evictUntilItFits(incoming: number) {
  for (const [id, image] of images) {
    if (storedBytes + incoming <= MAX_TOTAL_BYTES) {
      return;
    }

    images.delete(id);
    storedBytes -= image.bytes.byteLength;
  }
}

/**
 * Decodes base64 into bytes.
 *
 * `atob` rather than Buffer: this runs on workerd in production, where Node's Buffer is only
 * available through the nodejs_compat flag and is not worth depending on for eight lines.
 */
function decodeBase64(b64: string): Uint8Array | null {
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index++) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  } catch {
    return null;
  }
}

/**
 * Stores one generated image and returns the id to address it by, or null when the payload is
 * not something we are willing to serve. Never throws: a build must not fail because an image
 * came back malformed.
 */
export function putImage(base64: string, contentType: string, brief: ImageBrief): string | null {
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    logger.warn(`Refusing to store an image with content type "${contentType}"`);
    return null;
  }

  const bytes = decodeBase64(base64);

  if (!bytes || bytes.byteLength === 0) {
    logger.warn('Refusing to store an image whose base64 payload did not decode');
    return null;
  }

  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    logger.warn(`Refusing to store a ${Math.round(bytes.byteLength / 1024)} KB image, over the per-image ceiling`);
    return null;
  }

  evictUntilItFits(bytes.byteLength);

  const id = crypto.randomUUID().replace(/-/g, '');
  images.set(id, { bytes, contentType, brief, createdAt: new Date().toISOString(), hits: 0 });
  storedBytes += bytes.byteLength;

  return id;
}

export function getImage(id: string): StoredImage | undefined {
  return images.get(id);
}

/**
 * The same lookup the route uses, which also records that the bytes went out.
 *
 * Separate from `getImage` so the diagnostics page can list what is held without inflating the
 * very counter it is there to report.
 */
export function serveImage(id: string): StoredImage | undefined {
  const image = images.get(id);

  if (image) {
    image.hits += 1;
    image.lastHitAt = new Date().toISOString();
  }

  return image;
}

/** Everything held, newest first, for the diagnostics page. */
export function listImages(): Array<StoredImage & { id: string }> {
  return [...images.entries()].map(([id, image]) => ({ id, ...image })).reverse();
}

/** What `/api/health` reports, so the cache is visible without a debugger. */
export function imageStoreStats(): { count: number; bytes: number; limitBytes: number } {
  return { count: images.size, bytes: storedBytes, limitBytes: MAX_TOTAL_BYTES };
}

/** Test seam. Never called by the runtime. */
export function __resetImageStore() {
  images.clear();
  storedBytes = 0;
}

export const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * The path a generated image is served from.
 *
 * The extension is part of the URL rather than only a header because the model writes this into
 * an `<img src>`, the runner copies it into a published site, and half the tooling in between
 * (Vite's asset handling, the og:image scraper, the user's own eye) reads the extension.
 */
export function imagePath(id: string, contentType: string): string {
  return `/api/cresova-image/${id}.${IMAGE_EXTENSIONS[contentType] ?? 'jpg'}`;
}
