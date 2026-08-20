import { WORK_DIR_NAME } from '~/utils/constants';
import { runCommand, type RunnerConnection } from './runner-connection';

/**
 * WebContainer ships jsh, a shell that announces what it is doing through OSC 654 escape codes.
 * `BoltShell` drives it by typing into a terminal and reading those codes back: `interactive` when
 * the shell is ready, `prompt` after an interrupt, `exit=<ms>:<code>` when a command finishes.
 *
 * There is no jsh on the server. Rather than change `BoltShell` — which would put the working
 * WebContainer path at risk — the adapter speaks the same protocol: it accepts keystrokes, runs
 * whole lines on the runner, and emits the codes the shell parser already knows how to read.
 */
const OSC_START = '\x1b]654;';
const BELL = '\x07';

function marker(payload: string) {
  return `${OSC_START}${payload}${BELL}`;
}

/** The shape the app consumes from `webcontainer.spawn`. */
export interface RemoteProcess {
  readonly output: ReadableStream<string>;
  readonly input: WritableStream<string>;
  readonly exit: Promise<number>;
  kill: () => void;
  resize: (size: { cols: number; rows: number }) => void;
}

/**
 * A single command, exposed with the streams a WebContainer process has.
 *
 * Used for the plain `spawn('npm', ['run', 'build'])` calls, which only read `output` and `exit`.
 */
export function spawnRemoteProcess(connection: RunnerConnection, command: string, args: string[] = []): RemoteProcess {
  // replaced the moment the stream starts, which happens synchronously on construction
  let emit: (chunk: string) => void = () => {
    // no reader yet
  };
  let finish: () => void = () => {
    // no reader yet
  };
  let closed = false;

  const output = new ReadableStream<string>({
    start(controller) {
      emit = (chunk) => {
        if (!closed) {
          controller.enqueue(chunk);
        }
      };

      finish = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };
    },
  });

  let processId: string | undefined;

  const exit = runCommand(
    connection,
    command,
    args,
    (chunk) => emit(chunk),
    (id) => {
      processId = id;
    },
  )
    .then((result) => {
      finish();
      return result.exitCode;
    })
    .catch((error) => {
      emit(`${error instanceof Error ? error.message : String(error)}\n`);
      finish();

      return 1;
    });

  return {
    output,
    input: new WritableStream<string>({
      write(data) {
        if (processId) {
          connection.send('stdin', { processId, data: String(data) });
        }
      },
    }),
    exit,
    kill: () => {
      if (processId) {
        connection.call('kill', { processId }).catch(() => {
          // the process is already gone, which is what we wanted
        });
      }
    },
    resize: () => {
      // the runner has no pty, so there is no size to set
    },
  };
}

/**
 * A shell session that behaves like `jsh --osc` from the outside.
 *
 * Input arrives as raw keystrokes, exactly as a terminal would send them, because that is how
 * `BoltShell` writes commands. Lines are collected until Enter, then run on the runner.
 */
export class RemoteShellProcess implements RemoteProcess {
  readonly output: ReadableStream<string>;
  readonly input: WritableStream<string>;
  readonly exit: Promise<number>;

