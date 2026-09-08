import type { LoaderFunctionArgs } from '@remix-run/cloudflare';
import { imagePath, imageStoreStats, listImages } from '~/lib/.server/images/image-store';

/**
 * What the image generator actually produced, and whether the page used it.
 *
 * «La API sí está haciendo solicitudes» is the easy half of the question. The hard half is the
 * one this page answers: are the photos *of this client's business*, and did any of them reach
 * the page. Both were invisible — OpenRouter's dashboard shows spend, not subject, and a photo
 * that is generated, paid for and then ignored by the model looks exactly like a photo that was
 * used.
 *
 * So each row shows the picture, the exact prompt that produced it, and how many times the bytes
 * have been served. Read it like this:
 *
 *   - «El negocio» empty on every row → the request never reached the brief, and every photo is
 *     generic stock for the sector.
 *   - Servida 0 veces → the model left that photo out of the page.
 *   - The picture does not match the prompt → Flux is the problem, and the prompt is right there
 *     to adjust.
 *
 * HTML rather than JSON on purpose: the point is to look at the photographs.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const images = listImages();
  const stats = imageStoreStats();
  const origin = new URL(request.url).origin;

  const escape = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const time = (value: string) => new Date(value).toLocaleString('es-HN', { dateStyle: 'short', timeStyle: 'medium' });

  const rows = images
    .map((image) => {
      const url = `${origin}${imagePath(image.id, image.contentType)}`;
      const used =
        image.hits > 0
          ? `<span class="ok">servida ${image.hits} ${image.hits === 1 ? 'vez' : 'veces'}</span>`
          : '<span class="warn">nunca servida — el modelo no la puso en la página</span>';

      return `
      <article>
        <a href="${escape(url)}" target="_blank" rel="noreferrer"><img src="${escape(url)}" alt="${escape(image.brief.subject)}" loading="lazy"></a>
        <div class="meta">
          <h2>${escape(image.brief.role)}</h2>
          <p class="business">${image.brief.business ? escape(image.brief.business) : '<em>sin negocio en el brief — la foto salió genérica del rubro</em>'}</p>
          <p class="state">${used}${image.lastHitAt ? ` · última vez ${escape(time(image.lastHitAt))}` : ''}</p>
          <p class="state">${Math.round(image.bytes.byteLength / 1024)} KB · ${escape(image.contentType)} · generada ${escape(time(image.createdAt))}</p>
          <details><summary>Prompt enviado a Flux</summary><pre>${escape(image.brief.prompt)}</pre></details>
        </div>
      </article>`;
    })
    .join('\n');

  const empty = `
    <p class="empty">
      No hay imágenes generadas en esta instancia todavía. Se vacía en cada redeploy — eso es
      normal: viven en memoria. Generá un sitio, o probá una sola con
      <a href="/api/health?flux=1">/api/health?flux=1</a> ($0.04).
    </p>`;

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Imágenes generadas · Cresova Builder</title>
  <style>
    :root { color-scheme: light dark; --line: color-mix(in srgb, currentColor 15%, transparent); }
    body { margin: 0; padding: 2rem 1.5rem 4rem; font: 15px/1.55 ui-sans-serif, system-ui, sans-serif; max-width: 1100px; margin-inline: auto; }
    h1 { font-size: 1.4rem; margin: 0 0 .25rem; }
    .summary { opacity: .7; margin: 0 0 2rem; font-size: .9rem; }
    article { display: grid; grid-template-columns: 260px 1fr; gap: 1.25rem; padding: 1.25rem 0; border-top: 1px solid var(--line); }
    @media (max-width: 700px) { article { grid-template-columns: 1fr; } }
    img { width: 100%; border-radius: 8px; display: block; background: var(--line); }
    h2 { font-size: .8rem; text-transform: uppercase; letter-spacing: .06em; opacity: .6; margin: 0 0 .4rem; }
    .business { font-size: 1.05rem; margin: 0 0 .6rem; }
    .state { font-size: .85rem; opacity: .75; margin: 0 0 .3rem; }
    .ok { color: #17803d; font-weight: 600; }
    .warn { color: #b45309; font-weight: 600; }
    @media (prefers-color-scheme: dark) { .ok { color: #4ade80; } .warn { color: #fbbf24; } }
    details { margin-top: .6rem; font-size: .85rem; }
    summary { cursor: pointer; opacity: .7; }
    pre { white-space: pre-wrap; opacity: .8; background: var(--line); padding: .75rem; border-radius: 6px; margin: .5rem 0 0; }
    .empty { opacity: .7; }
  </style>
</head>
<body>
  <h1>Imágenes generadas</h1>
  <p class="summary">
    ${stats.count} en memoria · ${Math.round(stats.bytes / 1024 / 1024)} MB de ${Math.round(stats.limitBytes / 1024 / 1024)} MB ·
    <a href="/api/health">/api/health</a>
  </p>
  ${images.length ? rows : empty}
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
