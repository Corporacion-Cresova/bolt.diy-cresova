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
 */
export type BuildStage =
  | 'idle'
  | 'thinking'
  | 'writing'
  | 'installing'
  | 'starting'
  | 'ready'
  | 'written'
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

  /** the model is still writing its answer */
  streaming: boolean;

  /** a preview is live and ready to be framed */
  hasPreview: boolean;

  /** what the runner said when it stopped waiting for the dev server, if it did */
  serverTimeout?: string;
}

const BUSY_STAGES: readonly BuildStage[] = ['thinking', 'writing', 'installing', 'starting'];

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

export function describeBuildProgress(input: BuildProgressInput): BuildProgress {
  const { actions, streaming, hasPreview, serverTimeout } = input;

  const deduped = dedupeFileActions(actions);
  const files = deduped.filter((action) => action.type === 'file');
  const filesDone = files.filter((action) => action.status === 'complete').length;
  const filesTotal = files.length;

  const failedPaths = deduped
    .filter((action) => action.status === 'failed')
    .map((action) => ('filePath' in action ? action.filePath : action.type));

  const running = (type: ActionState['type']) =>
    deduped.some((action) => action.type === type && action.status === 'running');

  /*
   * Order matters, and it is not the order the actions were emitted in. A build that failed a file
   * and then went on to install is still a build with a broken file, and saying "installing" there
   * would bury the only thing worth acting on. Trouble first, then the latest thing in motion.
   */
  const stage: BuildStage = failedPaths.length
    ? 'failed'
    : serverTimeout
      ? 'stalled'
      : running('start')
        ? 'starting'
        : running('shell')
          ? 'installing'
          : filesTotal > 0 && filesDone < filesTotal
            ? 'writing'
            : hasPreview
              ? 'ready'
              : streaming
                ? 'thinking'
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
      case 'written':
        /*
         * The turn is over, the files are on disk, and no dev server ever answered. Saying
         * "preparing" here would spin forever on a build that finished; publishing does not need
         * the dev server, so this is not a dead end and should not read like one.
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
