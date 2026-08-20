import { WORK_DIR } from '~/utils/constants';
import { RunnerConnection } from './runner-connection';
import { RemoteShellProcess, spawnRemoteProcess, type RemoteProcess } from './remote-shell';

/*
 * Re-exported so callers have one place to import the runner from, and so the connection and the
 * shell never have to import each other: a cycle between them would be loaded by every module that
 * touches ~/lib/webcontainer, which is all of them.
 */
export { RunnerConnection, runCommand, type CommandResult, type RunnerEvent } from './runner-connection';

/** The subset of WebContainer's watcher events the file store acts on. */
interface WatchEvent {
  type: 'add_file' | 'change' | 'add_dir' | 'remove_file' | 'remove_dir' | 'update_directory';
  path: string;
  buffer?: Uint8Array;
}

type WatchCallback = (events: WatchEvent[]) => void;

/**
 * Exposes the runner with the shape the app already uses for WebContainer, so the workbench, the
 * action runner and the file store keep working unchanged.
 */
export class RemoteContainer {
  readonly workdir = WORK_DIR;

  constructor(private _connection: RunnerConnection) {}

  fs = {
    writeFile: async (path: string, content: string) => {
      await this._connection.call<void>('fs.writeFile', { path, content });
      this.#announceWrite(path, content);
    },
    readFile: (path: string) => this._connection.call<string>('fs.readFile', { path }),
    mkdir: async (path: string, options?: { recursive?: boolean }) => {
      await this._connection.call<void>('fs.mkdir', { path });
      this.#announceMkdir(path, options?.recursive ?? false);
    },
    rm: async (path: string, options?: { recursive?: boolean; force?: boolean }) => {
      await this._connection.call<void>('fs.rm', { path, options });
      this.#announce([{ type: options?.recursive ? 'remove_dir' : 'remove_file', path: this.#absolute(path) }]);
    },
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
    /**
     * Mirrors `WebContainer.internal.watchPaths`.
     *
     * There is no filesystem to watch on this side, but the browser is the one writing the files,
     * so it can report its own writes. The alternative — a watcher on the VPS — would have to
     * stream every path `npm install` touches through the socket to say nothing useful.
     *
     * The gap this leaves is files a *command* creates on the server: a scaffolder's output or a
     * generated lockfile stay invisible until something reads them back.
     */
    watchPaths: (_config: unknown, callback: WatchCallback) => {
      this.#watchers.add(callback);

      return {
        close: () => this.#watchers.delete(callback),
      };
    },
  };

  #watchers = new Set<WatchCallback>();

  /** Paths already reported, so a rewrite is a `change` and the file store keeps its count right. */
  #reported = new Set<string>();

  #announce(events: WatchEvent[]) {
    if (events.length === 0) {
      return;
    }

    for (const watcher of this.#watchers) {
      watcher(events);
    }
  }

  /** The file store keys everything by absolute path; callers write relative ones. */
  #absolute(path: string): string {
    const trimmed = path.trim();

    return trimmed.startsWith('/') ? trimmed : `${this.workdir}/${trimmed.replace(/^\.\//, '')}`;
  }

  #announceWrite(path: string, content: string) {
    const absolute = this.#absolute(path);
    const type = this.#reported.has(absolute) ? 'change' : 'add_file';
    this.#reported.add(absolute);

    /*
     * The store decides whether a file is binary by looking at the bytes, so the content has to
     * arrive as bytes rather than as the string it was written from.
     */
    const buffer = typeof content === 'string' ? new TextEncoder().encode(content) : new Uint8Array(content);

    this.#announce([{ type, path: absolute, buffer }]);
  }

  /**
   * A recursive mkdir creates every missing ancestor, and the tree needs a node for each of them,
   * or a folder several levels deep has nothing to hang from.
   */
  #announceMkdir(path: string, recursive: boolean) {
    const absolute = this.#absolute(path);

    if (!recursive) {
      this.#announce([{ type: 'add_dir', path: absolute }]);
      return;
    }

    const segments = absolute.slice(this.workdir.length).split('/').filter(Boolean);
    const events: WatchEvent[] = [];
    let current = this.workdir;

    for (const segment of segments) {
      current = `${current}/${segment}`;

      if (!this.#reported.has(current)) {
        this.#reported.add(current);
        events.push({ type: 'add_dir', path: current });
      }
    }

    this.#announce(events);
  }
}
