import type { Message } from 'ai';
import type { ActionState } from '~/lib/runtime/action-runner';
import { workbenchStore } from '~/lib/stores/workbench';
import { generateId } from '~/utils/fileUtils';
import { createScopedLogger } from '~/utils/logger';
import { detectBuildIntent } from './build-intent';
import { detectWorkspaceCommands, hasInstalledDependencies } from './dev-server';

const logger = createScopedLogger('CresovaBuilder');

/** Never more than this, no matter what: every retry costs OpenRouter tokens. */
export const MAX_RECOVERY_ATTEMPTS = 1;

/** How long we wait for WebContainer to report a preview URL after starting the app. */
const PREVIEW_TIMEOUT_MS = 120_000;

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
}

export type ExecutionGuardOutcome =
  | 'idle'
  | 'artifact-recovery'
  | 'no-artifact'
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

async function waitForPreview(timeoutMs: number, giveUp?: () => boolean): Promise<boolean> {
  if (hasReadyPreview()) {
    return true;
  }

  return new Promise<boolean>((resolve) => {
    const finish = (ready: boolean) => {
      clearTimeout(timeout);
      clearInterval(giveUpInterval);
      unsubscribe();
      resolve(ready);
    };

    const timeout = setTimeout(() => finish(false), timeoutMs);

    // stop waiting as soon as the start action itself reported a failure
    const giveUpInterval = setInterval(() => {
      if (giveUp?.()) {
        finish(false);
      }
    }, 1000);

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
      logger.warn('No preview URL was reported by WebContainer');
      return 'preview-timeout';
    }

    logger.info(`Server ready: ${workbenchStore.previews.get()[0]?.baseUrl}`);
    showPreview();

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
    return 'preview-timeout';
  }

  logger.info(`Server ready: ${workbenchStore.previews.get()[0]?.baseUrl}`);
  showPreview();

  return 'auto-start';
}
