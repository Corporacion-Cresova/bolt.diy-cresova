import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ProjectManager } from './projects.mjs';
import { createTicket } from './tickets.mjs';

/*
 * Both halves of this file drive real servers on the runner's own port range (41000-41999), so they
 * live together on purpose: vitest runs files in parallel but a single file in sequence, and split
 * apart they raced for those ports — one suite's readiness probe would reach the other suite's
 * deliberately silent server and wait for an answer that was never coming.
 */

/*
 * How the runner decides a project's dev server is never coming.
 *
 * The rule this pins down is not a number, it is what the number is measured against. A dev server
 * is started as `npm install && npm run dev` in a single command, so any budget counted from the
 * spawn is really a budget for the install — and when that budget ran out first, the watcher died
 * before the server ever bound its port. Nothing was emitted, and `server-ready` is the only way
 * the browser learns a preview exists: no preview, no refresh, no publish button, and no error
 * anywhere to explain it. A working server, indistinguishable from a hung one.
 *
 * The budgets are injected here so both endings take milliseconds. What is being tested is which
 * clock they run on, not how long they are.
 */
describe('waiting for a project server', () => {
  let root;
  let events;
  let projects;

  const waitForEvent = (type, timeoutMs = 10_000) =>
    new Promise((resolve) => {
      const startedAt = Date.now();
      const tick = setInterval(() => {
        const found = events.find((event) => event.type === type);

        if (found || Date.now() - startedAt > timeoutMs) {
          clearInterval(tick);
          resolve(found);
        }
      }, 50);
    });

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'cresova-ready-'));
    events = [];
    projects = new ProjectManager({
      root,
      publishedRoot: join(root, 'published'),
      previewDomain: 'preview.test',
      onEvent: (_projectId, event) => events.push(event),

      // long enough that a live process is never mistaken for a dead one, short enough to test
      readyGraceAfterExitMs: 1500,
      readyCeilingMs: 60_000,
    });
  });

  afterEach(async () => {
    await projects.closeAll();
    await rm(root, { recursive: true, force: true });
  });

  it('keeps waiting while the command is still running, however long it takes to serve', async () => {
    const projectId = 'cresova-slowstart';
    await projects.open(projectId);

    /*
     * Binds well after the grace period. Under a budget counted from the spawn this is the project
     * that was lost: by the time it answered, nobody was listening any more.
     */
    await writeFile(
      join(root, projectId, 'server.mjs'),
      `import { createServer } from 'node:http';
       setTimeout(() => {
         createServer((_request, response) => response.end('up')).listen(Number(process.env.PORT));
       }, 4000);`,
    );

    await projects.spawn(projectId, 'node server.mjs', []);

    const ready = await waitForEvent('server-ready', 20_000);

    expect(ready).toBeDefined();
    expect(events.some((event) => event.type === 'server-timeout')).toBe(false);

    // without this the proxy forwards to the assigned port, which Vite ignores in favour of its own
    expect(projects.get(projectId).servingPort).toBe(ready.port);
  }, 30_000);

  it('says so when the command exits without ever serving, instead of going quiet', async () => {
    const projectId = 'cresova-deadcommand';
    await projects.open(projectId);
    await projects.spawn(projectId, 'echo "nothing to serve"', []);

    const timedOut = await waitForEvent('server-timeout');

    expect(timedOut).toBeDefined();
    expect(timedOut.reason).toMatch(/without serving/);
    expect(events.some((event) => event.type === 'server-ready')).toBe(false);
  }, 15_000);
});

/*
 * What a preview request does when the project's own server never answers.
 *
 * A dev server wedged mid-compile accepts the connection and then goes quiet, and the proxy used to
 * wait on it with nothing to cut the wait short. The request stayed open until the gateway in front
 * of the runner gave up minutes later and served its own error page — so the user got a generic 502
 * from a service that had never been consulted, while the runner's own explanation never ran.
 *
 * The header matters as much as the timeout: the builder is served under COEP, so a reply without
 * `Cross-Origin-Resource-Policy` is blocked before it renders. An explanation that cannot be read
 * inside the frame is worth exactly as much as no explanation.
 */
