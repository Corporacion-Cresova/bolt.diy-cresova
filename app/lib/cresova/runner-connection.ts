import { WORK_DIR } from '~/utils/constants';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('CresovaRunner');

const CALL_TIMEOUT_MS = 60_000;

/** How long a call waits for a dropped connection to come back before giving up. */
const RECONNECT_GRACE_MS = 30_000;
const RECONNECT_ATTEMPTS = 5;

/** A socket that opens but never announces the project would otherwise wait forever. */
const HANDSHAKE_TIMEOUT_MS = 20_000;

export type ConnectionState = 'open' | 'reconnecting' | 'closed';

export type RunnerEvent =
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

  #state: ConnectionState = 'closed';
  #reconnected?: Promise<void>;
  #deliberatelyClosed = false;
  #requestTicket: () => Promise<string>;

  onStateChange?: (state: ConnectionState) => void;

  /**
   * `ticket` may be a string or a function that produces one.
   *
   * Reconnecting needs a *fresh* ticket — they last five minutes — so the connection has to be able
   * to ask for one rather than replay the one it was handed.
   */
  constructor(
    private _url: string,
    ticket: string | (() => Promise<string>),
    private _projectId: string,
  ) {
    this.#requestTicket = typeof ticket === 'function' ? ticket : async () => ticket;
  }

  get state(): ConnectionState {
    return this.#state;
  }

  #setState(state: ConnectionState) {
    if (this.#state === state) {
      return;
    }

    this.#state = state;
    this.onStateChange?.(state);
  }

  async connect(): Promise<{ previewUrl: string; port: number }> {
    /*
     * A ticket, not the shared secret: it is scoped to this project, expires in minutes, and is
     * issued by the app server through /api/runner-ticket.
     */
    const ticket = await this.#requestTicket();
    const address = `${this._url}/connect?projectId=${encodeURIComponent(this._projectId)}&ticket=${encodeURIComponent(ticket)}`;

    return new Promise((resolve, reject) => {
      const socket = new WebSocket(address);
      this.#socket = socket;

      /*
       * The handshake is bounded on its own. A socket that opens but never announces the project —
       * a runner still starting up, or one that failed to open the directory — would otherwise
       * leave every caller waiting with nothing to time it out.
       */
      const handshake = setTimeout(() => {
        socket.close();
        reject(new Error('The runner accepted the connection but never announced the project'));
      }, HANDSHAKE_TIMEOUT_MS);

      const settle = <T>(finish: (value: T) => void) => {
        return (value: T) => {
          clearTimeout(handshake);
          finish(value);
        };
      };

      const fail = settle(reject);

      socket.addEventListener('message', (message) => this.#dispatch(String(message.data)));
      socket.addEventListener('error', () => fail(new Error('Could not reach the Cresova Runner')));
      socket.addEventListener('close', () => this.#handleClose());

      const unsubscribe = this.on('ready', (event) => {
        unsubscribe();

        if (event.type === 'ready') {
          logger.info(`Project ${event.projectId} ready, preview at ${event.previewUrl}`);
          this.#setState('open');
          clearTimeout(handshake);
          resolve({ previewUrl: event.previewUrl, port: event.port });
        }
      });
    });
  }

  /**
   * A dropped socket used to be permanent: every later call failed, the workbench went quiet, and
   * nothing said why. The runner restarting is routine — a redeploy is enough — so the connection
   * comes back on its own and calls made meanwhile wait for it instead of failing.
   */
  #handleClose() {
    /*
     * Calls that were in flight cannot be replayed safely: the runner may have already run the
     * command. They fail; the reconnection is for what comes after.
     */
    this.#failAllPending('The connection to the runner closed');

    if (this.#deliberatelyClosed || this.#state === 'reconnecting') {
      return;
    }

    this.#setState('reconnecting');
    logger.warn('The runner connection dropped, reconnecting');

    this.#reconnected = this.#reconnect();
  }

  async #reconnect(): Promise<void> {
    for (let attempt = 1; attempt <= RECONNECT_ATTEMPTS; attempt++) {
      // a restarting runner needs a moment before it accepts sockets again
      await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * 2 ** (attempt - 1), 8000)));

      if (this.#deliberatelyClosed) {
        return;
      }

      try {
        await this.connect();
        logger.info('The runner connection is back');

        return;
      } catch {
        // keep trying until the attempts run out
      }
    }

    this.#setState('closed');
    throw new Error('The Cresova Runner did not come back');
  }

  /** Resolves once the connection is usable, or throws if it will not come back. */
  async #whenOpen(): Promise<WebSocket> {
    const socket = this.#socket;

    if (socket && socket.readyState === socket.OPEN) {
      return socket;
    }

    if (this.#state !== 'reconnecting' || !this.#reconnected) {
      throw new Error('The runner connection is not open');
    }

    await Promise.race([
      this.#reconnected,
      new Promise<never>((_resolve, reject) =>
        setTimeout(() => reject(new Error('The runner did not come back in time')), RECONNECT_GRACE_MS),
      ),
    ]);

    const reopened = this.#socket;

    if (!reopened || reopened.readyState !== reopened.OPEN) {
      throw new Error('The runner connection is not open');
    }

    return reopened;
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

  async call<T>(type: string, payload: Record<string, unknown> = {}): Promise<T> {
    const socket = await this.#whenOpen();
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
    this.#deliberatelyClosed = true;
    this.#setState('closed');
    this.#socket?.close();
  }
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
/**
 * The whole app — and the model with it — is written against WebContainer's workdir, so commands
 * arrive as `cd /home/project && npm install`. On the runner the project lives somewhere else
 * entirely and every command already starts there, so the path is rewritten to `.` instead of
 * being translated: the runner never needs to know what the browser calls its own directory, and
 * a command that would otherwise die on `cd: can't cd to /home/project` simply runs.
 *
 * The lookahead keeps a directory that merely starts with the same letters (`/home/projects`) out
 * of it.
 */
const WORKDIR_REFERENCE = new RegExp(`${WORK_DIR}(?![\\w-])`, 'g');

export function toRunnerPaths(command: string): string {
  return command.replace(WORKDIR_REFERENCE, '.');
}

export function runCommand(
  connection: RunnerConnection,
  command: string,
  args: string[] = [],
  onOutput?: (chunk: string) => void,
  onStart?: (processId: string) => void,
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
      .call<string>('spawn', { command: toRunnerPaths(command), args: args.map(toRunnerPaths) })
      .then((id) => {
        processId = id;
        onStart?.(id);

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
