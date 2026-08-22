import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RemoteContainer, RunnerConnection } from './remote-container';

/*
 * The compile already happens in the browser tab's own action runner (a 'build' action spawns
 * `npm run build` the same way any other command does); what publish adds is copying that output
 * somewhere it survives the project closing, and serving it. So the build here is a throwaway
 * shell command rather than a real framework — pulling one off the network would test npm, not
 * the runner.
 */
const RUNNER_ENTRY = join(process.cwd(), 'runner/src/index.mjs');
const RUNNER_READY = existsSync(join(process.cwd(), 'runner/node_modules/ws'));

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

/** Asks the proxy for a page as the browser would, by Host rather than by path. */
function getThroughProxy(port: number, host: string, path = '/') {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const call = request({ host: '127.0.0.1', port, path, headers: { host } }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => (body += chunk));
      response.on('end', () => resolve({ status: response.statusCode ?? 0, body }));
    });

    call.on('error', reject);
    call.end();
  });
}

function spawnRunner(port: number, projectRoot: string, publishedRoot: string) {
  return spawn('node', [RUNNER_ENTRY], {
    env: {
      ...process.env,
      PORT: String(port),
      RUNNER_TOKEN: SECRET,
      PROJECT_ROOT: projectRoot,
      PUBLISHED_ROOT: publishedRoot,
      PREVIEW_DOMAIN,
    },
    stdio: 'ignore',
  });
}

const buildScript = (html: string) => `mkdir -p dist && printf '${html}' > dist/index.html`;

describe.skipIf(!RUNNER_READY)('publishing a site on the runner', () => {
  const PORT = 39885;
  let runner: ChildProcess;
  let projectRoot: string;
  let publishedRoot: string;

  beforeAll(async () => {
    projectRoot = mkdtempSync(join(tmpdir(), 'cresova-publish-projects-'));
    publishedRoot = mkdtempSync(join(tmpdir(), 'cresova-publish-sites-'));
    runner = spawnRunner(PORT, projectRoot, publishedRoot);

    await new Promise((resolve) => setTimeout(resolve, 1500));
  });

  afterAll(() => {
    runner?.kill('SIGTERM');
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(publishedRoot, { recursive: true, force: true });
  });

  async function connect(projectId: string) {
    const connection = new RunnerConnection(`ws://127.0.0.1:${PORT}`, await issueTicket(SECRET, projectId), projectId);
    await connection.connect();

    return { connection, container: new RemoteContainer(connection) };
  }

  it('builds the project and serves the result under its own name', async () => {
    const { connection, container } = await connect('publish-demo');

    await container.fs.writeFile(
      'package.json',
      JSON.stringify({ name: 'demo', scripts: { build: buildScript('<h1>Hola desde el sitio publicado</h1>') } }),
    );

    const { url } = await container.publish('mi-sitio');
    expect(url).toBe('https://mi-sitio.preview.test');

    const page = await getThroughProxy(PORT, 'mi-sitio.preview.test');
    expect(page.status).toBe(200);
    expect(page.body).toContain('Hola desde el sitio publicado');

    connection.close();
  }, 30_000);

  it("falls back to index.html for a route the SPA's own router owns", async () => {
    const { connection, container } = await connect('publish-spa-demo');

    await container.fs.writeFile(
      'package.json',
      JSON.stringify({ name: 'demo', scripts: { build: buildScript('<h1>Sitio de una pagina</h1>') } }),
    );

    await container.publish('spa-sitio');

    const page = await getThroughProxy(PORT, 'spa-sitio.preview.test', '/servicios/detalle');
    expect(page.status).toBe(200);
    expect(page.body).toContain('Sitio de una pagina');

    connection.close();
  }, 30_000);

  it('replaces what was published under the same name', async () => {
    const first = await connect('publish-first-demo');
    await first.container.fs.writeFile(
      'package.json',
      JSON.stringify({ name: 'demo', scripts: { build: buildScript('<h1>Version uno</h1>') } }),
    );
    await first.container.publish('actualizable');
    first.connection.close();

    const second = await connect('publish-second-demo');
    await second.container.fs.writeFile(
      'package.json',
      JSON.stringify({ name: 'demo', scripts: { build: buildScript('<h1>Version dos</h1>') } }),
    );
    await second.container.publish('actualizable');
    second.connection.close();

    const page = await getThroughProxy(PORT, 'actualizable.preview.test');
    expect(page.body).toContain('Version dos');
    expect(page.body).not.toContain('Version uno');
  }, 30_000);

  it('rejects a name that could collide with a project id', async () => {
    const { connection, container } = await connect('publish-reject-demo');

    await container.fs.writeFile(
      'package.json',
      JSON.stringify({ name: 'demo', scripts: { build: buildScript('<h1>no</h1>') } }),
    );

    await expect(container.publish('cresova-anything')).rejects.toThrow(/Invalid publish name/);

    connection.close();
  }, 30_000);

  it('reports a failed build instead of publishing whatever is on disk from before', async () => {
    const { connection, container } = await connect('publish-fails-demo');

    await container.fs.writeFile('package.json', JSON.stringify({ name: 'demo', scripts: { build: 'exit 1' } }));

    await expect(container.publish('nunca-sale')).rejects.toThrow(/Build failed/);

    const page = await getThroughProxy(PORT, 'nunca-sale.preview.test');
    expect(page.status).not.toBe(200);

    connection.close();
  }, 30_000);
});

/*
 * The one guarantee that only makes sense to check across a runner restart: nothing about a
 * published site lives in memory, only on disk, so it has to keep serving with no project ever
 * reopened and no websocket ever connected to the runner that ends up serving it.
 */
describe.skipIf(!RUNNER_READY)('a published site outliving the runner that built it', () => {
  const PORT = 39886;
  let projectRoot: string;
  let publishedRoot: string;

  beforeAll(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'cresova-publish-restart-projects-'));
    publishedRoot = mkdtempSync(join(tmpdir(), 'cresova-publish-restart-sites-'));
  });

  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(publishedRoot, { recursive: true, force: true });
  });

  it('is served by a brand new runner process that never opened the project', async () => {
    const first = spawnRunner(PORT, projectRoot, publishedRoot);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const connection = new RunnerConnection(
      `ws://127.0.0.1:${PORT}`,
      await issueTicket(SECRET, 'restart-demo'),
      'restart-demo',
    );
    await connection.connect();

    const container = new RemoteContainer(connection);
    await container.fs.writeFile(
      'package.json',
      JSON.stringify({ name: 'demo', scripts: { build: buildScript('<h1>Sigo en pie</h1>') } }),
    );
    await container.publish('sobrevive');

    connection.close();
    first.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 500));

    const second = spawnRunner(PORT, projectRoot, publishedRoot);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const page = await getThroughProxy(PORT, 'sobrevive.preview.test');
      expect(page.status).toBe(200);
      expect(page.body).toContain('Sigo en pie');
    } finally {
      second.kill('SIGTERM');
    }
  }, 30_000);
});
