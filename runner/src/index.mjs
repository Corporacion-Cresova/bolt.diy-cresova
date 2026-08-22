import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname } from 'node:path';
import { WebSocketServer } from 'ws';
import { verifyTicket } from './tickets.mjs';
import { ProjectManager } from './projects.mjs';
import { isValidProjectId, resolveInsideProject } from './paths.mjs';

const PORT = Number(process.env.PORT) || 3001;
const PROJECT_ROOT = process.env.PROJECT_ROOT || '/data/projects';
const PUBLISHED_ROOT = process.env.PUBLISHED_ROOT || '/data/published';
const PREVIEW_DOMAIN = process.env.PREVIEW_DOMAIN || 'preview.cresova.com';
const TOKEN = process.env.RUNNER_TOKEN || '';
const IDLE_TIMEOUT_MS = Number(process.env.IDLE_TIMEOUT_MS) || 30 * 60 * 1000;

if (!TOKEN) {
  console.error('RUNNER_TOKEN is required: without it anyone reaching this service could run code on the host.');
  process.exit(1);
}

if (TOKEN.length < 32) {
  console.error('RUNNER_TOKEN must be at least 32 characters: it is the key that signs access tickets.');
  process.exit(1);
}

const sockets = new Map();

const projects = new ProjectManager({
  root: PROJECT_ROOT,
  publishedRoot: PUBLISHED_ROOT,
  previewDomain: PREVIEW_DOMAIN,
  onEvent(projectId, event) {
    for (const socket of sockets.get(projectId) ?? []) {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(event));
      }
    }
  },
});

/** Reads the label from a preview hostname: abc123.preview.cresova.com -> abc123 */
function projectIdFromHost(host = '') {
  const name = host.split(':')[0];

  if (!name.endsWith(`.${PREVIEW_DOMAIN}`)) {
    return undefined;
  }

  const id = name.slice(0, -(PREVIEW_DOMAIN.length + 1));

  return isValidProjectId(id) ? id : undefined;
}

/**
 * Lets the builder put a preview inside its iframe.
 *
 * `app/entry.server.tsx` serves the builder with `Cross-Origin-Embedder-Policy: require-corp`,
 * which WebContainer needs. Under that policy every cross-origin subresource the page loads —
 * an iframe included — has to opt in with this header, and a preview served without it is blocked
 * before a single byte is rendered. The browser reports that as "refused to connect", which reads
 * like the server is down when in fact it answered perfectly.
 *
 * Opting in is the runner saying its own previews may be embedded. It carries no credentials and
 * exposes nothing that the preview URL did not already expose to anyone who has it.
 */
const EMBEDDABLE = { 'cross-origin-resource-policy': 'cross-origin' };

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
};

/**
 * Serves a published site as static files.
 *
 * Anything that is not a real file on disk falls back to index.html, rather than 404ing — a
 * client-side route belongs to the SPA's own router, which this has no way to understand and no
 * business trying to.
 */
function servePublished(dir, request, response) {
  const requestedPath = (request.url ?? '/').split('?')[0];

  let filePath;

  try {
    const candidate = resolveInsideProject(dir, requestedPath === '/' ? 'index.html' : requestedPath);
    filePath = existsSync(candidate) && statSync(candidate).isFile() ? candidate : `${dir}/index.html`;
  } catch {
    // a path trying to escape the published directory gets the same fallback as any unknown route
    filePath = `${dir}/index.html`;
  }

  if (!existsSync(filePath)) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', ...EMBEDDABLE });
    response.end('Este sitio publicado no tiene index.html.');

    return;
  }

  response.writeHead(200, {
    'content-type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream',
    ...EMBEDDABLE,
  });
  createReadStream(filePath).pipe(response);
}

const server = createServer(async (request, response) => {
  const label = projectIdFromHost(request.headers.host);

  if (label) {
    const project = projects.get(label);

    if (!project) {
      const publishedDir = projects.publishedDir(label);

      if (publishedDir) {
        servePublished(publishedDir, request, response);
        return;
      }

      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', ...EMBEDDABLE });
      response.end('Este proyecto ya no está activo. Vuelve a abrirlo en Cresova Builder.');

      return;
    }

    projects.touch(label);

    const upstream = await import('node:http');
    const forward = upstream.request(
      {
        host: '127.0.0.1',
        port: project.servingPort ?? project.port,
        method: request.method,
        path: request.url,
        headers: { ...request.headers, host: `127.0.0.1:${project.servingPort ?? project.port}` },
      },
      (upstreamResponse) => {
        response.writeHead(upstreamResponse.statusCode ?? 502, { ...upstreamResponse.headers, ...EMBEDDABLE });
        upstreamResponse.pipe(response);
      },
    );

    forward.on('error', () => {
      response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('El servidor del proyecto todavía no responde.');
    });

    request.pipe(forward);

    return;
  }

  /*
   * Anything addressed to the service itself rather than to a preview is a health check. It answers
   * on '/' as well as '/health' because an orchestrator that probes '/' and gets a 404 concludes
   * the service is down and restarts it — which shows up as a SIGTERM here and, in the browser, as
   * a session that silently stops responding.
   */
  const path = (request.url ?? '/').split('?')[0];

  if (path === '/' || path === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true, ...projects.stats() }));

    return;
  }

  response.writeHead(404);
  response.end();
});

