import { resolve, sep } from 'node:path';

/**
 * Every file path handled by the runner comes from a model's output, so containment is a security
 * boundary, not a nicety. A path like "../../etc/passwd" or an absolute "/etc/shadow" must never
 * escape the project directory.
 */
export function resolveInsideProject(projectRoot, requestedPath) {
  const root = resolve(projectRoot);

  // absolute paths from the model are interpreted relative to the project, never to the host
  const relative = requestedPath.replace(/^([a-zA-Z]:)?[/\\]+/, '');
  const target = resolve(root, relative);

  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error(`Path escapes the project directory: ${requestedPath}`);
  }

  return target;
}

/** Project ids end up in directory names and in preview hostnames, so keep them boring. */
export function isValidProjectId(id) {
  return typeof id === 'string' && /^[a-z0-9][a-z0-9-]{2,62}$/.test(id);
}

/**
 * A published site's name doubles as a directory and a hostname label, exactly like a project id —
 * so it has to follow the same rule — but the two live under the same wildcard domain, and the
 * `cresova-` prefix is the only thing that tells a live dev project apart from a published one.
 * A published name starting with it could shadow, or be shadowed by, an unrelated project's host.
 */
export function isValidPublishName(name) {
  return isValidProjectId(name) && !name.startsWith('cresova-');
}
