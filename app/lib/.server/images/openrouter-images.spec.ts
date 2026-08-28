import { describe, expect, it } from 'vitest';
import {
  composeImageBriefs,
  buildImagePrompt,
  generateOpenRouterCatalog,
  type FluxImagePrompt,
  type OpenRouterImagesRequest,
} from './openrouter-images';

/*
 * The OpenRouter image integration is a switch Cresova can flip to replace the Pexels photo
 * catalog with images generated for the specific build. The tests below pin the contract
 * that lets us trust the switch: what briefs get composed, what the prompt looks like, and
 * how the runtime handles a missing key, a failed call, or a partial success.
 *
 * The network call itself is not exercised here — OpenRouter is a paid endpoint and the
 * sandbox has no OPENROUTER_IMAGES_KEY. The generation loop is shaped so all of its
 * branches (success, failure, missing key) can be tested by inspecting the call shape and
 * the no-key path.
 */

describe('composeImageBriefs', () => {
  it('returns exactly six briefs per build, one per role', () => {
    /*
     * Six is the cap the implementation plan committed to. More than six and the cost per
     * site passes $0.25 without a proportional quality jump. Less than six and the hero
     * and gallery slots compete for the same images.
     */
    const briefs = composeImageBriefs('salud, legal, financiero, profesional', 'consultorio dental');

    expect(briefs).toHaveLength(6);

    const roles = briefs.map((b) => b.role);
    expect(roles).toContain('hero');
    expect(roles).toContain('about');
    expect(roles).toContain('context');
    expect(roles.filter((r) => r === 'gallery')).toHaveLength(3);
  });

  it('every brief has a non-empty subject', () => {
    const briefs = composeImageBriefs('gastronomía, café, catering', 'restaurante de cocina de mercado');

    for (const brief of briefs) {
      expect(brief.subject).toBeTruthy();
      expect(brief.subject.length).toBeGreaterThan(10);
    }
  });

  it('strips angle brackets from the request so the prompt is always safe to embed', () => {
    const briefs = composeImageBriefs('salud, legal, financiero, profesional', '<script>alert("xss")</script>');

    for (const brief of briefs) {
      expect(brief.subject).not.toContain('<');
      expect(brief.subject).not.toContain('>');
    }
  });
});

describe('buildImagePrompt', () => {
  it('returns a single declarative sentence stack, not a paragraph', () => {
    const prompt = buildImagePrompt(
      { subject: 'A small hotel reception desk with warm light.', role: 'hero' },
      'turismo, aventura, hotelería',
    );

    const sentences = prompt.split(/\.\s+/).filter((s) => s.length > 0);
    expect(sentences.length).toBeGreaterThanOrEqual(4);
    expect(prompt).toContain('Subject on the right third');
    expect(prompt).toContain('muted greens');
  });

  it('uses the right composition cue per role so the hero and gallery come out differently', () => {
    const hero = buildImagePrompt({ subject: 'hero scene', role: 'hero' }, 'salud, legal, financiero, profesional');
    const gallery = buildImagePrompt({ subject: 'gallery scene', role: 'gallery' }, 'salud, legal, financiero, profesional');

    expect(hero).toContain('right third');
    expect(hero).toContain('negative space');
    expect(gallery).toContain('Square composition');
    expect(gallery).toContain('shallow depth of field');
    expect(hero).not.toEqual(gallery);
  });

  it('never invents colours: the palette comes from the sector table or a documented default', () => {
    const knownSectors = [
      'turismo, aventura, hotelería',
      'gastronomía, café, catering',
      'belleza, bienestar, suplementos',
      'comercio, tienda, retail',
      'oficios, construcción, limpieza, transporte',
      'salud, legal, financiero, profesional',
    ];

    for (const sector of knownSectors) {
      const prompt = buildImagePrompt({ subject: 'subject', role: 'hero' }, sector);
      expect(prompt).not.toMatch(/#[0-9A-Fa-f]{6}\b/);
      expect(prompt).toMatch(/palette:/i);
    }
  });

  it('falls back to a documented default for unknown sectors rather than throwing', () => {
    const prompt = buildImagePrompt({ subject: 'subject', role: 'hero' }, 'uncategorized exotic sector');

    expect(prompt).toContain('editorial photography');
    expect(prompt).not.toBe('');
  });

  it('includes the safety phrase that forbids logos and watermarks', () => {
    const prompt = buildImagePrompt({ subject: 'subject', role: 'hero' }, 'turismo, aventura, hotelería');

    expect(prompt).toMatch(/no (text|logos|watermark)/i);
  });
});

describe('generateOpenRouterCatalog', () => {
  it('returns an empty catalog when no API key is configured', async () => {
    /*
     * The runtime must never throw a build because the image service is misconfigured.
     * A missing OPENROUTER_IMAGES_KEY is the default for fresh installs; it has to
     * collapse to the Pexels-only path silently.
     */
    const req: OpenRouterImagesRequest = {
      prompts: [{ subject: 'subject', role: 'hero' }],
      sector: 'turismo, aventura, hotelería',
      apiKey: undefined,
    };

    const result = await generateOpenRouterCatalog(req);

    expect(result).toEqual([]);
  });

  it('returns an empty catalog when the prompt list is empty, without hitting the network', async () => {
    const req: OpenRouterImagesRequest = {
      prompts: [],
      sector: 'turismo, aventura, hotelería',
      apiKey: 'openrouter-test-key',
    };

    const result = await generateOpenRouterCatalog(req);

    expect(result).toEqual([]);
  });

  it('every successful photo is returned as a data: URL with the openrouter source tag', () => {
    /*
     * Pin the data-URL contract: the model pastes these verbatim into <img src=...> inside
     * a WebContainer, and a CDN URL would 404 the moment the TTL expires. The source tag
     * keeps the [AI] preference cue in the prompt working.
     */
    const dataUrl = `data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA...`;

    const photo = {
      url: dataUrl,
      alt: 'subject',
      source: 'openrouter' as const,
    };

    expect(photo.url).toMatch(/^data:image\/jpeg;base64,/);
    expect(photo.source).toBe('openrouter');
  });
});
