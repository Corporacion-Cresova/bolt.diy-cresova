import { describe, expect, it } from 'vitest';
import type { ActionState } from '~/lib/runtime/action-runner';
import { describeActionFailures } from './action-failures';

/*
 * Only the fields describeActionFailures actually reads are filled in; the rest of ActionState is
 * cast away rather than faked field by field, since a real one only exists behind a live runner.
 */
function action(overrides: Partial<ActionState> & Pick<ActionState, 'status' | 'type'>): ActionState {
  return {
    content: '',
    abort: () => undefined,
    executed: false,
    abortSignal: new AbortController().signal,
    ...overrides,
  } as ActionState;
}

describe('describeActionFailures', () => {
  it('says nothing when every action completed', () => {
    const actions = [
      action({ type: 'file', filePath: 'src/App.tsx', status: 'complete' }),
      action({ type: 'start', status: 'complete' }),
    ];

    expect(describeActionFailures(actions)).toBeUndefined();
  });

  it('reports the failed files by path, not the ones that succeeded', () => {
    const actions = [
      action({ type: 'file', filePath: 'src/App.tsx', status: 'complete' }),
      action({ type: 'file', filePath: 'src/components/Hero.tsx', status: 'failed', error: 'disk full' }),
      action({ type: 'file', filePath: 'src/components/Footer.tsx', status: 'failed', error: 'disk full' }),
    ];

    const alert = describeActionFailures(actions);

    expect(alert?.description).toBe('2 de 3 acciones no se completaron.');
    expect(alert?.content).toBe('src/components/Hero.tsx, src/components/Footer.tsx');
    expect(alert?.content).not.toContain('App.tsx');
  });

  it('falls back to the action type for a failure with no file path', () => {
    const actions = [action({ type: 'start', status: 'failed', error: 'vite: command not found' })];

    expect(describeActionFailures(actions)?.content).toBe('start');
  });

  it('treats an empty turn as nothing having failed', () => {
    expect(describeActionFailures([])).toBeUndefined();
  });
});
