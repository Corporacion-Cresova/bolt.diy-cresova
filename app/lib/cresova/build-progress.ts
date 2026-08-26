import type { ActionState } from '~/lib/runtime/action-runner';
import { dedupeFileActions } from '~/lib/cresova/dedupe-file-actions';

/**
 * One reading of "what is the builder doing right now", in the user's words.
 *
 * Two places need the same answer and must not disagree about it: the chat, where a single line
 * stands in for the list of files it used to print, and the preview panel, where the same line sits
 * under the skeleton while the site is being built. Deriving it twice would guarantee they drift.
 *
 * Everything here comes from state the workbench already keeps — no new plumbing, no new events.
 * It has no import of `workbenchStore`, deliberately, for the reason spelled out in
 * `action-failures.ts`: importing that module opens the runner connection, and a module that opens
 * a socket cannot be unit tested cheaply.
 *
 * The shape below — an open turn and a closed one answered separately — is the fix for the first
 * version of this file, which answered both from one chain of conditions and therefore let a signal
 * that was merely still in flight outrank the fact that the site was already up.
 */
export type BuildStage =
  | 'idle'
  | 'thinking'
  | 'writing'
  | 'installing'
  | 'starting'
  | 'ready'
  | 'written'
  | 'truncated'
  | 'stalled'
  | 'failed';

export interface BuildProgress {
  stage: BuildStage;

  /** file actions finished, and how many are known about so far */
  filesDone: number;
  filesTotal: number;

  /** paths of the file actions that failed, empty when none did */
  failedPaths: string[];

  /** one line, Spanish, ready to render */
  message: string;

  /** whether the stage is one that is still in motion, i.e. worth showing a spinner for */
  busy: boolean;
}

export interface BuildProgressInput {
  actions: ActionState[];

  /**
   * Whether the turn these actions belong to is still being written.
   *
   * Callers pass `!artifact.closed && streaming`, and both halves earn their place: `closed` alone
   * is never set when a response is cut off mid-artifact, so the close event never arrives; and
   * `streaming` alone is global, so an artifact from an earlier turn would believe it was working
   * again every time a later turn started.
   */
  turnOpen: boolean;

  /** a preview is live and ready to be framed */
  hasPreview: boolean;

  /** what the runner said when it stopped waiting for the dev server, if it did */
  serverTimeout?: string;
}

const BUSY_STAGES: readonly BuildStage[] = ['thinking', 'writing', 'installing', 'starting'];

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * A `start` action sitting at `running` is a **healthy dev server**, not a server still starting.
 *
 * `action-runner.ts` runs it deliberately without blocking, and only marks it complete when the
 * promise resolves — which happens when the process *exits*. A server that is serving never exits,
 * so this action stays `running` for the whole life of the project.
 *
 * This rule existed in `Artifact.tsx` before the status line was rewritten, was dropped in the
 * rewrite, and the result was the chat announcing "Arrancando el servidor" for as long as the
 * server stayed up — the healthier the project, the longer the lie. It has a name and this comment
 * so the next rewrite has to delete something that argues back.
 */
function isSettledStart(action: ActionState): boolean {
  return action.type === 'start' && action.status === 'running';
}

export function describeBuildProgress(input: BuildProgressInput): BuildProgress {
  const { actions, turnOpen, hasPreview, serverTimeout } = input;

  const deduped = dedupeFileActions(actions);
  const files = deduped.filter((action) => action.type === 'file');
  const filesDone = files.filter((action) => action.status === 'complete').length;
  const filesTotal = files.length;
  const filesPending = filesTotal - filesDone;

  const failedPaths = deduped
    .filter((action) => action.status === 'failed')
    .map((action) => ('filePath' in action ? action.filePath : action.type));

  const running = (type: ActionState['type']) =>
    deduped.some((action) => action.type === type && action.status === 'running' && !isSettledStart(action));

  /*
   * Trouble first in both branches: a build that failed a file and carried on to the install is
   * still a build with a broken file, and naming the install there would bury the only thing the
   * user can act on.
   */
  const stage: BuildStage = failedPaths.length
    ? 'failed'
    : serverTimeout
      ? 'stalled'
      : turnOpen
        ? /*
           * The turn is still being written, so name whatever is in motion. `start` is absent from
           * this chain on purpose — see `isSettledStart` — except as the last thing left to report
           * when a server has been asked for and no preview has arrived yet.
           */
          running('shell')
          ? 'installing'
          : filesTotal > 0 && filesDone < filesTotal
            ? 'writing'
            : !hasPreview && deduped.some(isSettledStart)
              ? 'starting'
              : 'thinking'
        : /*
           * The turn is over, so report its outcome and never a spinner. A preview that is live is
           * a terminal fact and outranks every leftover action state, which is exactly what the
           * previous version got backwards.
           */
          hasPreview
          ? 'ready'
          : filesPending > 0
            ? 'truncated'
            : filesTotal > 0
              ? 'written'
              : 'idle';

  const message = (() => {
    switch (stage) {
      case 'failed':
        return `${failedPaths.length} ${plural(failedPaths.length, 'archivo no se pudo escribir', 'archivos no se pudieron escribir')}`;
      case 'stalled':
        return 'El servidor tardó más de la cuenta en arrancar';
      case 'starting':
        return 'Arrancando el servidor';
      case 'installing':
        return 'Instalando dependencias';
      case 'writing':
        return `Escribiendo archivos · ${filesDone} de ${filesTotal}`;
      case 'truncated':
        /*
         * The turn ended with file actions that never closed. That is the signature of a response
         * cut off by the output limit, which `ESTADO.md` §5 calls the root cause of most generation
         * failures — and until now it was a spinner on a row inside a collapsed list.
         *
         * Said plainly and without alarm: the site is often fine, because the next turn rewrites
         * the file. What matters is that it stops claiming to be working.
         */
        return `Turno incompleto · ${filesDone} de ${filesTotal} ${plural(filesTotal, 'archivo', 'archivos')}`;
      case 'written':
        /*
         * Files on disk, turn over, and no dev server ever answered. Publishing compiles the disk
         * rather than the dev server, so this is not a dead end and should not read like one.
         */
        return `${filesTotal} ${plural(filesTotal, 'archivo escrito', 'archivos escritos')}, sin vista previa todavía`;
      case 'ready':
        return filesTotal
          ? `Sitio listo · ${filesTotal} ${plural(filesTotal, 'archivo', 'archivos')}`
          : 'Sitio listo';
      case 'thinking':
        return 'Preparando tu sitio';
      case 'idle':
      default:
        return 'Listo para construir';
    }
  })();

  return {
    stage,
    filesDone,
    filesTotal,
    failedPaths,
    message,
    busy: BUSY_STAGES.includes(stage),
  };
}
