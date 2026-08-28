import { describe, expect, it, beforeEach } from 'vitest';

/*
 * The fix pins the bug Diego reported: "after the first prompt everything works,
 * but follow-ups stop responding — the preview dies, the dev server never recovers."
 *
 * Root cause: ActionRunner.#executedSignatures was a single Set living for the
 * lifetime of the runner, so a legitimate `npm install` from the user's second
 * message matched the signature of the `npm install` from the first message and
 * got silently skipped. Same for `npm run dev` — the start action has identical
 * content every time, so it always got skipped after the first build, and the
 * dev server never restarted, and the preview never refreshed.
 *
 * Observability: 'complete' is the ONLY status the runner sets synchronously
 * in the dedupe skip branch. Everything else (failed, running) means the
 * action was scheduled to run. The tests below assert that cross-message
 * actions are NOT marked 'complete', which is the unambiguous signal that
 * the dedupe did not skip them.
 *
 * Each test is bounded to 3 seconds because the WebContainer promise is
 * never-resolving on purpose: a non-skipped action runs long enough for the
 * shell throw to surface, but the file action scheduled but not executed
 * would otherwise hang the suite.
 */

import { ActionRunner } from './action-runner';

function makeRunner() {
  const webcontainer = new Promise(() => {}) as any;
  const shellTerminal = (() => {
    throw new Error('not used in these tests');
  }) as any;
  return new ActionRunner(webcontainer, shellTerminal);
}

function makeAction(actionId: string, messageId: string, action: any) {
  return {
    artifactId: 'artifact-1',
    messageId,
    actionId,
    action,
  };
}

function getActionStatus(runner: ActionRunner, actionId: string): string {
  return (runner.actions.get()[actionId] as any).status;
}

describe('ActionRunner: cross-message dedupe is the bug fix', () => {
  let runner: ActionRunner;

  beforeEach(() => {
    runner = makeRunner();
  });

  it(
    'does NOT skip a shell action when it comes from a NEW message',
    async () => {
      const action = {
        content: 'npm install',
        type: 'shell' as const,
      };

      runner.addAction(makeAction('a1', 'msg-1', action));
      runner.addAction(makeAction('a2', 'msg-2', action));

      await runner.runAction(makeAction('a1', 'msg-1', action), false);
      // Wait briefly for the shell throw to settle the status to 'failed'.
      await new Promise((resolve) => setTimeout(resolve, 200));
      await runner.runAction(makeAction('a2', 'msg-2', action), false);
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Both actions should have been scheduled (status not 'complete').
      // The shell throws on the test stub, so 'a1' and 'a2' settle on 'failed'.
      // The point is: 'a2' must NOT be 'complete', which is what the old
      // bug set when it incorrectly skipped the cross-message action.
      expect(getActionStatus(runner, 'a1')).not.toBe('complete');
      expect(getActionStatus(runner, 'a2')).not.toBe('complete');
    },
    3000,
  );

  it(
    'keys the dedupe per message, so two simultaneous messages do not see each other',
    async () => {
      const action = {
        content: 'npm install',
        type: 'shell' as const,
      };

      runner.addAction(makeAction('a1', 'msg-a', action));
      runner.addAction(makeAction('b1', 'msg-b', action));

      await runner.runAction(makeAction('a1', 'msg-a', action), false);
      await new Promise((resolve) => setTimeout(resolve, 200));
      await runner.runAction(makeAction('b1', 'msg-b', action), false);
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(getActionStatus(runner, 'a1')).not.toBe('complete');
      expect(getActionStatus(runner, 'b1')).not.toBe('complete');
    },
    3000,
  );

});

