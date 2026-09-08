import { describe, expect, it } from 'vitest';
import {
  findGeneratedImageUrls,
  localFileName,
  localImagePath,
  rewriteGeneratedImageUrls,
} from './generated-images.mjs';

describe('findGeneratedImageUrls', () => {
  it('finds the URL inside an img tag', () => {
    const html = '<img src="https://builder.cresova.com/api/cresova-image/abc123.jpg" alt="hero" />';

    expect(findGeneratedImageUrls(html)).toEqual(['https://builder.cresova.com/api/cresova-image/abc123.jpg']);
  });

  it('finds one inside a CSS url() and inside a bundled JS string', () => {
    const css = '.hero{background-image:url(https://builder.cresova.com/api/cresova-image/abc123.jpg)}';
    const js = 'const hero="https://builder.cresova.com/api/cresova-image/def456.webp";';

    expect(findGeneratedImageUrls(css)).toHaveLength(1);
    expect(findGeneratedImageUrls(js)).toEqual(['https://builder.cresova.com/api/cresova-image/def456.webp']);
  });

  it('returns each URL once, however many times the page uses it', () => {
    const html = Array.from(
      { length: 4 },
      () => '<img src="https://builder.cresova.com/api/cresova-image/abc123.jpg">',
    ).join('');

    expect(findGeneratedImageUrls(html)).toHaveLength(1);
  });

  it('matches whatever host the builder answered on', () => {
    const html = [
      '<img src="https://builder.cresova.com/api/cresova-image/a1.jpg">',
      '<img src="http://localhost:5173/api/cresova-image/b2.png">',
    ].join('');

    expect(findGeneratedImageUrls(html)).toHaveLength(2);
  });

  it("leaves the site's own assets and third-party photos alone", () => {
    const html = [
      '<img src="/assets/logo-a1b2c3.svg">',
      '<img src="https://images.pexels.com/photos/1/a.jpeg">',
      '<img src="https://picsum.photos/seed/cafe/1200/800">',
    ].join('');

    expect(findGeneratedImageUrls(html)).toEqual([]);
  });

  it('returns nothing for a file with no images at all', () => {
    expect(findGeneratedImageUrls('export const x = 1;')).toEqual([]);
  });
});

describe('rewriteGeneratedImageUrls', () => {
  it('points every occurrence at the local copy', () => {
    const url = 'https://builder.cresova.com/api/cresova-image/abc123.jpg';
    const html = `<img src="${url}"><meta property="og:image" content="${url}">`;

    const rewritten = rewriteGeneratedImageUrls(html, new Map([[url, localImagePath(url)]]));

    expect(rewritten).not.toContain('builder.cresova.com');
    expect(rewritten.match(/\/cresova-images\/abc123\.jpg/g)).toHaveLength(2);
  });

  it('leaves a URL that could not be downloaded pointing at the builder', () => {
    /*
     * A site published with a remote URL still works today; the alternative — a local path with
     * no file behind it — is a hole in the page. Only what actually landed on disk is rewritten.
     */
    const downloaded = 'https://builder.cresova.com/api/cresova-image/abc123.jpg';
    const failed = 'https://builder.cresova.com/api/cresova-image/def456.jpg';
    const html = `<img src="${downloaded}"><img src="${failed}">`;

    const rewritten = rewriteGeneratedImageUrls(html, new Map([[downloaded, localImagePath(downloaded)]]));

    expect(rewritten).toContain('/cresova-images/abc123.jpg');
    expect(rewritten).toContain(failed);
  });

  it('returns the content untouched when there is nothing to replace', () => {
    const html = '<img src="/assets/logo.svg">';

    expect(rewriteGeneratedImageUrls(html, new Map())).toBe(html);
  });
});

describe('localFileName', () => {
  it('is the last path segment, which is what the builder stored the bytes under', () => {
    expect(localFileName('https://builder.cresova.com/api/cresova-image/abc123.jpg')).toBe('abc123.jpg');
    expect(localImagePath('https://builder.cresova.com/api/cresova-image/abc123.jpg')).toBe(
      '/cresova-images/abc123.jpg',
    );
  });
});
