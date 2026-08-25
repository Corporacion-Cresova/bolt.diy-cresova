import { WORK_DIR } from '~/utils/constants';
import { BUILD_TIMEOUT_MS, RunnerConnection } from './runner-connection';
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

/** What the runner reports about a project when asked to describe itself. */
export interface RunnerDiagnostics {
  projectId: string;
  assignedPort: number;
  servingPort?: number;
  ready: boolean;
  liveProcesses: number;
  stillWatching: boolean;
  lastProbe?: string;
  listeningPorts: number[];
  lastCommand?: string;
  idleForMs: number;
  publishedNames: string[];
}

/** One entry from the runner's `fs.tree`, relative to the project root. */
interface TreeEntry {
  path: string;
  type: 'file' | 'dir';
  content?: string;
}

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
   * Builds the project and serves the result under its own name — `soltecsa.preview.cresova.com`
   * rather than the project's own `cresova-<id>.preview.cresova.com`. Not a WebContainer concept;
   * there is nothing to fall back to in the tab, which is why the button this backs only shows up
   * once the runner is actually in use.
   *
   * Publishing over a name that already has a site replaces it — the same name is how you update
   * what you published before, not a way to end up with two.
   */
  /**
   * What the runner knows about this project, for the diagnostics report.
   *
   * The readings only mean something together — a live process with no open port is a different
   * fault from an open port that never answers — so they are fetched in one call rather than
   * reconstructed by hand, one shell command at a time, long after the moment they describe.
   */
  diagnostics(): Promise<RunnerDiagnostics> {
    return this._connection.call<RunnerDiagnostics>('diagnostics');
  }

  publish(name: string): Promise<{ url: string }> {
    // runs the project's build on the server, which takes longer than an ordinary call is given
    return this._connection.call<{ url: string }>('publish', { name }, BUILD_TIMEOUT_MS);
  }

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
   *
   * And a server that is already up is delivered to a listener that subscribes afterwards, which is
   * what makes a preview survive anything other than the first time. Under WebContainer the
   * container dies with the tab, so subscribing before the server starts is the only order there
   * is; on the runner the server outlives the tab, and the workbench routinely attaches to a
   * project that has been serving for an hour. Without this, that listener waited for an
   * announcement that had already happened — and since a project with files is no longer rebuilt on
   * open, one that was never going to happen again.
   */
  on(event: 'server-ready', listener: (port: number, url: string) => void): () => void;
  on(event: 'port', listener: (port: number, type: 'open' | 'close', url: string) => void): () => void;
  on(event: string, listener: (...args: never[]) => void): () => void;
  on(event: string, listener: (...args: never[]) => void): () => void {
    if (event === 'server-ready') {
      const deliver = (port: number, url: string) =>
        (listener as unknown as (port: number, url: string) => void)(port, url);

      this.#replayServerReady(deliver);

      return this._connection.on('server-ready', (received) => {
        if (received.type === 'server-ready') {
          deliver(received.port, received.url);
        }
      });
    }

    if (event === 'port') {
      const deliver = (port: number, url: string) =>
        (listener as unknown as (port: number, type: 'open' | 'close', url: string) => void)(port, 'open', url);

      this.#replayServerReady(deliver);

      return this._connection.on('server-ready', (received) => {
        if (received.type === 'server-ready') {
          deliver(received.port, received.url);
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

  /**
   * Catches the file tree up on whatever a command changed underneath it.
   *
   * `watchPaths` only ever hears about the browser's own writes; this is the other half, for the
   * files a command creates — a scaffolder's output, a generated lockfile. Not a live watch, for
   * the same reason `watchPaths` isn't one: a one-shot read taken right after a command finishes,
   * not a subscription streaming every path `npm install` touches.
   *
   * Only paths not already known are announced. A command rewriting a file the browser already
   * wrote is a real gap this leaves — closing it would mean diffing content on every reconcile
   * instead of just names, and the files that actually go missing without this are ones nothing
   * upstream had ever seen at all.
   */
  async reconcileTree(): Promise<void> {
    const entries = await this._connection.call<TreeEntry[]>('fs.tree', {});
    const events: WatchEvent[] = [];

    for (const entry of entries) {
      const absolute = `${this.workdir}/${entry.path}`;

      if (this.#reported.has(absolute)) {
        continue;
      }

      this.#reported.add(absolute);

      events.push(
        entry.type === 'dir'
          ? { type: 'add_dir', path: absolute }
          : { type: 'add_file', path: absolute, buffer: new TextEncoder().encode(entry.content ?? '') },
      );
    }

    this.#announce(events);
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

  /**
   * Hands a listener the server that is already running, without letting it fire inside `on`.
   *
   * The delay is not decoration: callers subscribe while they are still being constructed — the
   * previews store does it from its own initialiser — and calling back synchronously would reach
   * them mid-build. A task later they are whole, and the event looks exactly like one that arrived
   * on its own.
   */
  #replayServerReady(deliver: (port: number, url: string) => void) {
    const known = this._connection.serverReady;

    if (!known) {
      return;
    }

    setTimeout(() => deliver(known.port, known.url), 0);
  }

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
