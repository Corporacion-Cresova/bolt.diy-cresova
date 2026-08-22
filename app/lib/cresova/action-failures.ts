import type { ActionState } from '~/lib/runtime/action-runner';

/**
 * Turns a turn's failed actions into something worth showing, or nothing when none failed.
 *
 * Split out from `execution-guard.ts` on purpose: that module imports `workbenchStore`, which
 * pulls in the live WebContainer/runner connection as a side effect of the import itself, so
 * nothing that imports it can be unit tested cheaply. This piece has no such import, so it can be.
 */
export interface ActionFailureAlert {
  title: string;
  description: string;
  content: string;
}

export function describeActionFailures(actions: ActionState[]): ActionFailureAlert | undefined {
  const failed = actions.filter((action) => action.status === 'failed');

  if (failed.length === 0) {
    return undefined;
  }

  const paths = failed.map((action) => ('filePath' in action ? action.filePath : action.type)).join(', ');

  return {
    title: 'Algunas acciones fallaron',
    description: `${failed.length} de ${actions.length} acciones no se completaron.`,
    content: paths,
  };
}
