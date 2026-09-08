import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_IMAGE_MODEL,
  composeImageBriefs,
  buildImagePrompt,
  generateOpenRouterCatalog,
  type OpenRouterImagesRequest,
} from './openrouter-images';
import { __resetImageStore, getImage } from './image-store';

/*
 * The OpenRouter image integration is a switch Cresova can flip to replace the Pexels photo
 * catalog with images generated for the specific build. The tests below pin the contract
 * that lets us trust the switch: what briefs get composed, what the prompt looks like, and
 * how the runtime handles a missing key, a failed call, or a partial success.
 *
 * OpenRouter itself is never called — it is a paid endpoint — so the success path is exercised
 * against a stubbed `fetch`. That stub is what earns these tests: the version of this suite that
 * only tested the no-key path asserted the data-URL contract against a literal it wrote itself,
 * and so agreed happily with an implementation that broke every build.
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
    const gallery = buildImagePrompt(
      { subject: 'gallery scene', role: 'gallery' },
      'salud, legal, financiero, profesional',
    );

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
      origin: 'https://builder.cresova.com',
    };

    const result = await generateOpenRouterCatalog(req);

    expect(result.photos).toEqual([]);
  });

  it('returns an empty catalog when the prompt list is empty, without hitting the network', async () => {
    const req: OpenRouterImagesRequest = {
      prompts: [],
      sector: 'turismo, aventura, hotelería',
      apiKey: 'openrouter-test-key',
      origin: 'https://builder.cresova.com',
    };

    const result = await generateOpenRouterCatalog(req);

    expect(result.photos).toEqual([]);
  });

  it('skips generation entirely when there is no origin to serve the images from', async () => {
    /*
     * Without an origin a generated image has no address, and six of them cost $0.24. Skipping
     * before the call rather than after it is the difference between a missing feature and a
     * bill for images no page could ever load.
     */
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await generateOpenRouterCatalog({
      prompts: [{ subject: 'subject', role: 'hero' }],
      sector: 'turismo, aventura, hotelería',
      apiKey: 'openrouter-test-key',
      origin: undefined,
    });

    expect(result.photos).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('generateOpenRouterCatalog, with OpenRouter answering', () => {
  const b64 = btoa('\xff\xd8\xff'.padEnd(512, 'x'));

  beforeEach(() => {
    __resetImageStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function answerWith(payload: unknown, ok = true) {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok,
      status: ok ? 200 : 400,
      json: async () => payload,
    } as Response);
  }

  it('returns a short http URL, never the base64 it received', async () => {
    /*
     * The whole point of the store. A `data:` URL here is what made every build fail with
     * `Custom error: Bad Request`, and it is also something no model could copy into an
     * <img src> even if the request had been accepted.
     */
    answerWith({ data: [{ b64_json: b64, media_type: 'image/jpeg' }] });

    const { photos } = await generateOpenRouterCatalog({
      prompts: [{ subject: 'a hotel reception', role: 'hero' }],
      sector: 'turismo, aventura, hotelería',
      apiKey: 'openrouter-test-key',
      origin: 'https://builder.cresova.com',
    });

    expect(photos[0].url).not.toMatch(/^data:/);
    expect(photos[0].url).toMatch(/^https:\/\/builder\.cresova\.com\/api\/cresova-image\/[0-9a-f]{32}\.jpg$/);
    expect(photos[0].url.length).toBeLessThan(300);
    expect(photos[0].source).toBe('openrouter');
    expect(photos[0].alt).toBe('a hotel reception');
  });

  it('stores the bytes under the id in the URL, so the route can serve them', async () => {
    answerWith({ data: [{ b64_json: b64, media_type: 'image/jpeg' }] });

    const { photos } = await generateOpenRouterCatalog({
      prompts: [{ subject: 'subject', role: 'hero' }],
      sector: 'turismo, aventura, hotelería',
      apiKey: 'openrouter-test-key',
      origin: 'https://builder.cresova.com',
    });

    const id = photos[0].url.split('/').pop()!.replace('.jpg', '');
    expect(getImage(id)?.bytes.byteLength).toBe(512);
  });

  it('does not double the slash when the origin carries a trailing one', async () => {
    answerWith({ data: [{ b64_json: b64, media_type: 'image/jpeg' }] });

    const { photos } = await generateOpenRouterCatalog({
      prompts: [{ subject: 'subject', role: 'hero' }],
      sector: 'turismo, aventura, hotelería',
      apiKey: 'openrouter-test-key',
      origin: 'https://builder.cresova.com/',
    });

    expect(photos[0].url).not.toContain('.com//');
  });

  it('drops the image rather than the build when OpenRouter answers with an error', async () => {
    answerWith({ error: { message: 'quota exceeded', code: 402 } });

    const result = await generateOpenRouterCatalog({
      prompts: [{ subject: 'subject', role: 'hero' }],
      sector: 'turismo, aventura, hotelería',
      apiKey: 'openrouter-test-key',
      origin: 'https://builder.cresova.com',
    });

    expect(result.photos).toEqual([]);
  });

  it('drops the image rather than the build when the payload will not decode', async () => {
    answerWith({ data: [{ b64_json: 'not base64 !!!', media_type: 'image/jpeg' }] });

    const result = await generateOpenRouterCatalog({
      prompts: [{ subject: 'subject', role: 'hero' }],
      sector: 'turismo, aventura, hotelería',
      apiKey: 'openrouter-test-key',
      origin: 'https://builder.cresova.com',
    });

    expect(result.photos).toEqual([]);
  });

  it('assumes jpeg when OpenRouter omits the media type', async () => {
    answerWith({ data: [{ b64_json: b64 }] });

    const { photos } = await generateOpenRouterCatalog({
      prompts: [{ subject: 'subject', role: 'hero' }],
      sector: 'turismo, aventura, hotelería',
      apiKey: 'openrouter-test-key',
      origin: 'https://builder.cresova.com',
    });

    expect(photos[0].url).toMatch(/\.jpg$/);
  });
});

