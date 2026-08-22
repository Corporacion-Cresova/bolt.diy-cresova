import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RemoteContainer, RunnerConnection, runCommand } from './remote-container';
import { toRunnerPaths } from './runner-connection';

/*
 * Exercises the adapter against a real runner rather than a mock: what is worth protecting here is
 * the wire protocol and the process lifecycle, and a mock would only assert our own assumptions
 * back at us. Skipped when the runner's dependencies are not installed.
 */
const RUNNER_ENTRY = join(process.cwd(), 'runner/src/index.mjs');
const RUNNER_READY = existsSync(join(process.cwd(), 'runner/node_modules/ws'));

/**
 * Signs a ticket exactly the way api.runner-ticket does, so this exercises the real handshake
 * rather than a convenience shortcut.
 */
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

const PORT = 39871;
const SECRET = 'an-integration-secret-of-at-least-32-chars';

describe.skipIf(!RUNNER_READY)('RemoteContainer against a live runner', () => {
  let runner: ChildProcess;
  let projectRoot: string;

  beforeAll(async () => {
    projectRoot = mkdtempSync(join(tmpdir(), 'cresova-runner-test-'));
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

  async function connect(projectId: string) {
    const connection = new RunnerConnection(`ws://127.0.0.1:${PORT}`, await issueTicket(SECRET, projectId), projectId);
    const details = await connection.connect();

    return { connection, details };
  }

  it('refuses a connection without a valid ticket', async () => {
    const connection = new RunnerConnection(`ws://127.0.0.1:${PORT}`, 'not-a-ticket', 'intruder-demo');

    await expect(connection.connect()).rejects.toThrow();
  });

  it('reports a preview url and the workdir the app expects', async () => {
    const { connection, details } = await connect('cycle-demo');

    expect(details.previewUrl).toBe('https://cycle-demo.preview.test');
    expect(new RemoteContainer(connection).workdir).toBe('/home/project');

    connection.close();
  });

  it('writes, lists and reads files back', async () => {
    const { connection } = await connect('files-demo');
    const container = new RemoteContainer(connection);

    await container.fs.mkdir('src');
    await container.fs.writeFile('src/index.js', 'console.log("hola")');

    expect(await container.fs.readdir('.')).toContain('src');
    expect(await container.fs.readFile('src/index.js')).toBe('console.log("hola")');

    connection.close();
  });

  it('reports its own writes, so the file tree fills in without a watcher on the server', async () => {
    const { connection } = await connect('watch-demo');
    const container = new RemoteContainer(connection);

    const seen: Array<{ type: string; path: string; content?: string }> = [];
    container.internal.watchPaths({}, (events) => {
      for (const event of events) {
        seen.push({
          type: event.type,
          path: event.path,
          content: event.buffer && new TextDecoder().decode(event.buffer),
        });
      }
    });

    await container.fs.mkdir('app/routes', { recursive: true });
    await container.fs.writeFile('app/routes/index.tsx', 'const a = 1;');
    await container.fs.writeFile('app/routes/index.tsx', 'const a = 2;');
    await container.fs.rm('app/routes/index.tsx');

    expect(seen).toEqual([
      { type: 'add_dir', path: '/home/project/app', content: undefined },
      { type: 'add_dir', path: '/home/project/app/routes', content: undefined },
      { type: 'add_file', path: '/home/project/app/routes/index.tsx', content: 'const a = 1;' },
      { type: 'change', path: '/home/project/app/routes/index.tsx', content: 'const a = 2;' },
      { type: 'remove_file', path: '/home/project/app/routes/index.tsx', content: undefined },
    ]);

    connection.close();
  });

  it('says nothing about a write the runner refused', async () => {
    const { connection } = await connect('watch-refused-demo');
    const container = new RemoteContainer(connection);

    const seen: string[] = [];
    container.internal.watchPaths({}, (events) => seen.push(...events.map((event) => event.path)));

    await expect(container.fs.writeFile('../escape.txt', 'nope')).rejects.toThrow(/escapes/);

    expect(seen).toEqual([]);

    connection.close();
  });

  /*
   * The gap `watchPaths` leaves on purpose: a command's own output. Nothing here writes through
   * `container.fs`, so nothing would be known to the browser without reconciling against the
   * server afterwards.
   */
  it('picks up files a command created, that the browser never wrote itself', async () => {
    const { connection } = await connect('reconcile-demo');
    const container = new RemoteContainer(connection);

    const seen: Array<{ type: string; path: string; content?: string }> = [];
    container.internal.watchPaths({}, (events) => {
      for (const event of events) {
        seen.push({
          type: event.type,
          path: event.path,
          content: event.buffer && new TextDecoder().decode(event.buffer),
        });
      }
    });

    await runCommand(connection, 'mkdir -p scaffold', []);
    await runCommand(connection, 'echo "generated" > scaffold/lockfile.txt', []);

    await container.reconcileTree();

    expect(seen).toContainEqual({ type: 'add_dir', path: '/home/project/scaffold', content: undefined });
    expect(seen).toContainEqual({
      type: 'add_file',
      path: '/home/project/scaffold/lockfile.txt',
      content: 'generated\n',
    });

    connection.close();
  });

  it('does not repeat a path a second reconcile already reported', async () => {
    const { connection } = await connect('reconcile-once-demo');
    const container = new RemoteContainer(connection);

    await runCommand(connection, 'echo "one" > generated.txt', []);
    await container.reconcileTree();

    const seen: string[] = [];
    container.internal.watchPaths({}, (events) => seen.push(...events.map((event) => event.path)));

    await container.reconcileTree();

    expect(seen).toEqual([]);

    connection.close();
  });

  it('does not repeat a path the browser already wrote itself', async () => {
    const { connection } = await connect('reconcile-skips-browser-writes-demo');
    const container = new RemoteContainer(connection);

    await container.fs.writeFile('App.tsx', 'const a = 1;');

    const seen: string[] = [];
    container.internal.watchPaths({}, (events) => seen.push(...events.map((event) => event.path)));

    await container.reconcileTree();

    expect(seen).not.toContain('/home/project/App.tsx');

    connection.close();
  });

  it('excludes node_modules, .git, dist and its own memo file', async () => {
    const { connection } = await connect('reconcile-excludes-demo');
    const container = new RemoteContainer(connection);

    await runCommand(
      connection,
      'mkdir -p node_modules/pkg .git dist && echo x > node_modules/pkg/index.js && echo x > .git/HEAD && echo x > dist/index.html && echo x > .cresova-runner.json',
      [],
    );

    const seen: string[] = [];
    container.internal.watchPaths({}, (events) => seen.push(...events.map((event) => event.path)));

    await container.reconcileTree();

    expect(seen.some((path) => path.includes('node_modules'))).toBe(false);
    expect(seen.some((path) => path.includes('/.git'))).toBe(false);
    expect(seen.some((path) => path.includes('/dist'))).toBe(false);
    expect(seen.some((path) => path.includes('.cresova-runner.json'))).toBe(false);

    connection.close();
  });

  /*
   * The model is told the project lives in `/home/project`, so it writes `cd /home/project && npm
   * install`. That directory does not exist on the VPS, and the `&&` turns a failed `cd` into a
   * failed build: every command in the artifact dies before it starts.
   */
  it('runs a command that cds into the workdir the browser believes in', async () => {
    const { connection } = await connect('workdir-demo');
    const container = new RemoteContainer(connection);

    await container.fs.writeFile('marker.txt', 'hola');

    const result = await runCommand(connection, 'cd /home/project && ls', []);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('marker.txt');

    connection.close();
  });

  /*
   * An out of date runner does not know a method the browser has learned to send. Dropping the
   * message leaves the browser waiting for a reply that is never coming, until its own timeout
   * accuses a healthy runner of being hung — with nothing in the runner's log to contradict it.
   */
  it('answers a method it does not know instead of leaving the caller waiting', async () => {
    const { connection } = await connect('unknown-method-demo');

    await expect(connection.call('quePasaAqui')).rejects.toThrow(/Unknown method: quePasaAqui/);

    connection.close();
  });

  it('captures the result of a command that exits before spawn is acknowledged', async () => {
    const { connection } = await connect('fast-demo');
    const result = await runCommand(connection, 'echo', ['listo']);

    expect(result.exitCode).toBe(0);
    expect(result.output.trim()).toBe('listo');

    connection.close();
  });

  it('propagates a non zero exit code', async () => {
    const { connection } = await connect('failing-demo');

    expect((await runCommand(connection, 'node', ['-e', '"process.exit(3)"'])).exitCode).toBe(3);

    connection.close();
  });

  it('refuses to write outside the project', async () => {
    const { connection } = await connect('contained-demo');

    await expect(new RemoteContainer(connection).fs.writeFile('../escape.txt', 'nope')).rejects.toThrow(/escapes/);

    connection.close();
  });

  it('reports the dev server through the same event name WebContainer uses', async () => {
    const { connection } = await connect('server-demo');
    const container = new RemoteContainer(connection);

    const serverReady = new Promise<string>((resolve) => {
      container.on('server-ready', (_port, url) => resolve(url));
    });

    await container.fs.writeFile(
      'server.mjs',
      `import{createServer}from'node:http';createServer((q,s)=>s.end('ok')).listen(process.env.PORT);`,
    );
    void runCommand(connection, 'node', ['server.mjs']);

    expect(await serverReady).toBe('https://server-demo.preview.test');

    connection.close();
  }, 15000);
});

describe('rewriting the workdir out of a command', () => {
  it("turns the browser's workdir into the directory the command already starts in", () => {
    expect(toRunnerPaths('cd /home/project && npm install')).toBe('cd . && npm install');
    expect(toRunnerPaths('node /home/project/server.js')).toBe('node ./server.js');
    expect(toRunnerPaths('cd /home/project')).toBe('cd .');
  });

  it('leaves a directory that merely starts the same way alone', () => {
    expect(toRunnerPaths('ls /home/projects')).toBe('ls /home/projects');
    expect(toRunnerPaths('ls /home/project-old')).toBe('ls /home/project-old');
  });

  it('leaves a command with nothing to rewrite untouched', () => {
    expect(toRunnerPaths('npm run dev')).toBe('npm run dev');
  });
});
