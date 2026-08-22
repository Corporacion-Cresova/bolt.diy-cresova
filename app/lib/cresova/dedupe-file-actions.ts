import type { ActionState } from '~/lib/runtime/action-runner';

/**
 * Collapses repeated file actions in the artifact list down to one row per path.
 *
 * A continued response repeats every file action emitted so far (`action-runner.ts`
 * `#isRepeatOfAnExecutedAction`), each under a fresh `actionId` so the repeat gets its own map
 * entry rather than overwriting the original. The action runner already skips re-running it; this
 * is the other half, for the list the user actually looks at, which otherwise shows the same file
 * twice.
 *
 * The row stays where the file first appeared — the list should not reshuffle mid-stream — but
 * shows the most recent action for that path, so its status reflects what actually happened last.
 */
export function dedupeFileActions(actions: ActionState[]): ActionState[] {
  const latestByPath = new Map<string, ActionState>();

  for (const action of actions) {
    if (action.type === 'file') {
      latestByPath.set(action.filePath, action);
    }
  }

  const firstSeen = new Set<string>();

  return actions
    .filter((action) => {
      if (action.type !== 'file') {
        return true;
      }

      if (firstSeen.has(action.filePath)) {
        return false;
      }

      firstSeen.add(action.filePath);

      return true;
    })
    .map((action) => (action.type === 'file' ? latestByPath.get(action.filePath)! : action));
}
