import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProjectManager } from './projects.mjs';

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
