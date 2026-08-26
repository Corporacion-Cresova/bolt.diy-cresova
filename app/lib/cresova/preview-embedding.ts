/**
 * Whether the browser can actually put this preview inside the builder's frame — measured, not
 * reasoned about.
 *
 * This exact failure has now been diagnosed twice from the outside and got it half right both
 * times, because a blocked frame and a dead server look identical from the builder: Chrome paints
 * "refused to connect" for each. The readings that tell them apart are the response status and two
 * headers, and neither is visible to anything in the workbench — an iframe of another origin
 * reports nothing at all about what it loaded.
 *
 * So: fetch the preview from the page, the same way the frame would, and report what came back.
 * The runner exposes the two headers through `access-control-expose-headers` for this and nothing
 * else. Reading them here also covers the gateway in front of the runner, which is the one part of
 * the path that could strip a header the service really did send.
 */
export interface PreviewEmbedding {
  url: string;
  status?: number;
  embedderPolicy?: string;
  resourcePolicy?: string;

  /** why the fetch itself failed, when it did */
  error?: string;

  /** what the builder page requires of a framed document, so the verdict can be read on its own */
  builderIsIsolated: boolean;
}

const CHECK_TIMEOUT_MS = 8000;

/**
 * A document that sets no embedder policy imposes no condition on what it frames. That is the state
 * the builder is in whenever the runner is configured, and `crossOriginIsolated` is the browser's
 * own answer for whether it is — a truer reading than re-deriving it from configuration.
 */
function builderIsIsolated(): boolean {
  return typeof window !== 'undefined' && Boolean((window as { crossOriginIsolated?: boolean }).crossOriginIsolated);
}

export async function checkPreviewEmbedding(url: string): Promise<PreviewEmbedding> {
  const isolated = builderIsIsolated();

  if (typeof fetch !== 'function') {
    return { url, builderIsIsolated: isolated, error: 'este navegador no puede comprobarlo' };
  }

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(url, { method: 'GET', mode: 'cors', signal: abort.signal });

    return {
      url,
      status: response.status,
      embedderPolicy: response.headers.get('cross-origin-embedder-policy') ?? undefined,
      resourcePolicy: response.headers.get('cross-origin-resource-policy') ?? undefined,
      builderIsIsolated: isolated,
    };
  } catch (error) {
    return {
      url,
      builderIsIsolated: isolated,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The verdict, in the terms the failure is actually reported in.
 *
 * Only a builder that sets an embedder policy imposes conditions on what it frames; without one,
 * any reachable preview embeds. With one, both headers have to be there, and satisfying only the
 * resource policy — which is what shipped first, and what left this looking broken for a whole
 * round — still gets the frame refused.
 */
export function describePreviewEmbedding(check: PreviewEmbedding): string[] {
  const lines = ['VISTA PREVIA, VISTA DESDE EL NAVEGADOR', `  ${check.url}`];

  if (check.error) {
    lines.push(`  no se pudo consultar: ${check.error}`);
    lines.push('  o el servidor no contesta, o algo en el camino corta la petición');

    return lines;
  }

  lines.push(`  contestó: ${check.status}`);
  lines.push(`  cross-origin-embedder-policy: ${check.embedderPolicy ?? 'ninguna'}`);
  lines.push(`  cross-origin-resource-policy: ${check.resourcePolicy ?? 'ninguna'}`);
  lines.push(`  el builder exige política de incrustación: ${check.builderIsIsolated ? 'sí' : 'no'}`);

  if (!check.builderIsIsolated) {
    lines.push('  se puede incrustar: sí — el builder no impone ninguna condición');
    return lines;
  }

  const embedderOk = check.embedderPolicy === 'require-corp' || check.embedderPolicy === 'credentialless';
  const resourceOk = check.resourcePolicy === 'cross-origin';

  if (embedderOk && resourceOk) {
    lines.push('  se puede incrustar: sí');
  } else if (resourceOk && !embedderOk) {
    lines.push('  se puede incrustar: NO — falta su propia cabecera de incrustación, no basta con la de recurso');
  } else if (embedderOk && !resourceOk) {
    lines.push('  se puede incrustar: NO — falta la cabecera de recurso');
  } else {
    lines.push('  se puede incrustar: NO — no manda ninguna de las dos');
  }

  return lines;
}
