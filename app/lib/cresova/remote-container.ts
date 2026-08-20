import { WORK_DIR } from '~/utils/constants';
import { RunnerConnection } from './runner-connection';
import { RemoteShellProcess, spawnRemoteProcess, type RemoteProcess } from './remote-shell';

/*
 * Re-exported so callers have one place to import the runner from, and so the connection and the
 * shell never have to import each other: a cycle between them would be loaded by every module that
 * touches ~/lib/webcontainer, which is all of them.
 */
export { RunnerConnection, runCommand, type CommandResult, type RunnerEvent } from './runner-connection';

/**
 * Exposes the runner with the shape the app already uses for WebContainer, so the workbench, the
 * action runner and the file store keep working unchanged.
 */
export class RemoteContainer {
  readonly workdir = WORK_DIR;

  constructor(private _connection: RunnerConnection) {}

  fs = {
    writeFile: (path: string, content: string) => this._connection.call<void>('fs.writeFile', { path, content }),
    readFile: (path: string) => this._connection.call<string>('fs.readFile', { path }),
    mkdir: (path: string, _options?: { recursive?: boolean }) => this._connection.call<void>('fs.mkdir', { path }),
    rm: (path: string, options?: { recursive?: boolean; force?: boolean }) =>
      this._connection.call<void>('fs.rm', { path, options }),
    readdir: (path: string, options?: { withFileTypes?: boolean }) =>
      this._connection.call<string[]>('fs.readdir', { path, options }),
  };

  /**
   * Mirrors `WebContainer.spawn`.
   *
   * `/bin/jsh` is how the app opens a shell session, so it gets one that speaks the same OSC
   * protocol; anything else is a single command with the streams a process has.
   */
  async spawn(command: string, args: string[] = []): Promise<RemoteProcess> {
    if (command === '/bin/jsh' || command === 'jsh') {
      return new RemoteShellProcess(this._connection);
    }

    return spawnRemoteProcess(this._connection, command, args);
  }

  /**
   * Mirrors the WebContainer events the app listens to.
   *
   * The runner reports a single `server-ready`; the workbench needs both events from it, because
   * `server-ready` triggers the preview refresh while `port` is what actually puts the preview in
   * the list. Only one is ever reported by the runner, so both are driven from it.
   */
  on(event: 'server-ready', listener: (port: number, url: string) => void): () => void;
  on(event: 'port', listener: (port: number, type: 'open' | 'close', url: string) => void): () => void;
  on(event: string, listener: (...args: never[]) => void): () => void;
  on(event: string, listener: (...args: never[]) => void): () => void {
    if (event === 'server-ready') {
      return this._connection.on('server-ready', (received) => {
        if (received.type === 'server-ready') {
          (listener as unknown as (port: number, url: string) => void)(received.port, received.url);
        }
      });
    }

    if (event === 'port') {
      return this._connection.on('server-ready', (received) => {
        if (received.type === 'server-ready') {
          (listener as unknown as (port: number, type: 'open' | 'close', url: string) => void)(
            received.port,
            'open',
            received.url,
          );
        }
      });
    }

    return () => {
      /*
       * 'preview-message' has no server side equivalent: the preview is a proxied page, not an
       * iframe we control. Returning a function keeps the caller's cleanup code uniform.
       */
    };
  }

  async setPreviewScript() {
    /*
     * WebContainer injects a script into previews to forward runtime errors back to the workbench.
     * The server side preview is a plain proxied page, so there is nothing to inject yet.
     */
  }

  internal = {
    watchPaths: () => {
      /*
       * The browser holds the source of truth for the file tree and pushes every change, so there
       * is nothing to watch back. Files created by a command are not reflected yet.
       */
    },
  };
}
