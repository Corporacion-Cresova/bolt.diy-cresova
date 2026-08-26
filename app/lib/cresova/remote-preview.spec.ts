import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BoltShell } from '~/utils/shell';
import type { ITerminal } from '~/types/terminal';
import { RemoteContainer, RunnerConnection } from './remote-container';

/*
 * The whole chain in one test: the app writes files, starts a server through the shell, the runner
 * notices the port, reports it, and the preview proxy serves the running app back. Every piece of
 * this is covered elsewhere; what is only covered here is that they fit together.
 */
const RUNNER_ENTRY = join(process.cwd(), 'runner/src/index.mjs');
const RUNNER_READY = existsSync(join(process.cwd(), 'runner/node_modules/ws'));

const PORT = 39875;
const SECRET = 'an-integration-secret-of-at-least-32-chars';
const PREVIEW_DOMAIN = 'preview.test';

async function issueTicket(secret: string, projectId: string) {
  const expiresAt = Date.now() + 60_000;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${projectId}.${expiresAt}`));
  const base64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  return `${expiresAt}.${base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

/**
 * Asks the proxy for a page as the browser would.
 *
 * `fetch` refuses to set the Host header, and the proxy routes entirely by Host, so a fetch here
 * would always land on the 404 branch and prove nothing.
 */
function getThroughProxy(host: string, path = '/') {
  return new Promise<{ status: number; body: string; headers: Record<string, string | string[] | undefined> }>(
    (resolve, reject) => {
      const call = request({ host: '127.0.0.1', port: PORT, path, headers: { host } }, (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => (body += chunk));
        response.on('end', () =>
          resolve({ status: response.statusCode ?? 0, body, headers: response.headers as never }),
        );
      });

      call.on('error', reject);
      call.end();
    },
  );
}

function fakeTerminal(): ITerminal {
  const handlers: Array<(data: string) => void> = [];

  return {
    cols: 80,
    rows: 15,
    reset: () => {
      // nothing on screen to clear
    },
    write: () => {
      // this test reads the preview, not the terminal
    },
    onData: (callback: (data: string) => void) => {
      handlers.push(callback);
    },
    input: (data: string) => {
      for (const handler of handlers) {
        handler(data);
      }
    },
  };
}

describe.skipIf(!RUNNER_READY)('a project running end to end on the runner', () => {
  let runner: ChildProcess;
  let projectRoot: string;

  beforeAll(async () => {
    projectRoot = mkdtempSync(join(tmpdir(), 'cresova-e2e-'));
    runner = spawn('node', [RUNNER_ENTRY], {
      env: {
        ...process.env,
        PORT: String(PORT),
        RUNNER_TOKEN: SECRET,
        PROJECT_ROOT: projectRoot,
        PREVIEW_DOMAIN,
      },
      stdio: 'ignore',
    });

    await new Promise((resolve) => setTimeout(resolve, 1500));
  });

  afterAll(() => {
    runner?.kill('SIGTERM');
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('writes an app, starts it, reports the port and serves it through the preview', async () => {
    const projectId = 'e2e-demo';
    const connection = new RunnerConnection(`ws://127.0.0.1:${PORT}`, await issueTicket(SECRET, projectId), projectId);
    await connection.connect();

    const container = new RemoteContainer(connection);

    // both events matter: 'server-ready' refreshes the preview, 'port' is what lists it
    const serverReady = new Promise<{ port: number; url: string }>((resolve) => {
      container.on('server-ready', (port, url) => resolve({ port, url }));
    });
    const portAnnounced = new Promise<{ port: number; type: string; url: string }>((resolve) => {
      container.on('port', (port, type, url) => resolve({ port, type, url }));
    });

    /*
     * A plain Node server rather than a real framework: this test is about the plumbing, and
     * pulling a framework off the network would make it slow and flaky for no extra coverage.
     * It reads PORT from the environment, which is how the runner tells a project where to listen.
     */
    await container.fs.writeFile(
      'server.js',
      [
        "const { createServer } = require('node:http');",
        'const port = Number(process.env.PORT);',
        "createServer((_request, response) => response.end('<h1>Hola desde el VPS</h1>')).listen(port);",
      ].join('\n'),
    );

    const shell = new BoltShell();
    await shell.init(container as never, fakeTerminal());
    await shell.ready();

    // not awaited on purpose: a dev server is supposed to keep running, so this never resolves
    void shell.executeCommand('e2e', 'node server.js');

    const ready = await Promise.race([
      serverReady,
      new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('no server-ready')), 30_000)),
    ]);

    expect(ready.url).toBe(`https://${projectId}.${PREVIEW_DOMAIN}`);

    const listed = await portAnnounced;
    expect(listed.type).toBe('open');
    expect(listed.port).toBe(ready.port);

    const page = await getThroughProxy(`${projectId}.${PREVIEW_DOMAIN}`);

    expect(page.status).toBe(200);
    expect(page.body).toContain('Hola desde el VPS');

    connection.close();
  }, 60_000);

  /*
   * The case that matters most in practice: Vite ignores PORT and listens on 5173, and it is what
   * the models reach for. If the runner assumed the port it handed out, the preview would forward
   * to nothing — or worse, to whatever else happened to be on that port.
   */
  it('finds the port a server chose for itself, ignoring the one it was given', async () => {
    const projectId = 'stubborn-demo';
    const connection = new RunnerConnection(`ws://127.0.0.1:${PORT}`, await issueTicket(SECRET, projectId), projectId);
    await connection.connect();

    const container = new RemoteContainer(connection);
    const chosenPort = 45173;

    const serverReady = new Promise<{ port: number; url: string }>((resolve) => {
      container.on('server-ready', (port, url) => resolve({ port, url }));
    });

    await container.fs.writeFile(
      'stubborn.js',
      [
        "const { createServer } = require('node:http');",
        `createServer((_request, response) => response.end('<h1>Elegí mi propio puerto</h1>')).listen(${chosenPort});`,
      ].join('\n'),
    );

    const shell = new BoltShell();
    await shell.init(container as never, fakeTerminal());
    await shell.ready();

    void shell.executeCommand('stubborn', 'node stubborn.js');

    const ready = await Promise.race([
      serverReady,
      new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('no server-ready')), 30_000)),
    ]);

    expect(ready.port).toBe(chosenPort);

    const page = await getThroughProxy(`${projectId}.${PREVIEW_DOMAIN}`);

    expect(page.status).toBe(200);
    expect(page.body).toContain('Elegí mi propio puerto');

    connection.close();
  }, 60_000);

  /*
   * An open port is not a working preview. Vite binds its port and only then resolves dependencies,
   * so announcing the server the moment the port appears puts a blank page in front of the user
   * that only a manual reload fixes.
   */
  it('waits until the server answers a request, not just until it opens its port', async () => {
    const projectId = 'slow-demo';
    const connection = new RunnerConnection(`ws://127.0.0.1:${PORT}`, await issueTicket(SECRET, projectId), projectId);
    await connection.connect();

    const container = new RemoteContainer(connection);

    const serverReady = new Promise<number>((resolve) => {
      container.on('server-ready', () => resolve(Date.now()));
    });

    /*
     * Listens straight away and refuses every request for three seconds, the way a dev server that
     * is still starting up behaves. Refusing rather than hanging keeps the test quick.
     */
    await container.fs.writeFile(
      'slow.js',
      [
        "const { createServer } = require('node:http');",
        'const answersAt = Date.now() + 3000;',
        'createServer((request, response) => {',
        '  if (Date.now() < answersAt) { request.socket.destroy(); return; }',
        "  response.end('<h1>Ya puedo responder</h1>');",
        '}).listen(Number(process.env.PORT));',
      ].join('\n'),
    );

    const shell = new BoltShell();
    await shell.init(container as never, fakeTerminal());
    await shell.ready();

    const startedAt = Date.now();
    void shell.executeCommand('slow', 'node slow.js');

    const announcedAt = await Promise.race([
      serverReady,
      new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('no server-ready')), 30_000)),
    ]);

    expect(announcedAt - startedAt).toBeGreaterThanOrEqual(3000);

    // the point of waiting: the first load the user gets is already a real page
    const page = await getThroughProxy(`${projectId}.${PREVIEW_DOMAIN}`);

    expect(page.status).toBe(200);
    expect(page.body).toContain('Ya puedo responder');

    connection.close();
  }, 60_000);

  /*
   * Embedding a cross-origin frame under an embedder policy takes two headers, not one, and
   * shipping only the first is what left this reading as "refused to connect" for a whole round:
   * the resource policy stops it being blocked as a subresource, and the frame's own embedder
   * policy stops it being blocked as a nested document. A working preview that reads as a dead
   * server is the most expensive kind of bug, so both are asserted here.
   */
  it('lets the builder embed the preview in its iframe', async () => {
    const live = await getThroughProxy(`e2e-demo.${PREVIEW_DOMAIN}`);

    expect(live.status).toBe(200);
    expect(live.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(live.headers['cross-origin-embedder-policy']).toBe('credentialless');

    // the same goes for the page that says a project is gone: unreadable in a frame is unhelpful
    const gone = await getThroughProxy(`nunca-existio.${PREVIEW_DOMAIN}`);

    expect(gone.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(gone.headers['cross-origin-embedder-policy']).toBe('credentialless');
  });

  it('does not serve a project to a host that names a different one', async () => {
    const page = await getThroughProxy(`someone-elses-project.${PREVIEW_DOMAIN}`);

    expect(page.status).not.toBe(200);
  }, 20_000);
});
