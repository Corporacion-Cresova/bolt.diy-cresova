/**
 * What a project looks like, once it has been published.
 *
 * A dev project is reaped after half an hour and its files are deleted with it, so nothing about a
 * running project survives long enough to illustrate it in a list. A published site does: it lives
 * in its own directory on the runner, outlives restarts, and is served as static files. So the
 * runner photographs it at publish time and leaves the picture inside that directory, and this is
 * where the builder remembers which project the picture belongs to.
 *
 * localStorage rather than the chat record in IndexedDB: it is derived data that can always be
 * rebuilt by publishing again, and keeping it out of the chat history means a corrupt entry can
 * never cost someone their conversation.
 */
const KEY = 'cresova_published_sites';

export interface PublishedSite {
  url: string;
  thumbnailUrl?: string;
  publishedAt: string;
}

type PublishedSites = Record<string, PublishedSite>;

function readAll(): PublishedSites {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as PublishedSites;
  } catch {
    return {};
  }
}

export function rememberPublishedSite(chatId: string | undefined, site: Omit<PublishedSite, 'publishedAt'>) {
  if (!chatId || typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...readAll(), [chatId]: { ...site, publishedAt: new Date().toISOString() } }),
    );
  } catch (error) {
    console.warn('[Published] no se pudo guardar el sitio publicado:', error);
  }
}

export function getPublishedSites(): PublishedSites {
  return readAll();
}
