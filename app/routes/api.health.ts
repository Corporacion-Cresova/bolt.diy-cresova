import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import versionInfo from '~/version.json';
import { generateOpenRouterCatalog } from '~/lib/.server/images/openrouter-images';
import { imageStoreStats } from '~/lib/.server/images/image-store';
import { getMonthTotal, getTodayTotal, type DailyTotal } from '~/lib/modules/llm/cost-tracker';
import { DEFAULT_IMAGE_MODEL, OPENROUTER_IMAGE_MODELS_ENDPOINT } from '~/lib/.server/images/openrouter-images';
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
  const imagesModel = serverEnv?.OPENROUTER_IMAGES_MODEL ?? process.env.OPENROUTER_IMAGES_MODEL ?? DEFAULT_IMAGE_MODEL;

  const env = {
    /*
     * Whether the variable ARRIVED, never its value. A variable can be set in the panel and still
     * not reach here: bindings.sh only passes the names it finds in worker-configuration.d.ts.
     */
    CRESOVA_IMAGES_ENABLED: serverEnv?.CRESOVA_IMAGES_ENABLED ?? process.env.CRESOVA_IMAGES_ENABLED ?? null,
    OPENROUTER_IMAGES_KEY: imagesKey ? 'presente' : null,
    OPENROUTER_IMAGES_MODEL: serverEnv?.OPENROUTER_IMAGES_MODEL ?? process.env.OPENROUTER_IMAGES_MODEL ?? null,
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
    prueba: undefined as undefined | { ok: boolean; detalle: string; url?: string },

    /*
     * The generated images this instance is currently holding. Empty right after a redeploy and
     * that is expected: the store is memory-backed, so a restart drops it. What it is here to
     * catch is the opposite — a count that sits at the ceiling, meaning eviction is doing the
     * work and previews from earlier in the day have started losing their photos.
     */
    modelo: imagesModel,

    /*
     * Whether OpenRouter's image catalogue lists the configured model.
     *
     * The first version of this checked `/api/v1/models` — the *chat* catalogue — and so reported
     * a perfectly working Flux model as nonexistent. Image models live at a different endpoint
     * entirely. A check pointed at the wrong source of truth is worse than no check, because it
     * is confidently wrong; this one now shares its endpoint with the test that covers it.
     */
    modeloValido: undefined as undefined | { ok: boolean; detalle: string },

    cache: imageStoreStats(),

    /** Where to look at what was generated, and at the prompt that produced each one. */
    galeria: '/api/cresova-images',
  };

  try {
    const catalogue = await fetch(OPENROUTER_IMAGE_MODELS_ENDPOINT, { signal: AbortSignal.timeout(8000) });

    if (catalogue.ok) {
      const body = (await catalogue.json()) as { data?: Array<{ id: string }> };

      images.modeloValido = body.data?.some((model) => model.id === imagesModel)
        ? { ok: true, detalle: 'OpenRouter lo lista en su catálogo de imágenes' }
        : {
            ok: false,
            detalle: `el catálogo de imágenes de OpenRouter no lista "${imagesModel}" — revisá OPENROUTER_IMAGES_MODEL`,
          };
    }
  } catch {
    // a catalogue that does not answer says nothing about our configuration, so it says nothing
  }

  if (url.searchParams.get('flux') === '1' && images.listo) {
    const started = Date.now();

    try {
      const generated = await generateOpenRouterCatalog({
        prompts: [
          {
            subject: 'A single ripe coffee cherry on the branch, morning light',
            role: 'gallery',
            business: 'prueba de salud, no es un sitio real',
          },
        ],
        sector: 'Turismo, aventura, hotelería',
        apiKey: imagesKey,
        model: imagesModel,
        origin: url.origin,
      });

      images.prueba = generated.photos.length
        ? {
            ok: true,
            detalle: `imagen generada en ${Date.now() - started} ms — abrí la url para verla`,
            url: generated.photos[0].url,
          }
        : {
            ok: false,

            /*
             * The reason, not «no salió». The one time this mattered it was a model id OpenRouter
             * does not serve, and the only trace was a log line inside the container.
             */
            detalle: generated.failures[0]?.reason ?? 'la llamada terminó sin imagen y sin motivo',
          };
    } catch (error) {
      logger.error('Flux smoke test failed', error);
      images.prueba = { ok: false, detalle: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Lo gastado, en el formato en que se lee: lempiras primero.
   *
   * Se cuenta en memoria del proceso, así que un redeploy lo pone en cero. Eso se dice abajo, en
   * vez de dejar que un total bajo se lea como un día barato.
   */
  const gasto = (total: DailyTotal) => ({
    lempiras: Number(total.hnl.toFixed(2)),
    dolares: Number(total.usd.toFixed(4)),
    generaciones: total.generations,
    imagenes: total.images,
    imagenesDolares: Number(total.imagesUsd.toFixed(4)),
    tokens: { entrada: total.tokensInput, salida: total.tokensOutput },

    /*
     * Cuando esto no es cero, el total de arriba es un piso y no el gasto real: hubo generaciones
     * con un modelo que no está en la tabla de precios.
     */
    generacionesSinPrecio: total.unpricedGenerations,
  });

  const hoy = getTodayTotal();
  const mes = getMonthTotal();

  return json({
    status: 'healthy',
    version: `v${versionInfo.version} build ${versionInfo.build}`,
    versionDate: versionInfo.date,
    timestamp: new Date().toISOString(),
    env,
    images,
    gasto: {
      hoy: { fecha: hoy.date, ...gasto(hoy) },
      mes: { periodo: mes.date, ...gasto(mes) },
      nota:
        'Se cuenta en memoria del proceso y arranca de cero en cada redeploy. ' +
        'El día cierra en hora de Honduras, no UTC. La facturación de OpenRouter es la verdad.',
    },
  });
};
