import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import versionInfo from '~/version.json';
import { generateOpenRouterCatalog } from '~/lib/.server/images/openrouter-images';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.health');

/**
 * What is actually running, and whether the parts that fail silently are alive.
 *
 * Two of them had already failed silently for weeks: image generation shipped switched off
 * because its variables never reached the runtime, and the build number in the header froze on
 * a date in August because the hook that bumps it does not run when commits are made outside a
 * developer's machine. Both looked configured from the outside. This is the page that answers
 * «is the thing I just deployed the thing that is running, and does it work» without spending a
 * generation to find out.
 *
 * Free by default. `?flux=1` spends four cents on one real image, which is the only way to know
 * the key has image credit and the endpoint answers the way the client expects.
 */
export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const serverEnv = context.cloudflare?.env as unknown as Record<string, string | undefined> | undefined;
  const url = new URL(request.url);

  const imagesEnabled = (serverEnv?.CRESOVA_IMAGES_ENABLED ?? process.env.CRESOVA_IMAGES_ENABLED) === 'true';
  const imagesKey = serverEnv?.OPENROUTER_IMAGES_KEY ?? process.env.OPENROUTER_IMAGES_KEY;

  const env = {
    /*
     * Whether the variable ARRIVED, never its value. A variable can be set in the panel and still
     * not reach here: bindings.sh only passes the names it finds in worker-configuration.d.ts.
     */
    CRESOVA_IMAGES_ENABLED: serverEnv?.CRESOVA_IMAGES_ENABLED ?? process.env.CRESOVA_IMAGES_ENABLED ?? null,
    OPENROUTER_IMAGES_KEY: imagesKey ? 'presente' : null,
    OPEN_ROUTER_API_KEY: (serverEnv?.OPEN_ROUTER_API_KEY ?? process.env.OPEN_ROUTER_API_KEY) ? 'presente' : null,
    PEXELS_API_KEY: (serverEnv?.PEXELS_API_KEY ?? process.env.PEXELS_API_KEY) ? 'presente' : null,
    RUNNER_URL: serverEnv?.RUNNER_URL ?? process.env.RUNNER_URL ?? null,
  };

  const images = {
    habilitado: imagesEnabled,
    llave: Boolean(imagesKey),
    listo: imagesEnabled && Boolean(imagesKey),
    diagnostico: !imagesEnabled
      ? 'CRESOVA_IMAGES_ENABLED no llegó al runtime o no vale exactamente "true"'
      : !imagesKey
        ? 'OPENROUTER_IMAGES_KEY no llegó al runtime'
        : 'listo — agregá ?flux=1 para gastar $0.04 y probar una imagen de verdad',
    prueba: undefined as undefined | { ok: boolean; detalle: string },
  };

  if (url.searchParams.get('flux') === '1' && images.listo) {
    const started = Date.now();

    try {
      const generated = await generateOpenRouterCatalog({
        prompts: [{ subject: 'A single ripe coffee cherry on the branch, morning light', role: 'gallery' }],
        sector: 'Turismo, aventura, hotelería',
        apiKey: imagesKey,
      });

      images.prueba = generated.length
        ? { ok: true, detalle: `imagen generada en ${Date.now() - started} ms` }
        : { ok: false, detalle: 'la llamada terminó sin imagen — revisá los logs del servicio' };
    } catch (error) {
      logger.error('Flux smoke test failed', error);
      images.prueba = { ok: false, detalle: error instanceof Error ? error.message : String(error) };
    }
  }

  return json({
    status: 'healthy',
    version: `v${versionInfo.version} build ${versionInfo.build}`,
    versionDate: versionInfo.date,
    timestamp: new Date().toISOString(),
    env,
    images,
  });
};
