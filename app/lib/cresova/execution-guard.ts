import type { Message } from 'ai';
import { nextPhase, phasePrompt } from './build-plan';
import type { ActionState } from '~/lib/runtime/action-runner';
import { workbenchStore } from '~/lib/stores/workbench';
import { generateId } from '~/utils/fileUtils';
import { createScopedLogger } from '~/utils/logger';
import { detectBuildIntent } from './build-intent';
import { detectWorkspaceCommands, hasInstalledDependencies } from './dev-server';
import { describeActionFailures } from './action-failures';

const logger = createScopedLogger('CresovaBuilder');

/** Never more than this, no matter what: every retry costs OpenRouter tokens. */
export const MAX_RECOVERY_ATTEMPTS = 1;

/**
 * How long we wait for a preview URL after starting the app.
 *
 * Long on purpose, and it costs nothing when things go well: the wait ends the moment the preview
 * arrives, and ends early through `giveUp` when the command that was supposed to serve the site has
 * already failed. What it buys is the slow case — the first `npm install` of a project on a busy
 * runner, which routinely outlasts the two minutes this used to allow. Giving up there declared a
 * build dead while it was still installing, and left the user with no preview and no publish button
 * in front of a project that was about to work.
 */
const PREVIEW_TIMEOUT_MS = 10 * 60_000;

/** Shown when the wait above runs out, because a guard that gives up in silence teaches nothing. */
const PREVIEW_TIMEOUT_ALERT = {
  type: 'error',
  title: 'La vista previa no llegó a estar lista',
  description: 'El servidor del proyecto no respondió a tiempo',
  content:
    'El proyecto se creó, pero su servidor no llegó a responder. Revisa la terminal: si la instalación de dependencias falló, el error está ahí. Puedes volver a intentarlo pidiendo que se arranque de nuevo.',
} as const;

/** Marks the assistant message the guard injects, so the guard never re-enters on its own output. */
export const AUTO_START_ANNOTATION = 'cresova-auto-start';

export const ARTIFACT_RECOVERY_PROMPT = `Your previous response did not contain an executable Bolt artifact, so nothing was created.

Return the full implementation now using the required artifact protocol:
- exactly one <boltArtifact> block,
- one <boltAction type="file" filePath="..."> per file (complete file contents, no diffs, no placeholders),
- a single <boltAction type="shell"> to install dependencies if they are needed,
- a final <boltAction type="start"> with the command that runs the dev server.

Do not explain the code and do not answer with snippets. Output the artifact.`;

export interface ExecutionGuardContext {
  /** Id of the assistant message that just finished streaming. */
  assistantMessageId: string;

  /** Raw content of the user message that triggered the turn. */
  userMessage: string;

  /** How many automatic recoveries already happened for this user request. */
  recoveryAttempt: number;

  /** Asks the model again for an executable artifact (artifact guard). */
  requestArtifactRecovery: () => void;

  /** Injects a synthetic assistant message carrying the install/start artifact (start guard). */
  appendAssistantMessage: (message: Message) => void;

  /** The conversation so far, used to work out which phase of a plan comes next. */
  messages: Message[];

  /** Asks the model for the next phase of its own plan. */
  requestNextPhase: (prompt: string) => void;
}

export type ExecutionGuardOutcome =
  | 'next-phase'
  | 'idle'
  | 'artifact-recovery'
  | 'no-artifact'
  | 'actions-failed'
  | 'preview-ready'
  | 'auto-start'
  | 'no-start-command'
  | 'preview-timeout';

function getTurnActions(assistantMessageId: string): ActionState[] {
  const artifacts = workbenchStore.artifacts.get();

  return Object.entries(artifacts)
    .filter(([artifactId]) => artifactId.startsWith(`${assistantMessageId}-`))
    .flatMap(([, artifact]) => Object.values(artifact.runner.actions.get()));
}

function hasReadyPreview(): boolean {
  return workbenchStore.previews.get().some((preview) => preview.ready);
}

function showPreview(): void {
  workbenchStore.showWorkbench.set(true);

  if (workbenchStore.currentView.get() !== 'preview') {
    workbenchStore.currentView.set('preview');
  }
}

const TICK_MS = 1000;

async function waitForPreview(timeoutMs: number, giveUp?: () => boolean): Promise<boolean> {
  if (hasReadyPreview()) {
    return true;
  }

  return new Promise<boolean>((resolve) => {
    /*
     * The budget only runs down while the tab is visible. WebContainer executes the install and
     * the dev server inside this tab, and browsers throttle hidden tabs hard, so counting wall
     * clock time meant giving up on a build that was merely running slowly in the background.
     */
    let remainingMs = timeoutMs;

    const finish = (ready: boolean) => {
      clearInterval(ticker);
      unsubscribe();
      resolve(ready);
    };

    const ticker = setInterval(() => {
      if (giveUp?.()) {
        finish(false);
        return;
      }

      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }

      remainingMs -= TICK_MS;

      if (remainingMs <= 0) {
        finish(false);
      }
    }, TICK_MS);

    const unsubscribe = workbenchStore.previews.listen((previews) => {
      if (previews.some((preview) => preview.ready)) {
        finish(true);
      }
    });
  });
}

