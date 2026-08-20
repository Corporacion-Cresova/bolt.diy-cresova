import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RemoteContainer, RunnerConnection } from './remote-container';

/*
 * The runner restarting is routine: a redeploy is enough, and an orchestrator health check that
 * fails will do it on its own. Before this, a dropped socket was permanent — every later call
 * failed, the workbench went quiet, and nothing said why. That is the failure this protects.
 */
const RUNNER_ENTRY = join(process.cwd(), 'runner/src/index.mjs');
const RUNNER_READY = existsSync(join(process.cwd(), 'runner/node_modules/ws'));

const PORT = 39883;
const SECRET = 'an-integration-secret-of-at-least-32-chars';

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

describe.skipIf(!RUNNER_READY)('a runner that restarts underneath the browser', () => {
  let runner: ChildProcess;
  let projectRoot: string;

  const startRunner = () =>
    spawn('node', [RUNNER_ENTRY], {
      env: {
        ...process.env,
        PORT: String(PORT),
        RUNNER_TOKEN: SECRET,
        PROJECT_ROOT: projectRoot,
        PREVIEW_DOMAIN: 'preview.test',
      },
      stdio: 'ignore',
    });

  beforeAll(async () => {
    projectRoot = mkdtempSync(join(tmpdir(), 'cresova-reconnect-'));
    runner = startRunner();
    await new Promise((resolve) => setTimeout(resolve, 1500));
  });

  afterAll(() => {
    runner?.kill('SIGKILL');
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('comes back on its own, and the files written before the restart are still there', async () => {
    const projectId = 'reconnect-demo';
    const connection = new RunnerConnection(`ws://127.0.0.1:${PORT}`, () => issueTicket(SECRET, projectId), projectId);

    const states: string[] = [];
    connection.onStateChange = (state) => states.push(state);

    await connection.connect();

    const container = new RemoteContainer(connection);
    await container.fs.writeFile('antes.txt', 'escrito antes del reinicio');

    /*
     * the runner goes away exactly as a redeploy would take it away, and the port must be free
     * again before the replacement can claim it
     */
    const stopped = new Promise((resolve) => runner.once('exit', resolve));
    runner.kill('SIGTERM');
    await stopped;

    runner = startRunner();

    /*
     * No reconnect call anywhere here on purpose: the point is that a write issued while the runner
     * is down waits for it to come back instead of failing, which is what keeps a generation alive
     * across a restart.
     */
    await container.fs.writeFile('despues.txt', 'escrito despues del reinicio');

    expect(await container.fs.readFile('antes.txt')).toContain('escrito antes del reinicio');
    expect(await container.fs.readFile('despues.txt')).toContain('escrito despues del reinicio');

    expect(states).toContain('reconnecting');
    expect(connection.state).toBe('open');

    connection.close();
  }, 60_000);
});
