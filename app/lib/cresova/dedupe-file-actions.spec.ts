import { describe, expect, it } from 'vitest';
import type { ActionState } from '~/lib/runtime/action-runner';
import { dedupeFileActions } from './dedupe-file-actions';

/*
 * Only the fields dedupeFileActions actually reads are filled in; the rest of ActionState is cast
 * away, since a real one only exists behind a live action runner.
 */
function fileAction(filePath: string, status: ActionState['status'] = 'complete'): ActionState {
  return { type: 'file', filePath, content: '', status, executed: true, abort: () => undefined } as ActionState;
}

function shellAction(content: string, status: ActionState['status'] = 'complete'): ActionState {
  return { type: 'shell', content, status, executed: true, abort: () => undefined } as ActionState;
}

describe('dedupeFileActions', () => {
  it('leaves a turn with no repeats untouched', () => {
    const actions = [fileAction('src/App.tsx'), shellAction('npm install'), fileAction('src/Hero.tsx')];

    expect(dedupeFileActions(actions)).toEqual(actions);
  });

  it('collapses a file repeated by a continuation into the row it first appeared in', () => {
    const first = fileAction('src/App.tsx', 'complete');
    const repeat = fileAction('src/App.tsx', 'complete');
    const actions = [first, shellAction('npm install'), repeat];

    const result = dedupeFileActions(actions);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(repeat); // the row stays first, but shows the latest action for that path
    expect(result[1]).toBe(actions[1]);
  });

  it('never merges two different files, even with the same status', () => {
    const actions = [fileAction('src/App.tsx'), fileAction('src/Hero.tsx')];

    expect(dedupeFileActions(actions)).toEqual(actions);
  });

  it('does not touch non-file actions at all, repeated or not', () => {
    const actions = [shellAction('npm install'), shellAction('npm install')];

    expect(dedupeFileActions(actions)).toEqual(actions);
  });

  it('handles an empty turn', () => {
    expect(dedupeFileActions([])).toEqual([]);
  });
});