/**
 * Cresova Execution Guard V1.
 *
 * Runs once per assistant turn, after the stream ended and the action queue drained, and
 * makes sure a build request actually ends in a running app instead of stopping halfway:
 *
 *   artifact? -> files? -> dependencies + start command? -> server ready? -> preview
 *
 * Every step reuses the existing Bolt machinery (artifacts, action runner, previews store);
 * the guard only fills in the steps the model left out.
 */
export async function runExecutionGuard(context: ExecutionGuardContext): Promise<ExecutionGuardOutcome> {
  const { assistantMessageId, userMessage, recoveryAttempt } = context;

  await workbenchStore.waitForPendingActions();

  const actions = getTurnActions(assistantMessageId);
  const fileActions = actions.filter((action) => action.type === 'file');
  const startActions = actions.filter((action) => action.type === 'start');

  if (actions.length === 0) {
    if (!detectBuildIntent(userMessage)) {
      return 'idle';
    }

    if (recoveryAttempt >= MAX_RECOVERY_ATTEMPTS) {
      logger.info('No executable artifact detected, recovery budget exhausted');
      return 'no-artifact';
    }

    logger.info('No executable artifact detected, requesting one executable retry');
    context.requestArtifactRecovery();

    return 'artifact-recovery';
  }

  logger.info(`Artifact detected: ${fileActions.length} file action(s), ${startActions.length} start action(s)`);

  /*
   * The queue keeps going after one action fails (Cresova Builder) rather than stopping the whole
   * turn, which is the right call for the actions that follow — but left unchecked here it also
   * means a turn with three missing files sails on to 'preview-ready' exactly like a turn that
   * wrote everything. The failure lived in a console log and nowhere else. Surfaced and stopped
   * here instead: building the next phase on a project that is missing files spends money making
   * the result worse, not better.
   */
  const failureAlert = describeActionFailures(actions);

  if (failureAlert) {
    logger.warn(`${failureAlert.description} ${failureAlert.content}`);
    workbenchStore.actionAlert.set({ type: 'error', ...failureAlert });

    return 'actions-failed';
  }

  /*
   * A plan is only advanced after a turn that actually wrote files. A phase that produced nothing
   * means something went wrong, and asking for the next one would spend money building on top of a
   * project that is not there.
   */
  const pending = fileActions.length > 0 ? nextPhase(context.messages) : undefined;

  const files = workbenchStore.files.get();
  const hasProjectFiles = Object.values(files).some((dirent) => dirent?.type === 'file');

  if (!hasProjectFiles) {
    return 'idle';
  }

  // The model already started something: just wait for the server and show it.
  if (startActions.length > 0 || hasReadyPreview()) {
    const ready = await waitForPreview(
      PREVIEW_TIMEOUT_MS,
      () => startActions.length > 0 && startActions.every((action) => action.status === 'failed'),
    );

    if (!ready) {
      logger.warn('No preview URL was reported by the execution backend');
      workbenchStore.actionAlert.set({ ...PREVIEW_TIMEOUT_ALERT });

      return 'preview-timeout';
    }

    logger.info(`Server ready: ${workbenchStore.previews.get()[0]?.baseUrl}`);
    showPreview();

    /*
     * Asked for after the preview, not before: phase one leaves the site running, and every later
     * phase enriches something the user can already watch changing.
     */
    if (pending) {
      logger.info(`Advancing to phase ${pending.number}/${pending.total}`);
      context.requestNextPhase(phasePrompt(pending));

      return 'next-phase';
    }

    return 'preview-ready';
  }

  // Files were written but nothing runs them: complete the cycle ourselves.
  const commands = await detectWorkspaceCommands(files);

  if (!commands.startCommand) {
    logger.info('No start command could be derived from the workspace, skipping auto start');
    return 'no-start-command';
  }

  const needsInstall = !(await hasInstalledDependencies());

  /*
   * Install and start go in one command on purpose. As two separate actions the server could be
   * started before the install had finished, which fails with "vite: command not found", and any
   * command queued in between interrupts the one running. Chained in a single start action they
   * cannot be separated, and start actions do not block the queue.
   */
  const command = needsInstall ? `npm install && ${commands.startCommand}` : commands.startCommand;

  const autoStartMessage: Message = {
    id: generateId(),
    role: 'assistant',
    createdAt: new Date(),
    annotations: [AUTO_START_ANNOTATION],
    content: `Starting the application so the preview can be shown.
<boltArtifact id="cresova-auto-start" title="Start Application" type="bundled">
<boltAction type="start">${command}</boltAction>
</boltArtifact>`,
  };

  logger.info(`Missing start action, running "${command}"`);
  context.appendAssistantMessage(autoStartMessage);

  const ready = await waitForPreview(PREVIEW_TIMEOUT_MS);

  if (!ready) {
    logger.warn('Auto start did not produce a preview URL');
    workbenchStore.actionAlert.set({ ...PREVIEW_TIMEOUT_ALERT });

    return 'preview-timeout';
  }

  logger.info(`Server ready: ${workbenchStore.previews.get()[0]?.baseUrl}`);
  showPreview();

  if (pending) {
    logger.info(`Advancing to phase ${pending.number}/${pending.total}`);
    context.requestNextPhase(phasePrompt(pending));

    return 'next-phase';
  }

  return 'auto-start';
}
