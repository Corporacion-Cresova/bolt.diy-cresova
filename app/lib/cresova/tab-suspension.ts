/**
 * What happened to this tab while nobody was looking at it.
 *
 * The open complaint is that leaving the tab and coming back hangs it, while staying on it never
 * does. That has more than one possible mechanism and they call for opposite fixes, so this
 * records the few readings that tell them apart instead of guessing:
 *
 *   - the browser **froze** the tab (`freeze`/`resume`), so everything that arrived meanwhile was
 *     delivered in one burst on return — the avalanche the user suspects;
 *   - the tab merely ran throttled, and what hurts on return is the accumulated rendering;
 *   - or nothing unusual happened after the return at all, and the hang is somewhere else.
 *
 * All three look identical from the outside, which is exactly why two very reasonable hypotheses
 * about this already cost a deploy each. A long task is the honest measurement: the browser reports
 * "Page Unresponsive" for a main thread that is held, and `longtask` entries say for how long and
 * how many times.
 *
 * Cheap on purpose. Two event listeners and an observer the browser feeds; nothing polls, nothing
 * is stored, and everything is bounded.
 */

/** How long after coming back still counts as "the return". */
const RETURN_WINDOW_MS = 15_000;

/** Returns kept. The most recent ones are what anyone reading the report cares about. */
const KEEP_RETURNS = 5;

/** Below this a hidden tab was a glance at another window, not a background stretch. */
const WORTH_RECORDING_MS = 5_000;

interface ReturnToTab {
  at: string;
  hiddenForMs: number;
  frozen: boolean;
  longTasks: number;
  blockedMs: number;
  longestTaskMs: number;
  runnerMessagesWhileHidden: number;
  runnerBytesWhileHidden: number;
}

interface Totals {
  longTasks: number;
  blockedMs: number;
}

let started = false;
let hiddenAt: number | undefined;
let frozenWhileHidden = false;
let everFrozen = false;

let runnerMessagesWhileHidden = 0;
let runnerBytesWhileHidden = 0;

let measuring: ReturnToTab | undefined;
let measuringUntil = 0;

const returns: ReturnToTab[] = [];
const totals: Totals = { longTasks: 0, blockedMs: 0 };

/** True while the tab is out of sight, which is when the interesting accumulation happens. */
function isHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

/**
 * Counts what the runner sent, split by whether anyone was watching.
 *
 * This is the traffic the user's own explanation points at — command output and file events piling
 * up behind a tab that is not being drawn. Counted rather than kept: the sizes are the question,
 * the contents are not, and the contents are the part that could carry anything sensitive.
 */
export function recordRunnerMessage(bytes: number): void {
  if (isHidden()) {
    runnerMessagesWhileHidden++;
    runnerBytesWhileHidden += bytes;
  }
}

function observeLongTasks() {
  if (typeof PerformanceObserver === 'undefined' || !PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
    return;
  }

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        totals.longTasks++;
        totals.blockedMs += entry.duration;

        if (measuring && entry.startTime <= measuringUntil) {
          measuring.longTasks++;
          measuring.blockedMs += entry.duration;
          measuring.longestTaskMs = Math.max(measuring.longestTaskMs, entry.duration);
        }
      }
    });

    observer.observe({ type: 'longtask', buffered: true });
  } catch {
    // an engine that lists the entry type but refuses to observe it costs us this reading, nothing else
  }
}

function onHidden() {
  hiddenAt = Date.now();
  frozenWhileHidden = false;
  runnerMessagesWhileHidden = 0;
  runnerBytesWhileHidden = 0;
}

function onVisible() {
  const hiddenForMs = hiddenAt === undefined ? 0 : Date.now() - hiddenAt;
  hiddenAt = undefined;

  if (hiddenForMs < WORTH_RECORDING_MS) {
    return;
  }

  measuring = {
    at: new Date().toISOString(),
    hiddenForMs,
    frozen: frozenWhileHidden,
    longTasks: 0,
    blockedMs: 0,
    longestTaskMs: 0,
    runnerMessagesWhileHidden,
    runnerBytesWhileHidden,
  };

  /*
   * Kept from the moment it opens rather than when the window closes: the report is most likely to
   * be asked for right after a hang, which is inside this window, and a reading that only appears
   * once it is over would be missing exactly when it matters. The object goes on being filled in.
   */
  returns.push(measuring);

  while (returns.length > KEEP_RETURNS) {
    returns.shift();
  }

  measuringUntil = performance.now() + RETURN_WINDOW_MS;
}

/** Starts recording. Safe to call more than once; only the first call does anything. */
export function watchTabSuspension(): void {
  if (started || typeof document === 'undefined') {
    return;
  }

  started = true;

  document.addEventListener('visibilitychange', () =>
    document.visibilityState === 'hidden' ? onHidden() : onVisible(),
  );

  /*
   * Only Chromium fires these, and they are the reading that settles the question: a frozen tab
   * runs no JavaScript at all while it is away, so everything the runner and the model sent is
   * still queued when it resumes and lands in one go. A tab that was merely throttled kept working
   * the whole time and has no backlog to swallow.
   */
  document.addEventListener('freeze', () => {
    frozenWhileHidden = true;
    everFrozen = true;
  });

  observeLongTasks();

  if (isHidden()) {
    onHidden();
  }
}

/** The readings, as lines for the diagnostics report. */
export function describeTabSuspension(): string[] {
  const lines = ['PESTAÑA EN SEGUNDO PLANO'];

  if (typeof PerformanceObserver === 'undefined' || !PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
    lines.push('  este navegador no informa de tareas largas, así que no hay medición del bloqueo');
  }

  lines.push(
    `  el navegador llegó a congelarla: ${everFrozen ? 'sí' : 'no'}`,
    `  tareas largas en toda la sesión: ${totals.longTasks} (${Math.round(totals.blockedMs)} ms bloqueado)`,
  );

  if (returns.length === 0) {
    lines.push('  no se ha vuelto a la pestaña tras dejarla de fondo');

    return lines;
  }

  lines.push('  vueltas a la pestaña, de la más antigua a la más reciente:');

  for (const back of returns) {
    lines.push(
      `    ${back.at} tras ${Math.round(back.hiddenForMs / 1000)} s fuera${back.frozen ? ', congelada' : ''}`,
      `      bloqueo en los ${RETURN_WINDOW_MS / 1000} s siguientes: ${back.longTasks} tareas largas, ` +
        `${Math.round(back.blockedMs)} ms en total, la mayor de ${Math.round(back.longestTaskMs)} ms`,
      `      del runner mientras estuvo fuera: ${back.runnerMessagesWhileHidden} mensajes, ` +
        `${Math.round(back.runnerBytesWhileHidden / 1024)} KB`,
    );
  }

  return lines;
}
