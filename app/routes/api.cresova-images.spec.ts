import { beforeEach, describe, expect, it } from 'vitest';
import { loader } from './api.cresova-images';
import { __resetImageStore, putImage, serveImage } from '~/lib/.server/images/image-store';

/*
 * This page exists to answer a question OpenRouter's own dashboard cannot: not «is it generating
 * images» — spend already shows that — but «are they of this client's business, and did the page
 * actually use them». So the tests check that both of those answers are legible on the page.
 */

const jpeg = btoa('\xff\xd8\xff'.padEnd(2048, 'x'));

const brief = (over: Partial<{ role: string; subject: string; business: string; prompt: string }> = {}) => ({
  role: 'hero',
  subject: 'Editorial hero photograph',
  business: 'El Zorzal Express, mensajería en Tegucigalpa',
  prompt: 'Editorial hero photograph. The business: El Zorzal Express, mensajería en Tegucigalpa.',
  ...over,
});

const render = async () => {
  const response = await loader({
    request: new Request('https://builder.cresova.com/api/cresova-images'),
    params: {},
    context: {} as never,
  });

  expect(response.headers.get('Content-Type')).toContain('text/html');

  return response.text();
};

describe('the generated-images page', () => {
  beforeEach(() => {
    __resetImageStore();
  });

  it('says plainly when nothing has been generated, and how to test one', async () => {
    const html = await render();

    expect(html).toContain('No hay imágenes generadas');
    expect(html).toContain('/api/health?flux=1');
  });

  it('shows the business each photo was generated for', async () => {
    putImage(jpeg, 'image/jpeg', brief());

    const html = await render();

    expect(html).toContain('El Zorzal Express');
    expect(html).toContain('hero');
  });

  it('flags a photo whose brief carried no business at all', async () => {
    /*
     * The failure this page was built to make visible: for months five of six briefs never named
     * the business, so the photos were generic stock for the sector and nothing said so.
     */
    putImage(jpeg, 'image/jpeg', brief({ business: '' }));

    const html = await render();

    expect(html).toContain('sin negocio en el brief');
  });

  it('distinguishes a photo the page used from one the model ignored', async () => {
    const used = putImage(jpeg, 'image/jpeg', brief({ role: 'hero' }))!;
    putImage(jpeg, 'image/jpeg', brief({ role: 'gallery' }));

    serveImage(used);

    const html = await render();

    expect(html).toContain('servida 1 vez');
    expect(html).toContain('nunca servida');
  });

  it('shows the exact prompt that produced each photo', async () => {
    putImage(jpeg, 'image/jpeg', brief({ prompt: 'A very particular prompt, sent verbatim to Flux.' }));

    const html = await render();

    expect(html).toContain('A very particular prompt, sent verbatim to Flux.');
  });

  it('points every image at an absolute URL on this origin', async () => {
    putImage(jpeg, 'image/jpeg', brief());

    const html = await render();

    expect(html).toMatch(/src="https:\/\/builder\.cresova\.com\/api\/cresova-image\/[0-9a-f]{32}\.jpg"/);
  });

  it('escapes what it prints, since the brief carries text from the request', async () => {
    putImage(jpeg, 'image/jpeg', brief({ business: 'Taller "El Martillo" & Cía <script>alert(1)</script>' }));

    const html = await render();

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });

  it('does not count its own listing as the photos having been served', async () => {
    putImage(jpeg, 'image/jpeg', brief());

    await render();

    const html = await render();

    expect(html).toContain('nunca servida');
  });
});
