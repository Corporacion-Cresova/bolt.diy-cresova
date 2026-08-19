import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BoltShell } from '~/utils/shell';
import type { ITerminal } from '~/types/terminal';
import { RemoteContainer, RunnerConnection } from './remote-container';

/*
 * The point of these tests is that BoltShell is used unchanged: if the adapter's OSC protocol is
 * wrong, the real shell hangs or reports the wrong exit code here, exactly as it would in the app.
 * A mock shell would only prove that the adapter agrees with itself.
 */
const RUNNER_ENTRY = join(process.cwd(), 'runner/src/index.mjs');
const RUNNER_READY = existsSync(join(process.cwd(), 'runner/node_modules/ws'));

const PORT = 39873;
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

/** The smallest terminal BoltShell will accept: it only writes to it and reads what is typed. */
function fakeTerminal() {
  const handlers: Array<(data: string) => void> = [];
  let written = '';

  const terminal: ITerminal & { written: () => string } = {
    cols: 80,
    rows: 15,
    reset: () => {
      written = '';
    },
    write: (data: string) => {
      written += data;
    },
    onData: (callback: (data: string) => void) => {
      handlers.push(callback);
    },
    input: (data: string) => {
      for (const handler of handlers) {
        handler(data);
      }
    },
    written: () => written,
  };

  return terminal;
}

describe.skipIf(!RUNNER_READY)('BoltShell driving the Cresova Runner', () => {
  let runner: ChildProcess;
  let projectRoot: string;

  beforeAll(async () => {
    projectRoot = mkdtempSync(join(tmpdir(), 'cresova-shell-test-'));
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

  afterAll(() => {
    runner?.kill('SIGTERM');
    rmSync(projectRoot, { recursive: true, force: true });
  });

  async function openShell(projectId: string) {
    const connection = new RunnerConnection(`ws://127.0.0.1:${PORT}`, await issueTicket(SECRET, projectId), projectId);
    await connection.connect();

    const container = new RemoteContainer(connection);
    const terminal = fakeTerminal();
    const shell = new BoltShell();

    await shell.init(container as never, terminal);
    await shell.ready();

    return { shell, terminal, connection };
  }

  it('becomes interactive, so init does not hang waiting for jsh', async () => {
    const { shell, connection } = await openShell('shell-ready');

    expect(shell.process).toBeDefined();
    connection.close();
  }, 20_000);

  it('runs a command and reports its output', async () => {
    const { shell, connection } = await openShell('shell-output');

    const result = await shell.executeCommand('session-1', 'echo hola-cresova');

    expect(result?.exitCode).toBe(0);
    expect(result?.output).toContain('hola-cresova');
    connection.close();
  }, 20_000);

  it('reports the real exit code of a failing command', async () => {
    const { shell, connection } = await openShell('shell-exit-code');

    const result = await shell.executeCommand('session-1', 'exit 3');

    expect(result?.exitCode).toBe(3);
    connection.close();
  }, 20_000);

  it('runs commands one after another without losing a result', async () => {
    const { shell, connection } = await openShell('shell-sequence');

    const first = await shell.executeCommand('session-1', 'echo primero');
    const second = await shell.executeCommand('session-2', 'echo segundo');
    const third = await shell.executeCommand('session-3', 'echo tercero');

    expect(first?.output).toContain('primero');
    expect(second?.output).toContain('segundo');
    expect(third?.output).toContain('tercero');

    // the echoed command must not leak into the next command's captured output
    expect(second?.output).not.toContain('primero');
    connection.close();
  }, 30_000);

  it('writes files where the command can see them', async () => {
    const { shell, connection } = await openShell('shell-files');
    const container = new RemoteContainer(connection);

    await container.fs.writeFile('nota.txt', 'contenido-de-prueba');

    const result = await shell.executeCommand('session-1', 'cat nota.txt');

    expect(result?.output).toContain('contenido-de-prueba');
    connection.close();
  }, 20_000);

  /*
   * The important one for the build loop: every command is preceded by Ctrl-C, so a long running
   * process — a dev server — has to actually die and release the shell, or the next command never
   * runs.
   */
  it('interrupts a process that would otherwise never exit and releases the shell', async () => {
    const { shell, connection } = await openShell('shell-interrupt');

    const neverEnds = shell.executeCommand('session-1', 'sleep 120');

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // a second command sends Ctrl-C first, which is what has to break the sleep
    const after = await shell.executeCommand('session-2', 'echo despues');

    expect(after?.exitCode).toBe(0);
    expect(after?.output).toContain('despues');

    await neverEnds.catch(() => undefined);
    connection.close();
  }, 40_000);

  it('kills the whole process tree, not just the shell that started it', async () => {
    const { shell, connection } = await openShell('shell-tree');

    /*
     * `sh -c 'sleep 120'` puts a real child under the shell. Signalling only the shell would leave
     * the sleep alive, which is how a dev server used to survive Ctrl-C and keep holding its port.
     */
    const marker = `cresova-tree-${Date.now()}`;
    void shell.executeCommand('session-1', `sh -c 'sleep 120 # ${marker}'`);

    await new Promise((resolve) => setTimeout(resolve, 1000));
    await shell.executeCommand('session-2', 'echo listo');

    const survivors = await shell.executeCommand('session-3', `ps -ef | grep -c "[${marker[0]}]${marker.slice(1)}"`);

    expect(survivors?.output).toContain('0');
    connection.close();
  }, 40_000);
});