describe('the configured image model', () => {
  /*
   * The bug these two exist for: the model was `black-forest-labs/flux.2-pro`, an id written from
   * memory. OpenRouter serves no Flux model at all, so every request was rejected, the catalog
   * quietly fell back to Pexels, and a client's site shipped with stock photos while every switch
   * in the product said image generation was on.
   *
   * The first test is offline and always runs. The second asks OpenRouter's public catalogue —
   * no key, no cost — and is skipped when the sandbox has no network, so a build without internet
   * does not fail on it.
   */
  it('is an id shaped like something a provider serves', () => {
    expect(DEFAULT_IMAGE_MODEL).toMatch(/^[a-z0-9-]+\/[a-z0-9.-]+$/);
  });

  it('is a model OpenRouter actually serves, and one that outputs images', async () => {
    let catalogue: Response;

    try {
      catalogue = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(15_000) });
    } catch {
      return;
    }

    if (!catalogue.ok) {
      return;
    }

    const body = (await catalogue.json()) as {
      data?: Array<{ id: string; architecture?: { output_modalities?: string[] } }>;
    };

    const found = body.data?.find((model) => model.id === DEFAULT_IMAGE_MODEL);

    expect(found, `OpenRouter does not serve "${DEFAULT_IMAGE_MODEL}"`).toBeTruthy();
    expect(found?.architecture?.output_modalities).toContain('image');
  }, 20_000);
});

describe('when OpenRouter rejects the request', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('carries the reason out instead of only logging it', async () => {
    /*
     * A failure nobody can see is a failure nobody fixes. This is what `/api/health?flux=1` shows
     * and what the build logs as an error, so a wrong model id is one page load away from being
     * diagnosed rather than a whole generation away.
     */
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"error":{"message":"black-forest-labs/flux.2-pro is not a valid model ID"}}',
    } as Response);

    const result = await generateOpenRouterCatalog({
      prompts: [{ subject: 'subject', role: 'hero' }],
      sector: 'turismo, aventura, hotelería',
      apiKey: 'openrouter-test-key',
      origin: 'https://builder.cresova.com',
    });

    expect(result.photos).toEqual([]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].reason).toContain('400');
    expect(result.failures[0].reason).toContain('not a valid model ID');
  });

  it('reports one failure per image, so a partial run is legible', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 402,
      text: async () => 'insufficient credits',
    } as Response);

    const result = await generateOpenRouterCatalog({
      prompts: composeImageBriefs('turismo, aventura, hotelería', 'Crea un sitio para Hotel Casa Fortuna en Roatán'),
      sector: 'turismo, aventura, hotelería',
      apiKey: 'openrouter-test-key',
      origin: 'https://builder.cresova.com',
    });

    expect(result.failures).toHaveLength(6);
    expect(result.failures.every((failure) => failure.reason.includes('402'))).toBe(true);
  });

  it('sends the model override when one is given', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => '',
    } as Response);

    await generateOpenRouterCatalog({
      prompts: [{ subject: 'subject', role: 'hero' }],
      sector: 'turismo, aventura, hotelería',
      apiKey: 'openrouter-test-key',
      model: 'google/gemini-3.1-flash-image',
      origin: 'https://builder.cresova.com',
    });

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.model).toBe('google/gemini-3.1-flash-image');
  });

  it('falls back to the default model when no override is given', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => '',
    } as Response);

    await generateOpenRouterCatalog({
      prompts: [{ subject: 'subject', role: 'hero' }],
      sector: 'turismo, aventura, hotelería',
      apiKey: 'openrouter-test-key',
      origin: 'https://builder.cresova.com',
    });

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.model).toBe(DEFAULT_IMAGE_MODEL);
  });
});
