import { WORK_DIR } from '~/utils/constants';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('CresovaRunner');

const CALL_TIMEOUT_MS = 60_000;

type RunnerEvent =
  | { type: 'ready'; projectId: string; previewUrl: string; port: number }
  | { type: 'output'; processId: string; stream: 'stdout' | 'stderr'; data: string }
  | { type: 'exit'; processId: string; code: number }
  | { type: 'server-ready'; port: number; url: string }
  | { type: 'result'; id: number; result?: unknown; error?: string };

type EventName = RunnerEvent['type'];
type Listener = (event: RunnerEvent) => void;

/**
 * Talks to the Cresova Runner over a single WebSocket per project.
 *
 * Requests carry an id and are answered by a `result` event; everything else (command output,
 * process exit, the dev server coming up) arrives unsolicited and is dispatched to listeners.
 */
export class RunnerConnection {
  #socket?: WebSocket;
  #pending = new Map<number, { resolve: (value: never) => void; reject: (error: Error) => void }>();
  #listeners = new Map<EventName, Set<Listener>>();
  #nextId = 1;

  constructor(
    private _url: string,
    private _ticket: string,
    private _projectId: string,
  ) {}

  async connect(): Promise<{ previewUrl: string; port: number }> {
    /*
     * A ticket, not the shared secret: it is scoped to this project, expires in minutes, and is
     * issued by the app server through /api/runner-ticket.
     */
    const address = `${this._url}/connect?projectId=${encodeURIComponent(this._projectId)}&ticket=${encodeURIComponent(this._ticket)}`;

    return new Promise((resolve, reject) => {
      const socket = new WebSocket(address);
      this.#socket = socket;

      socket.addEventListener('message', (message) => this.#dispatch(String(message.data)));
      socket.addEventListener('error', () => reject(new Error('Could not reach the Cresova Runner')));
      socket.addEventListener('close', () => this.#failAllPending('The connection to the runner closed'));

      const unsubscribe = this.on('ready', (event) => {
        unsubscribe();

        if (event.type === 'ready') {
          logger.info(`Project ${event.projectId} ready, preview at ${event.previewUrl}`);
          resolve({ previewUrl: event.previewUrl, port: event.port });
        }
      });
    });
  }

  #dispatch(raw: string) {
    let event: RunnerEvent;

    try {
      event = JSON.parse(raw) as RunnerEvent;
    } catch {
      return;
    }

    if (event.type === 'result') {
      const waiter = this.#pending.get(event.id);
      this.#pending.delete(event.id);

      if (event.error) {
        waiter?.reject(new Error(event.error));
      } else {
        waiter?.resolve(event.result as never);
      }

      return;
    }

    for (const listener of this.#listeners.get(event.type) ?? []) {
      listener(event);
    }
  }

  #failAllPending(reason: string) {
    for (const waiter of this.#pending.values()) {
      waiter.reject(new Error(reason));
    }

    this.#pending.clear();
  }

  on(event: EventName, listener: Listener): () => void {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, new Set());
    }

    this.#listeners.get(event)!.add(listener);

    return () => this.#listeners.get(event)?.delete(listener);
  }

  call<T>(type: string, payload: Record<string, unknown> = {}): Promise<T> {
    const socket = this.#socket;

    if (!socket || socket.readyState !== socket.OPEN) {
      return Promise.reject(new Error('The runner connection is not open'));
    }

    const id = this.#nextId++;

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`The runner did not answer ${type} in time`));
      }, CALL_TIMEOUT_MS);

      this.#pending.set(id, {
        resolve: ((value: T) => {
          clearTimeout(timeout);
          resolve(value);
        }) as (value: never) => void,
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      socket.send(JSON.stringify({ ...payload, type, id }));
    });
  }

  send(type: string, payload: Record<string, unknown> = {}) {
    this.#socket?.send(JSON.stringify({ ...payload, type }));
  }

  close() {
    this.#socket?.close();
  }
}

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

  async spawn(command: string, args: string[] = []) {
    return runCommand(this._connection, command, args);
  }

  on(event: 'server-ready', listener: (port: number, url: string) => void): () => void;
  on(event: string, listener: (...args: never[]) => void): () => void;
  on(event: string, listener: (...args: never[]) => void): () => void {
    if (event !== 'server-ready') {
      return () => {
        /*
         * 'port' and 'preview-message' have no server side equivalent yet, so there is nothing to
         * unsubscribe from. Returning a function keeps the caller's cleanup code uniform.
         */
      };
    }

    return this._connection.on('server-ready', (received) => {
      if (received.type === 'server-ready') {
        (listener as unknown as (port: number, url: string) => void)(received.port, received.url);
      }
    });
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

export interface CommandResult {
  output: string;
  exitCode: number;
}

/**
 * Runs a command and resolves when it exits.
 *
 * WebContainer's shell reports completion through OSC escape codes emitted by jsh. There is no jsh
 * on the server, so completion is taken from the process exit event instead, which is both simpler
 * and not tied to a shell's output format.
 */
export function runCommand(
  connection: RunnerConnection,
  command: string,
  args: string[] = [],
  onOutput?: (chunk: string) => void,
): Promise<CommandResult & { processId: string }> {
  return new Promise((resolve, reject) => {
    let output = '';
    let processId: string | undefined;

    /*
     * A short command can exit before the spawn call has even been answered, so events are held
     * until the process id is known and then replayed. Without this the result of a fast command
     * is silently lost.
     */
    const held: RunnerEvent[] = [];

    const finish = (code: number) => {
      stopOutput();
      stopExit();
      resolve({ output, exitCode: code, processId: processId ?? '' });
    };

    const handle = (event: RunnerEvent) => {
      if (processId === undefined) {
        held.push(event);
        return;
      }

      if (event.type === 'output' && event.processId === processId) {
        output += event.data;
        onOutput?.(event.data);
      } else if (event.type === 'exit' && event.processId === processId) {
        finish(event.code);
      }
    };

    const stopOutput = connection.on('output', handle);
    const stopExit = connection.on('exit', handle);

    connection
      .call<string>('spawn', { command, args })
      .then((id) => {
        processId = id;

        for (const event of held.splice(0)) {
          handle(event);
        }
      })
      .catch((error) => {
        stopOutput();
        stopExit();
        reject(error);
      });
  });
}
