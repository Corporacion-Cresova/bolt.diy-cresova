import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RemoteContainer, RunnerConnection, runCommand } from './remote-container';

/*
 * Exercises the adapter against a real runner rather than a mock: what is worth protecting here is
 * the wire protocol and the process lifecycle, and a mock would only assert our own assumptions
 * back at us. Skipped when the runner's dependencies are not installed.
 */
const RUNNER_ENTRY = join(process.cwd(), 'runner/src/index.mjs');
const RUNNER_READY = existsSync(join(process.cwd(), 'runner/node_modules/ws'));

const PORT = 39871;
const TOKEN = 'integration-token';

describe.skipIf(!RUNNER_READY)('RemoteContainer against a live runner', () => {
  let runner: ChildProcess;
  let projectRoot: string;

  beforeAll(async () => {
    projectRoot = mkdtempSync(join(tmpdir(), 'cresova-runner-test-'));
    runner = spawn('node', [RUNNER_ENTRY], {
      env: {
        ...process.env,
        PORT: String(PORT),
        RUNNER_TOKEN: TOKEN,
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
    const connection = new RunnerConnection(`ws://127.0.0.1:${PORT}`, TOKEN, projectId);
    const details = await connection.connect();

    return { connection, details };
  }

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
