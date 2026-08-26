/**
 * Uncaught errors, kept so the diagnostics report can carry them.
 *
 * The inherited debug logger already claims to do this, and does not: its handlers are installed by
 * `startCapture`, which only runs when someone turns debug mode on in the settings. By the time the
 * Debug Log button asks for the data it enables capture, collects, and disables again — so it
 * reports the errors of the moment nothing was happening, which is none. The same is true of the
 * console and network sections: empty in every ordinary session.
 *
 * Listening always is the whole point. An exception matters precisely when nobody was expecting it,
 * and a capture you have to switch on before the thing you are trying to catch is a capture for
 * problems that reproduce on demand — which the ones costing time here never do.
 *
 * Bounded, deduplicated, and short. A page that throws in a render loop must not turn this into a
 * megabyte, and the report it feeds is meant to be pasted into a conversation.
 */

/** Enough to see a pattern; the rest of a repeating error is the same error again. */
const KEEP_ERRORS = 8;

/** A stack trace is not what this is for: the message and where it came from are. */
const MESSAGE_CHARS = 300;

interface CapturedError {
  at: string;
  message: string;
  where?: string;
  repeats: number;
}

let started = false;
const captured: CapturedError[] = [];

function remember(message: string, where?: string) {
  const trimmed = message.trim().slice(0, MESSAGE_CHARS);

  if (!trimmed) {
    return;
  }

  const last = captured[captured.length - 1];

  /*
   * A render loop throws the same thing hundreds of times. Counting beats keeping: the eighth copy
   * says nothing the first did not, and it would push out the errors that came before it — which are
   * usually the ones that explain it.
   */
  if (last && last.message === trimmed && last.where === where) {
    last.repeats++;
    return;
  }

  captured.push({ at: new Date().toISOString(), message: trimmed, where, repeats: 1 });

  while (captured.length > KEEP_ERRORS) {
    captured.shift();
  }
}

/** Starts listening. Safe to call more than once; only the first call does anything. */
export function watchBrowserErrors(): void {
  if (started || typeof window === 'undefined') {
    return;
  }

  started = true;

  window.addEventListener('error', (event) => {
    const where = event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined;
    remember(event.message || String(event.error), where);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as { message?: string } | string | undefined;
    remember(typeof reason === 'string' ? reason : (reason?.message ?? String(reason)));
  });
}

/** The errors, as lines for the diagnostics report. */
export function describeBrowserErrors(): string[] {
  if (captured.length === 0) {
    return ['ERRORES DEL NAVEGADOR', '  ninguno'];
  }

  return [
    'ERRORES DEL NAVEGADOR',
    ...captured.flatMap((error) => [
      `  ${error.at} ${error.message}${error.repeats > 1 ? ` (×${error.repeats})` : ''}`,
      ...(error.where ? [`    en ${error.where}`] : []),
    ]),
  ];
}
