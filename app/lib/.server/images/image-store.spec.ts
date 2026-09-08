import { beforeEach, describe, expect, it } from 'vitest';
import {
  __resetImageStore,
  getImage,
  imagePath,
  imageStoreStats,
  listImages,
  putImage,
  serveImage,
} from './image-store';

/*
 * The store is what makes generated images usable at all: OpenRouter only ever returns base64,
 * and base64 cannot go in a prompt (see prompt-safe-photos.spec.ts for what happened when it
 * did). These tests pin the contract the rest of the pipeline leans on — an id that addresses
 * real bytes, a bounded footprint, and a refusal that returns null instead of throwing.
 */

const jpegBase64 = (bytes: number) => btoa('\xff\xd8\xff'.padEnd(bytes, 'x'));

/** The id of a stored image, for the tests that only care that it worked. */
const idOf = (result: ReturnType<typeof putImage>) => {
  expect(result.ok, result.ok ? '' : result.reason).toBe(true);

  return (result as { ok: true; id: string }).id;
};

const brief = {
  role: 'hero',
  subject: 'Editorial hero photograph',
  business: 'El Zorzal Express, mensajería en Tegucigalpa',
  prompt: 'Editorial hero photograph. The business: El Zorzal Express, mensajería en Tegucigalpa.',
};

describe('image store', () => {
  beforeEach(() => {
    __resetImageStore();
  });

  it('stores bytes and gives back an id that addresses them', () => {
    const id = idOf(putImage(jpegBase64(64), 'image/jpeg', brief));

    expect(id).toBeTruthy();

    const stored = getImage(id);
    expect(stored?.contentType).toBe('image/jpeg');
    expect(stored?.bytes.byteLength).toBe(64);
  });

  it('gives every image its own id, so a URL never changes what it points at', () => {
    const first = putImage(jpegBase64(64), 'image/jpeg', brief);
    const second = putImage(jpegBase64(64), 'image/jpeg', brief);

    expect(first).not.toBe(second);
  });

  it('returns undefined for an id it does not hold, rather than throwing', () => {
    expect(getImage('not-an-id')).toBeUndefined();
  });

  it('refuses a content type it will not serve', () => {
    expect(putImage(jpegBase64(64), 'text/html', brief).ok).toBe(false);
    expect(putImage(jpegBase64(64), 'image/svg+xml', brief).ok).toBe(false);
  });

  it('refuses a payload that is not valid base64, without throwing', () => {
    expect(putImage('this is not base64 !!!', 'image/jpeg', brief).ok).toBe(false);
  });

  it('refuses an image over the per-image ceiling, and says how big it was', () => {
    const result = putImage(jpegBase64(17 * 1024 * 1024), 'image/jpeg', brief);

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.reason).toMatch(/17 MB.*16 MB/);
  });

  it('accepts a 4-megapixel PNG, which is what an image model actually returns', () => {
    /*
     * The ceiling used to be 6 MB, on the assumption that a Flux frame was a small JPEG. A 4 MP
     * PNG is not, so real images were being refused and the refusal was silent — the photo simply
     * never appeared in the catalog and the build shipped with stock.
     */
    expect(putImage(jpegBase64(12 * 1024 * 1024), 'image/png', brief).ok).toBe(true);
  });

  it('evicts the oldest images rather than growing without a bound', () => {
    /*
     * Seven images of 12 MB is 84 MB against a 64 MB ceiling, so the first ones have to go. The
     * builder runs on workerd with 128 MB; an unbounded cache here would be a way for a busy
     * afternoon to take the whole app down.
     */
    const ids = Array.from({ length: 7 }, () => idOf(putImage(jpegBase64(12 * 1024 * 1024), 'image/jpeg', brief)));

    const stats = imageStoreStats();
    expect(stats.bytes).toBeLessThanOrEqual(stats.limitBytes);

    // the most recent survived, the first did not
    expect(getImage(ids[6])).toBeDefined();
    expect(getImage(ids[0])).toBeUndefined();
  });
});

describe('what the store remembers about each image', () => {
  beforeEach(() => {
    __resetImageStore();
  });

  it('keeps the brief beside the bytes, so the prompt can be read back', () => {
    /*
     * This is what answers «is it generating images of *this* business» rather than just «is it
     * generating images». The prompt is only evidence if it sits next to the picture it made.
     */
    const id = idOf(putImage(jpegBase64(64), 'image/jpeg', brief));

    expect(getImage(id)?.brief).toEqual(brief);
    expect(getImage(id)?.brief.business).toContain('El Zorzal Express');
  });

  it('starts every image at zero hits and counts each time it is served', () => {
    /*
     * Zero hits on an image that exists is the interesting case: generated, paid for, and then
     * left out of the page by the model.
     */
    const id = idOf(putImage(jpegBase64(64), 'image/jpeg', brief));

    expect(getImage(id)?.hits).toBe(0);

    serveImage(id);
    serveImage(id);

    expect(getImage(id)?.hits).toBe(2);
    expect(getImage(id)?.lastHitAt).toBeTruthy();
  });

  it('does not count a diagnostics listing as a hit', () => {
    const id = idOf(putImage(jpegBase64(64), 'image/jpeg', brief));

    listImages();
    getImage(id);

    expect(getImage(id)?.hits).toBe(0);
  });

  it('serving an id it does not hold returns undefined rather than throwing', () => {
    expect(serveImage('not-an-id')).toBeUndefined();
  });

  it('lists what it holds newest first', () => {
    const first = idOf(putImage(jpegBase64(64), 'image/jpeg', { ...brief, role: 'hero' }));
    const second = idOf(putImage(jpegBase64(64), 'image/jpeg', { ...brief, role: 'gallery' }));

    expect(listImages().map((image) => image.id)).toEqual([second, first]);
  });
});

describe('imagePath', () => {
  it('carries the extension in the URL, because everything downstream reads it', () => {
    expect(imagePath('abc123', 'image/jpeg')).toBe('/api/cresova-image/abc123.jpg');
    expect(imagePath('abc123', 'image/png')).toBe('/api/cresova-image/abc123.png');
    expect(imagePath('abc123', 'image/webp')).toBe('/api/cresova-image/abc123.webp');
  });

  it('falls back to .jpg for an unknown type rather than producing an extensionless URL', () => {
    expect(imagePath('abc123', 'image/heic')).toBe('/api/cresova-image/abc123.jpg');
  });

  it('produces a URL short enough to survive the prompt guard', () => {
    const url = `https://builder.cresova.com${imagePath('0123456789abcdef0123456789abcdef', 'image/jpeg')}`;

    expect(url.length).toBeLessThan(300);
  });
});