const PORT = 3987;
const TOKEN = 'runner-token-for-tests-'.padEnd(40, 'x');
const PROJECT_ID = 'cresova-silentserver';
const PREVIEW_DOMAIN = 'preview.test';

let runner;
let root;

const get = (host, timeoutMs) =>
  new Promise((resolve) => {
    const probe = httpRequest(
      { host: '127.0.0.1', port: PORT, path: '/', method: 'GET', headers: { host } },
      (response) => {
        let body = '';
        response.on('data', (chunk) => (body += chunk));
        response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }));
      },
    );

    probe.setTimeout(timeoutMs, () => {
      probe.destroy();
      resolve({ timedOut: true });
    });
    probe.on('error', (error) => resolve({ error: error.message }));
    probe.end();
  });

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'cresova-proxy-'));
  await mkdir(join(root, PROJECT_ID), { recursive: true });

  // accepts the connection and never replies: the shape of a dev server stuck on its first compile
  await writeFile(
    join(root, PROJECT_ID, 'silent.mjs'),
    `import { createServer } from 'node:http';
     createServer(() => {}).listen(Number(process.env.PORT));`,
  );

  // the memo is what makes opening the project bring that server back up
  await writeFile(
    join(root, PROJECT_ID, '.cresova-runner.json'),
    JSON.stringify({ command: 'node silent.mjs', rememberedAt: Date.now() }),
  );

  runner = spawn('node', [join(import.meta.dirname, 'index.mjs')], {
    env: {
      ...process.env,
      PORT: String(PORT),
      RUNNER_TOKEN: TOKEN,
      PROJECT_ROOT: root,
      PUBLISHED_ROOT: join(root, 'published'),
      PREVIEW_DOMAIN,
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 1500));

  // opening over the socket is what restores the remembered server
  const { default: WebSocket } = await import('ws');
  const socket = new WebSocket(
    `ws://127.0.0.1:${PORT}/connect?projectId=${PROJECT_ID}&ticket=${createTicket(TOKEN, PROJECT_ID)}`,
  );

  await new Promise((resolve, reject) => {
    socket.on('message', (raw) => JSON.parse(raw.toString()).type === 'ready' && resolve());
    socket.on('error', reject);
  });

  // let the silent server bind its port before anything asks the proxy for a page
  await new Promise((resolve) => setTimeout(resolve, 5000));
  socket.close();
}, 40_000);

afterAll(async () => {
  // SIGTERM, never SIGKILL: the orderly shutdown is what stops the project's own processes
  runner?.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await rm(root, { recursive: true, force: true });
});

/*
 * A published site is served straight off disk, and nothing here used to say anything about
 * freshness — so the browser cached by heuristic, and the page someone republished to show what
 * changed was the very page it then served unchanged from cache. Reported, reasonably, as not being
 * able to publish again.
 */
/*
 * Where published sites land when nobody configured it.
 *
 * The default used to be `/data/published`, a sibling of the projects directory — which reads as
 * "next to the projects" and is in fact the container's own writable layer, because the volume is
 * mounted on the projects path and nowhere else. A site published from the builder was therefore
 * one redeploy away from being gone, with nothing able to bring it back: the built files are the
 * whole record of a publish. This pins the default inside `PROJECT_ROOT`, where the volume is.
 */
/*
 * What the file tree carries, and what it should not.
 *
 * The tree is sent in full after every command, so anything in it is paid for again each time. A
 * lockfile is the largest thing in an ordinary project after `node_modules`, is shown to nobody,
 * and is stripped out of the model's context anyway — carried across the socket only to be thrown
 * away at the other end.
 */
