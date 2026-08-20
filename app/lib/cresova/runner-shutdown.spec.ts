import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RemoteContainer, RunnerConnection } from './remote-container';

/*
 * Commands run detached so a dev server can be signalled together with the shell that started it.
 * The cost of that detachment is that nothing else would stop them if the runner goes away: they
 * would keep running and keep their ports, and a later runner would hand one of those ports to a
 * different project — one project's site served under another project's name. EasyPanel restarts
 * make that routine, not rare, so it is worth a test of its own.
 */
const RUNNER_ENTRY = join(process.cwd(), 'runner/src/index.mjs');
const RUNNER_READY = existsSync(join(process.cwd(), 'runner/node_modules/ws'));

const PORT = 39879;
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

/** Whether anything is listening, asked the way the preview proxy would ask. */
function somethingIsListening(port: number) {
  return new Promise<boolean>((resolve) => {
    import('node:net').then(({ createConnection }) => {
      const socket = createConnection({ host: '127.0.0.1', port });
      const done = (result: boolean) => {
        socket.destroy();
        resolve(result);
      };
      socket.once('connect', () => done(true));
      socket.once('error', () => done(false));
      socket.setTimeout(1000, () => done(false));
    });
  });
}

describe.skipIf(!RUNNER_READY)('a runner that is shut down', () => {
  let runner: ChildProcess;
  let projectRoot: string;

  beforeAll(async () => {
    projectRoot = mkdtempSync(join(tmpdir(), 'cresova-shutdown-'));
    runner = spawn('node', [RUNNER_ENTRY], {
      env: {
        ...process.env,
        PORT: String(PORT),
        RUNNER_TOKEN: SECRET,
        PROJECT_ROOT: projectRoot,
        PREVIEW_DOMAIN: 'preview.test',
      },
      stdio: 'ignore',
    });

    await new Promise((resolve) => setTimeout(resolve, 1500));
  });

  afterAll(async () => {
    /*
     * SIGTERM, not SIGKILL: the runner's own shutdown is what stops the project processes, and
     * SIGKILL skips it, leaking a server that keeps its port for the next run.
     */
    if (runner.exitCode === null && runner.signalCode === null) {
      const stopped = new Promise((resolve) => runner.once('exit', resolve));
      runner.kill('SIGTERM');
      await stopped;
    }

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('leaves no project server behind holding a port', async () => {
    const projectId = 'orphan-demo';
    const connection = new RunnerConnection(`ws://127.0.0.1:${PORT}`, await issueTicket(SECRET, projectId), projectId);
    await connection.connect();

    const container = new RemoteContainer(connection);
    const chosenPort = 45179;

    await container.fs.writeFile(
      'server.js',
      [
        "const { createServer } = require('node:http');",
        `createServer((_request, response) => response.end('sigo vivo')).listen(${chosenPort});`,
      ].join('\n'),
    );

    void container.spawn('node', ['server.js']);

    for (let attempt = 0; attempt < 40 && !(await somethingIsListening(chosenPort)); attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    expect(await somethingIsListening(chosenPort)).toBe(true);

    runner.kill('SIGTERM');

    for (let attempt = 0; attempt < 40 && (await somethingIsListening(chosenPort)); attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    expect(await somethingIsListening(chosenPort)).toBe(false);
  }, 60_000);
});
