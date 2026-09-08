import { describe, expect, it } from 'vitest';
import { keepPromptSafePhotos } from './prompt-safe-photos';
import type { CatalogPhoto } from './pexels';

/*
 * This is the regression test for the failure that took the builder down the day image
 * generation was switched on: every build ended in `Custom error: Bad Request`.
 *
 * The cause was six generated images entering the system prompt as `data:` URLs. Each one is
 * hundreds of kilobytes of base64, and the request that carried them was rejected by OpenRouter
 * before it reached a model — with a body the AI SDK could not parse, so the message users saw
 * was just the HTTP status text.
 *
 * The tests below pin the boundary rather than the symptom: whatever produces a photo, only
 * something a model can copy into an <img src> is allowed into a prompt.
 */

const photo = (url: string): CatalogPhoto => ({ url, alt: 'a photo' });

describe('keepPromptSafePhotos', () => {
  it('drops a data: URL, however small', () => {
    const kept = keepPromptSafePhotos([photo('data:image/jpeg;base64,/9j/4AAQSkZJRg==')]);

    expect(kept).toEqual([]);
  });

  it('drops the six-image data: URL catalog that produced Bad Request', () => {
    /*
     * Six 400 KB JPEGs, base64-encoded. Reproduced at a hundredth of the size — the point is the
     * shape, and a real 3 MB fixture would only slow the suite down.
     */
    const oneImage = `data:image/jpeg;base64,${'A'.repeat(4000)}`;
    const catalog = Array.from({ length: 6 }, () => photo(oneImage));

    const kept = keepPromptSafePhotos(catalog);

    expect(kept).toEqual([]);
  });

  it('keeps a Pexels URL', () => {
    const url = 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=1260';

    expect(keepPromptSafePhotos([photo(url)])).toHaveLength(1);
  });

  it('keeps a generated-image URL served by this app', () => {
    const url = 'https://builder.cresova.com/api/cresova-image/0123456789abcdef0123456789abcdef.jpg';

    expect(keepPromptSafePhotos([photo(url)])).toHaveLength(1);
  });

  it('drops an http(s) URL that is still too long to be copied verbatim', () => {
    const url = `https://example.com/${'a'.repeat(400)}.jpg`;

    expect(keepPromptSafePhotos([photo(url)])).toEqual([]);
  });

  it('keeps the safe photos when the catalog is mixed, rather than failing the whole list', () => {
    const kept = keepPromptSafePhotos([
      photo('data:image/jpeg;base64,AAAA'),
      photo('https://images.pexels.com/photos/1/a.jpeg'),
      photo(''),
      photo('https://builder.cresova.com/api/cresova-image/abc.jpg'),
      photo('//images.pexels.com/photos/2/b.jpeg'),
    ]);

    expect(kept.map((entry) => entry.url)).toEqual([
      'https://images.pexels.com/photos/1/a.jpeg',
      'https://builder.cresova.com/api/cresova-image/abc.jpg',
    ]);
  });
});