describe('the project tree', () => {
  it('carries the project files but not the lockfile', async () => {
    const treeRoot = await mkdtemp(join(tmpdir(), 'cresova-tree-'));
    const { ProjectManager: Manager } = await import('./projects.mjs');
    const manager = new Manager({
      root: treeRoot,
      publishedRoot: join(treeRoot, '.published'),
      previewDomain: 'preview.test',
      onEvent() {},
    });

    const projectId = 'cresova-treetest';
    await manager.open(projectId);
    await mkdir(join(treeRoot, projectId, 'src'), { recursive: true });
    await writeFile(join(treeRoot, projectId, 'package.json'), '{"name":"demo"}');
    await writeFile(join(treeRoot, projectId, 'src', 'App.tsx'), 'export const App = () => null;');
    await writeFile(join(treeRoot, projectId, 'package-lock.json'), '{"lockfileVersion":3}');
    await writeFile(join(treeRoot, projectId, 'pnpm-lock.yaml'), 'lockfileVersion: 9');

    const paths = (await manager.tree(projectId)).map((entry) => entry.path);

    expect(paths).toContain('package.json');
    expect(paths).toContain(join('src', 'App.tsx'));
    expect(paths).not.toContain('package-lock.json');
    expect(paths).not.toContain('pnpm-lock.yaml');

    // and the files it does carry still arrive with their contents, which is the point of the tree
    const appFile = (await manager.tree(projectId)).find((entry) => entry.path === join('src', 'App.tsx'));
    expect(appFile.content).toContain('export const App');

    await manager.closeAll();
    await rm(treeRoot, { recursive: true, force: true });
  });
});

describe('where a publish is kept', () => {
  it('defaults inside the projects root, which is the part that is on a volume', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'cresova-default-'));
    const { ProjectManager: Manager } = await import('./projects.mjs');

    // the same default index.mjs applies when PUBLISHED_ROOT is not set
    const manager = new Manager({
      root: projectRoot,
      publishedRoot: join(projectRoot, '.published'),
      previewDomain: 'preview.test',
      onEvent() {},
    });

    await mkdir(join(projectRoot, '.published', 'demo'), { recursive: true });
    await writeFile(join(projectRoot, '.published', 'demo', 'index.html'), '<h1>ok</h1>');

    expect(manager.publishedDir('demo')).toBe(join(projectRoot, '.published', 'demo'));

    // and a project could never be given that path, so the two namespaces cannot collide
    await expect(manager.open('.published')).rejects.toThrow(/Invalid project id/);

    await rm(projectRoot, { recursive: true, force: true });
  });
});

describe('a published site', () => {
  const NAME = 'cafeteria';

  beforeAll(async () => {
    await mkdir(join(root, 'published', NAME), { recursive: true });
    await writeFile(join(root, 'published', NAME, 'index.html'), '<h1>publicado</h1>');
  });

  it('is served, and never from a stale copy the browser kept', async () => {
    const answer = await get(`${NAME}.${PREVIEW_DOMAIN}`, 20_000);

    expect(answer.status).toBe(200);
    expect(answer.body).toContain('publicado');
    expect(answer.headers['cache-control']).toBe('no-cache');
  }, 30_000);

  it('is readable inside the builder frame', async () => {
    const answer = await get(`${NAME}.${PREVIEW_DOMAIN}`, 20_000);

    expect(answer.headers['cross-origin-resource-policy']).toBe('cross-origin');
  }, 30_000);
});

describe('a preview whose server never answers', () => {
  it('gives up on its own instead of leaving the request for the gateway to kill', async () => {
    const answer = await get(`${PROJECT_ID}.${PREVIEW_DOMAIN}`, 40_000);

    expect(answer.timedOut).toBeUndefined();
    expect(answer.status).toBe(502);
    expect(answer.body).toMatch(/no responde/);
  }, 60_000);

  it('sends an answer the builder is allowed to render inside its frame', async () => {
    const answer = await get(`${PROJECT_ID}.${PREVIEW_DOMAIN}`, 40_000);

    expect(answer.headers['cross-origin-resource-policy']).toBe('cross-origin');
  }, 60_000);
});