/*
 * Vite's hot reload runs over a websocket on the project's own port, so preview upgrades have to
 * be forwarded too. Without this the page loads but never refreshes on a change.
 */
const previewUpgrade = async (request, socket, head) => {
  const projectId = projectIdFromHost(request.headers.host);
  const project = projectId && projects.get(projectId);

  if (!project) {
    socket.destroy();
    return;
  }

  const { request: httpRequest } = await import('node:http');
  const forward = httpRequest({
    host: '127.0.0.1',
    port: project.servingPort ?? project.port,
    path: request.url,
    headers: { ...request.headers, host: `127.0.0.1:${project.servingPort ?? project.port}` },
    method: request.method,
  });

  forward.on('upgrade', (upstreamResponse, upstreamSocket, upstreamHead) => {
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\n${Object.entries(upstreamResponse.headers)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\r\n')}\r\n\r\n`,
    );

    if (upstreamHead?.length) {
      socket.unshift(upstreamHead);
    }

    upstreamSocket.pipe(socket).pipe(upstreamSocket);
  });

  forward.on('error', () => socket.destroy());
  forward.end(head);
};

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`);

  if (url.pathname !== '/connect') {
    void previewUpgrade(request, socket, head);
    return;
  }

  const projectId = url.searchParams.get('projectId');

  /*
   * The browser presents a ticket signed by the app server, not the shared secret itself: anything
   * the browser holds is readable by anyone who opens the app, and this secret grants the right to
   * run commands on the host.
   */
  if (!isValidProjectId(projectId ?? '') || !verifyTicket(TOKEN, projectId, url.searchParams.get('ticket'))) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();

    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    ws.projectId = projectId;
    wss.emit('connection', ws);
  });
});

const handlers = {
  'fs.writeFile': (id, message) => projects.writeFile(id, message.path, message.content),
  'fs.readFile': (id, message) => projects.readFile(id, message.path),
  'fs.mkdir': (id, message) => projects.mkdir(id, message.path),
  'fs.rm': (id, message) => projects.rm(id, message.path, message.options),
  'fs.readdir': (id, message) => projects.readdir(id, message.path, message.options),
  'fs.tree': (id) => projects.tree(id),
  spawn: (id, message) => projects.spawn(id, message.command, message.args),
  stdin: (id, message) => projects.write(id, message.processId, message.data),
  kill: (id, message) => projects.kill(id, message.processId),
  publish: (id, message) => projects.publish(id, message.name),
};

wss.on('connection', async (ws) => {
  const projectId = ws.projectId;

  if (!sockets.has(projectId)) {
    sockets.set(projectId, new Set());
  }

  sockets.get(projectId).add(ws);

  const project = await projects.open(projectId);
  ws.send(JSON.stringify({ type: 'ready', projectId, previewUrl: projects.previewUrl(projectId), port: project.port }));

  ws.on('message', async (raw) => {
    let message;

    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }

    projects.touch(projectId);

    const handler = handlers[message.type];

    /*
     * Answering matters: a dropped message leaves the browser waiting for a reply that is never
     * coming, until its own timeout calls the runner unresponsive. That is what an out of date
     * runner looked like from the other side — a working service accused of being hung, with
     * nothing in its log to contradict it.
     */
    if (!handler) {
      ws.send(JSON.stringify({ type: 'result', id: message.id, error: `Unknown method: ${message.type}` }));
      return;
    }

    try {
      const result = await handler(projectId, message);
      ws.send(JSON.stringify({ type: 'result', id: message.id, result }));
    } catch (error) {
      ws.send(JSON.stringify({ type: 'result', id: message.id, error: String(error?.message ?? error) }));
    }
  });

  ws.on('close', () => {
    sockets.get(projectId)?.delete(ws);
  });
});

setInterval(() => {
  void projects.reapIdle(IDLE_TIMEOUT_MS);
}, 60_000).unref();

server.listen(PORT, () => {
  console.log(`Cresova Runner listening on ${PORT}, previews at *.${PREVIEW_DOMAIN}`);
});

/*
 * Project commands run detached, so nothing else would stop them if this process goes away: they
 * would keep running and keep their ports, and the next runner would hand one of those ports to a
 * different project. EasyPanel restarts and redeploys make that a routine event, not a rare one.
 */
let shuttingDown = false;

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`Cresova Runner stopping on ${signal}, closing every project`);

    /*
     * The sockets have to be closed explicitly. server.close() only stops new connections, so an
     * open browser would keep talking to a service that is on its way out and lose whatever it sent
     * in that window, with nothing to tell it to reconnect.
     */
    for (const socket of [...sockets.values()].flatMap((set) => [...set])) {
      socket.close(1012, 'The runner is restarting');
    }

    void projects.closeAll().finally(() => {
      server.close(() => process.exit(0));

      // do not wait forever on a connection that will not close
      setTimeout(() => process.exit(0), 5000).unref();
    });
  });
}
