import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { WebContainer } from '@webcontainer/api';
import type { BoltShell } from '~/utils/shell';
import { ActionRunner } from '~/lib/runtime/action-runner';
import { webcontainerContext } from '~/lib/webcontainer';
import { RemoteContainer, RunnerConnection } from './remote-container';

/*
 * ActionRunner skips a file write while it is still streaming, on the runner only: replaying every
 * partial draft of a file over the socket, ten times a second, is needless traffic there in a way
 * it never is for WebContainer's in-memory write. What matters is that the write everyone actually
 * cares about — the finished file, once the action closes — still lands, and lands with the whole
 * content rather than whatever fragment happened to stream last. Reasoning about that from the
 * source is exactly the kind of thing that has been wrong before, so it is checked against a real
 * runner instead.
 */
const RUNNER_ENTRY = join(process.cwd(), 'runner/src/index.mjs');
const RUNNER_READY = existsSync(join(process.cwd(), 'runner/node_modules/ws'));

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

const PORT = 39881;
const SECRET = 'an-integration-secret-of-at-least-32-chars';

describe.skipIf(!RUNNER_READY)('ActionRunner writing a file on the runner', () => {
  let runner: ChildProcess;
  let projectRoot: string;
  const originalBackend = webcontainerContext.backend;

  beforeAll(async () => {
    projectRoot = mkdtempSync(join(tmpdir(), 'cresova-streaming-writes-'));
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
    webcontainerContext.backend = originalBackend;
  });

  it('holds off writing while a file streams, then writes the finished content once it closes', async () => {
    const connection = new RunnerConnection(
      `ws://127.0.0.1:${PORT}`,
      await issueTicket(SECRET, 'streaming-demo'),
      'streaming-demo',
    );
    await connection.connect();

    const container = new RemoteContainer(connection);
    webcontainerContext.backend = 'runner';

    const actionRunner = new ActionRunner(
      Promise.resolve(container as unknown as WebContainer),
      () => undefined as unknown as BoltShell,
    );

    const base = { artifactId: 'a', messageId: 'm', actionId: 'file-1' } as const;
    const action = (content: string) => ({ ...base, action: { type: 'file' as const, filePath: 'App.tsx', content } });

    actionRunner.addAction(action('const a'));

    // two streamed drafts, the way the parser replays a file while the model is still writing it
    await actionRunner.runAction(action('const a'), true);
    await actionRunner.runAction(action('const app = 1;\nexport default'), true);

    // neither draft made it to the server
    await expect(container.fs.readFile('App.tsx')).rejects.toThrow();

    const final = 'const app = 1;\nexport default function App() {\n  return null;\n}\n';
    await actionRunner.runAction(action(final), false);

    expect(await container.fs.readFile('App.tsx')).toBe(final);

    connection.close();
  });

  it('writes every draft on WebContainer, same as before this change', async () => {
    const connection = new RunnerConnection(
      `ws://127.0.0.1:${PORT}`,
      await issueTicket(SECRET, 'streaming-webcontainer-demo'),
      'streaming-webcontainer-demo',
    );
    await connection.connect();

    const container = new RemoteContainer(connection);
    webcontainerContext.backend = 'webcontainer'; // as if this tab fell back, never reached the runner

    const actionRunner = new ActionRunner(
      Promise.resolve(container as unknown as WebContainer),
      () => undefined as unknown as BoltShell,
    );

    const base = { artifactId: 'a', messageId: 'm', actionId: 'file-1' } as const;
    const action = (content: string) => ({ ...base, action: { type: 'file' as const, filePath: 'App.tsx', content } });

    actionRunner.addAction(action('const a'));
    await actionRunner.runAction(action('const a'), true);

    expect(await container.fs.readFile('App.tsx')).toBe('const a');

    connection.close();
  });
});
