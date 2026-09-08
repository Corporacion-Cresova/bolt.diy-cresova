import type { LoaderFunctionArgs } from '@remix-run/cloudflare';
import { serveImage } from '~/lib/.server/images/image-store';

/**
 * Serves an image generated for a build.
 *
 * These URLs are written by the model into the generated site's `<img src>`, so they are fetched
 * from three different places: the preview running on the runner, the published site, and the
 * runner's own screenshot browser. All three are cross-origin to this app, hence the open CORS
 * header — the response is a public image that was already going to be embedded in a public page.
 *
 * Cached hard and immutable because the id is content-addressed by construction: a new generation
 * gets a new id, so a URL's bytes never change.
 */
export async function loader({ params }: LoaderFunctionArgs) {
  const id = (params.id ?? '').replace(/\.(jpg|jpeg|png|webp)$/i, '');

  const image = id ? serveImage(id) : undefined;

  if (!image) {
    /*
     * A miss is expected rather than exceptional: the store is memory-backed, so every image is
     * gone after a builder restart. Plain text rather than a JSON error because whatever asked
     * for this was an <img> tag, and it will render a broken-image icon either way.
     */
    return new Response('Esta imagen ya no está disponible.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  return new Response(image.bytes, {
    status: 200,
    headers: {
      'Content-Type': image.contentType,
      'Content-Length': String(image.bytes.byteLength),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
