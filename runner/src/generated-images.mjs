/**
 * Finding and rewriting the URLs of AI-generated photos inside a built site.
 *
 * A generated photo is served by the builder from an in-memory cache — OpenRouter returns images
 * only as base64, and the builder runs on workerd, which has no disk. That is fine for a preview,
 * which lives half an hour. It is not fine for a published site: the cache is dropped every time
 * the builder is redeployed, so a client's demo would quietly lose its photos days later with
 * nothing in any log to say why.
 *
 * The published directory does not have that problem — it survives restarts and reaping, and it
 * is already how the site's own assets are served. So publishing is the moment to copy the photos
 * in and point the pages at the local copies.
 *
 * These two functions are pure so the matching can be tested without a filesystem or a network;
 * `projects.mjs` does the downloading around them.
 */

/**
 * Matches a URL served by the builder's generated-image route, on any host.
 *
 * Any host on purpose: the builder is reachable under more than one name (the panel's own
 * hostname, the public domain, localhost during development), and which one ends up in the page
 * depends on how the request that generated it arrived. Matching the path is what identifies
 * these; the host is not ours to predict.
 */
const GENERATED_IMAGE_URL = /https?:\/\/[^\s"'`)<>\\]+\/api\/cresova-image\/[A-Za-z0-9]+\.(?:jpg|jpeg|png|webp)/g;

/** Where the copies live inside the published directory. */
export const LOCAL_IMAGE_DIR = 'cresova-images';

/** The file extensions worth scanning. A URL only ever reaches a site through one of these. */
export const TEXT_ASSET_PATTERN = /\.(html|js|mjs|css|json|txt|xml|svg)$/i;

/** Every distinct generated-image URL in a file, in the order they first appear. */
export function findGeneratedImageUrls(content) {
  return [...new Set(content.match(GENERATED_IMAGE_URL) ?? [])];
}

/** The file name a URL's bytes are stored under, which is the last segment of its path. */
export function localFileName(url) {
  return url.split('/').pop();
}

/** The path a localised image is served at, relative to the published site's root. */
export function localImagePath(url) {
  return `/${LOCAL_IMAGE_DIR}/${localFileName(url)}`;
}

/**
 * Replaces every URL in `replacements` with its local path.
 *
 * `split`/`join` rather than a regular expression: these URLs come from the page, not from us, so
 * treating them as literals is the only way to be sure a character inside one is never read as
 * syntax.
 */
export function rewriteGeneratedImageUrls(content, replacements) {
  let rewritten = content;

  for (const [url, localPath] of replacements) {
    rewritten = rewritten.split(url).join(localPath);
  }

  return rewritten;
}
