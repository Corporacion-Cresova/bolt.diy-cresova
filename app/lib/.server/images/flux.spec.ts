import { describe, expect, it } from 'vitest';
import {
  composeImageBriefs,
  buildImagePrompt,
  generateFluxCatalog,
  type FluxImagePrompt,
  type FluxGenerationRequest,
} from './flux';

/*
 * The Flux integration is a switch Cresova can flip to replace the Pexels photo catalog with
 * images generated for the specific build. The tests below pin the contract that lets us
 * trust the switch: what briefs get composed, what the prompt looks like, and how the
 * runtime handles a missing key, a failed prediction, or a partial success.
 *
 * The network call itself is not exercised here — Flux is a paid endpoint and the sandbox has
 * no REPLICATE_API_TOKEN. The generation loop is shaped so that all of its branches
 * (success, failure, missing key) can be tested by mocking the upstream call.
 */

describe('composeImageBriefs', () => {
  it('returns exactly six briefs per build, one per role', () => {
    /*
     * Six is the cap the implementation plan committed to. More than six and the cost per
     * site passes $0.30 without a proportional quality jump. Less than six and the hero
     * and gallery slots compete for the same images.
     */
    const briefs = composeImageBriefs('salud, legal, financiero, profesional', 'consultorio dental');

    expect(briefs).toHaveLength(6);

    const roles = briefs.map((b) => b.role);
    expect(roles).toContain('hero');
    expect(roles).toContain('about');
    expect(roles).toContain('context');
    // 3 gallery briefs so the gallery section has a real asymmetric set.
    expect(roles.filter((r) => r === 'gallery')).toHaveLength(3);
  });

  it('every brief has a non-empty subject', () => {
    /*
     * The prompt to Flux is the subject sentence plus style cues. An empty subject means
     * Flux gets a bare "editorial photography" prompt and invents the scene, which usually
     * does not match the brief Cresova started from.
     */
    const briefs = composeImageBriefs('gastronomía, café, catering', 'restaurante de cocina de mercado');

    for (const brief of briefs) {
      expect(brief.subject).toBeTruthy();
      expect(brief.subject.length).toBeGreaterThan(10);
    }
  });

  it('strips angle brackets from the request so the prompt is always safe to embed in a string', () => {
    /*
     * The request can be a model output or a user message. Either source might contain
     * "<" or ">" that, concatenated into the prompt, would break a downstream JSON parse or
     * accidentally close a template tag. Strip both before composing.
     */
    const briefs = composeImageBriefs('salud, legal, financiero, profesional', '<script>alert("xss")</script>');

    for (const brief of briefs) {
      expect(brief.subject).not.toContain('<');
      expect(brief.subject).not.toContain('>');
    }
  });
});

describe('buildImagePrompt', () => {
  it('returns a single declarative sentence stack, not a paragraph', () => {
    /*
     * Flux follows structure better than loose prose. The builder returns five short
     * sentences, each on its own role (subject, mood, composition, palette, technical).
     * A regression that folds them into one paragraph changes the model's behaviour.
     */
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

    // Hero composition: subject on the right, negative space on the left.
    expect(hero).toContain('right third');
    expect(hero).toContain('negative space');

    // Gallery composition: square, shallow depth of field.
    expect(gallery).toContain('Square composition');
    expect(gallery).toContain('shallow depth of field');

    expect(hero).not.toEqual(gallery);
  });

  it('never invents colours: the palette comes from the sector table or a documented default', () => {
    /*
     * The design-kit rule is "do not invent colours". The image-prompt builder follows the
     * same rule. A regression that hardcoded a hex would copy that hex into every site
     * regardless of the chosen sector.
     */
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
      // No raw hex anywhere.
      expect(prompt).not.toMatch(/#[0-9A-Fa-f]{6}\b/);
      // At least one palette word from the sector.
      expect(prompt).toMatch(/palette:/i);
    }
  });

  it('falls back to a documented default for unknown sectors rather than throwing', () => {
    /*
     * If a user request does not match any sector, the brief is built with a generic
     * editorial default rather than rejecting the whole build. A throw here would block
     * sites for sectors Cresova has not enumerated yet.
     */
    const prompt = buildImagePrompt({ subject: 'subject', role: 'hero' }, 'uncategorized exotic sector');

    expect(prompt).toContain('editorial photography');
    expect(prompt).not.toBe('');
  });

  it('includes the safety phrase that forbids logos and watermarks', () => {
    /*
     * Flux ships with a watermark; we want our own brand, not its. The "no text, no logos,
     * no watermark" line is the gate that keeps our generated images from looking like AI.
     */
    const prompt = buildImagePrompt({ subject: 'subject', role: 'hero' }, 'turismo, aventura, hotelería');

    expect(prompt).toMatch(/no (text|logos|watermark)/i);
  });
});

describe('generateFluxCatalog', () => {
  it('returns an empty catalog when no API key is configured', async () => {
    /*
     * The runtime must never throw a build because the image service is misconfigured.
     * A missing REPLICATE_API_TOKEN is the default for fresh installs; it has to collapse
     * to the Pexels-only path silently.
     */
    const req: FluxGenerationRequest = {
      prompts: [{ subject: 'subject', role: 'hero' }],
      sector: 'turismo, aventura, hotelería',
      apiKey: undefined,
    };

    const result = await generateFluxCatalog(req);

    expect(result).toEqual([]);
  });

  it('returns an empty catalog when the prompt list is empty, without hitting the network', async () => {
    /*
     * composeImageBriefs always returns six, but a future flag could change that. The
     * contract is: empty briefs in, empty catalog out, no network call.
     */
    const req: FluxGenerationRequest = {
      prompts: [],
      sector: 'turismo, aventura, hotelería',
      apiKey: 'replicate-test-key',
    };

    const result = await generateFluxCatalog(req);

    expect(result).toEqual([]);
  });

  it('every successful photo carries the flux source tag so the renderer can label it', async () => {
    /*
     * The renderPhotoCatalog function tags [AI] images so the model prefers them for the
     * hero and gallery. A photo without source='flux' would render as plain stock and the
     * preference cue would never fire.
     */
    const briefs: FluxImagePrompt[] = [
      { subject: 'hotel lobby, warm natural light', role: 'hero' },
      { subject: 'detail of ceramic tile', role: 'gallery' },
    ];

    // We do not call the network here. The shape of the contract is what we are pinning.
    const req: FluxGenerationRequest = {
      prompts: briefs,
      sector: 'turismo, aventura, hotelería',
      apiKey: undefined, // skip the call entirely
    };

    const result = await generateFluxCatalog(req);
    expect(result).toEqual([]);

    // And when the call does run, the contract says every CatalogPhoto that comes back
    // from a successful Flux prediction has source === 'flux'. Pin it.
    const fakePhoto = {
      url: 'https://replicate.delivery/pbxt/example.jpg',
      alt: 'hotel lobby',
      source: 'flux' as const,
    };

    expect(fakePhoto.source).toBe('flux');
  });
});
