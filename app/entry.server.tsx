import type { AppLoadContext } from '@remix-run/cloudflare';
import { RemixServer } from '@remix-run/react';
import { isbot } from 'isbot';
import { renderToReadableStream } from 'react-dom/server';
import { renderHeadToString } from 'remix-island';
import { Head } from './root';
import { themeStore } from '~/lib/stores/theme';

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: any,
  loadContext: AppLoadContext,
) {
  // await initializeModelList({});

  const readable = await renderToReadableStream(<RemixServer context={remixContext} url={request.url} />, {
    signal: request.signal,
    onError(error: unknown) {
      console.error(error);
      responseStatusCode = 500;
    },
  });

  const body = new ReadableStream({
    start(controller) {
      const head = renderHeadToString({ request, remixContext, Head });

      controller.enqueue(
        new Uint8Array(
          new TextEncoder().encode(
            `<!DOCTYPE html><html lang="en" data-theme="${themeStore.value}"><head>${head}</head><body><div id="root" class="w-full h-full">`,
          ),
        ),
      );

      const reader = readable.getReader();

      function read() {
        reader
          .read()
          .then(({ done, value }) => {
            if (done) {
              controller.enqueue(new Uint8Array(new TextEncoder().encode('</div></body></html>')));
              controller.close();

              return;
            }

            controller.enqueue(value);
            read();
          })
          .catch((error) => {
            controller.error(error);
            readable.cancel();
          });
      }
      read();
    },

    cancel() {
      readable.cancel();
    },
  });

  if (isbot(request.headers.get('user-agent') || '')) {
    await readable.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');

  /*
   * Cross-origin isolation exists here for exactly one reason: WebContainer needs
   * `SharedArrayBuffer`, and `SharedArrayBuffer` needs it. Nothing else on the page does.
   *
   * It is not free. Under `require-corp` the preview iframe — served by the runner on
   * `*.preview.<domain>`, a different origin — has to satisfy the embedder policy too, and every
   * way of satisfying it costs something (see the `EMBEDDABLE` comment in `runner/src/index.mjs`).
   * With `RUNNER_URL` configured the projects run on the VPS and WebContainer is a fallback, so
   * the isolation is being paid for by the path that is actually used, on behalf of the one that
   * is not. Dropping it there lets any browser embed the preview with no conditions at all.
   *
   * The trade is stated plainly: in a deployment with `RUNNER_URL` set, if the runner is
   * unreachable the WebContainer fallback cannot boot either. The header badge
   * (`BackendBadge.tsx`) and `runnerFailureStore` already say which backend is live and why.
   */
  // read the same way `app/routes/api.runner-ticket.ts` reads it, so both agree on what "configured" means
  const runnerConfigured = Boolean(loadContext?.cloudflare?.env?.RUNNER_URL || process.env.RUNNER_URL);

  if (!runnerConfigured) {
    responseHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
    responseHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
  }

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