  /* All three are replaced synchronously by the stream and promise constructors below. */
  #emit: (chunk: string) => void = () => {
    // not started yet
  };
  #closeOutput: () => void = () => {
    // not started yet
  };
  #stop: (code: number) => void = () => {
    // not started yet
  };
  #line = '';
  #queue: Promise<void> = Promise.resolve();
  #running?: { processId?: string; interrupted: boolean; startedAt: number };
  #closed = false;

  constructor(private _connection: RunnerConnection) {
    this.output = new ReadableStream<string>({
      start: (controller) => {
        this.#emit = (chunk) => {
          if (!this.#closed) {
            controller.enqueue(chunk);
          }
        };

        this.#closeOutput = () => {
          if (!this.#closed) {
            this.#closed = true;
            controller.close();
          }
        };
      },
    });

    this.input = new WritableStream<string>({
      write: (data) => {
        this.#feed(String(data));
      },
    });

    this.exit = new Promise<number>((resolve) => {
      this.#stop = resolve;
    });

    /*
     * Announced immediately. The stream buffers until someone reads, so a reader attached later
     * still sees it — which is what `BoltShell.init` relies on.
     */
    this.#emit(`${marker('interactive')}${this.#prompt()}`);
  }

  /** The visible prompt. Always bundled into a chunk that carries a marker — see #feed. */
  #prompt() {
    return `\r\n~/${WORK_DIR_NAME} \u276f `;
  }

  /**
   * Keystrokes in, whole lines out.
   *
   * Everything the shell echoes is accumulated and flushed as one chunk, because chunk boundaries
   * are load bearing: `BoltShell` can have two readers on this stream at once — a command still
   * waiting for its `exit` code and a new command waiting for `prompt` — and each chunk goes to
   * whichever read was queued first. An extra chunk between the two markers makes each reader
   * swallow the other's marker and both wait forever. So markers are emitted back to back, with
   * any text folded into the same chunk.
   */
  #feed(data: string) {
    let echo = '';

    const flush = () => {
      const pending = echo;
      echo = '';

      return pending;
    };

    for (const char of data) {
      switch (char) {
        case '\x03': {
          this.#interrupt(flush());
          break;
        }
        case '\r':
        case '\n': {
          this.#submit(`${flush()}\r\n`);
          break;
        }
        case '\x7f':
        case '\b': {
          if (this.#line.length > 0) {
            this.#line = this.#line.slice(0, -1);
            echo += '\b \b';
          }

          break;
        }
        default: {
          this.#line += char;
          echo += char;
        }
      }
    }

    if (echo) {
      this.#emit(echo);
    }
  }

  /**
   * Ctrl-C.
   *
   * The markers are emitted straight away so the shell is released, but the command is only
   * really gone once the runner has reaped it. Ordering is kept by the queue instead: the next
   * command cannot start until the killed one has exited, so a dev server never overlaps with its
   * replacement on the same port.
   */
  #interrupt(prefix: string) {
    this.#line = '';

    const running = this.#running;

    if (running?.processId) {
      running.interrupted = true;
      this._connection.call('kill', { processId: running.processId }).catch(() => {
        // already gone
      });

      // 130 is what a shell reports for a command stopped by Ctrl-C
      this.#emit(`${prefix}^C${marker(`exit=${Date.now() - running.startedAt}:130`)}`);
      this.#emit(`${marker('prompt')}${this.#prompt()}`);

      return;
    }

    this.#emit(`${prefix}^C${marker('prompt')}${this.#prompt()}`);
  }

  #submit(prefix: string) {
    const command = this.#line.trim();
    this.#line = '';

    if (!command) {
      this.#emit(`${prefix}${this.#prompt()}`);
      return;
    }

    this.#emit(prefix);

    this.#queue = this.#queue.then(async () => {
      const running: { processId?: string; interrupted: boolean; startedAt: number } = {
        interrupted: false,
        startedAt: Date.now(),
      };
      this.#running = running;

      let exitCode = 1;

      try {
        const result = await runCommand(
          this._connection,
          command,
          [],
          (chunk) => this.#emit(chunk),
          (id) => {
            running.processId = id;
          },
        );
        exitCode = result.exitCode;
      } catch (error) {
        this.#emit(`${error instanceof Error ? error.message : String(error)}\r\n`);

        // 127 is what a shell reports for a command it could not run
        exitCode = 127;
      } finally {
        this.#running = undefined;
      }

      /*
       * An interrupted command already had its exit announced by the Ctrl-C that stopped it.
       * Announcing it twice would hand a stale result to whatever command runs next.
       */
      if (running.interrupted) {
        return;
      }

      /*
       * The shell parser reads the exit code from the second number, so the first one carries how
       * long the command took.
       */
      this.#emit(`${marker(`exit=${Date.now() - running.startedAt}:${exitCode}`)}${this.#prompt()}`);
    });
  }

  kill() {
    if (this.#running?.processId) {
      this._connection.call('kill', { processId: this.#running.processId }).catch(() => {
        // already gone
      });
    }

    this.#closeOutput();
    this.#stop(0);
  }

  resize() {
    // the runner has no pty, so there is no size to set
  }
}
