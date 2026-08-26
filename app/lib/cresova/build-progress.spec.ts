import { describe, expect, it } from 'vitest';
import type { ActionState } from '~/lib/runtime/action-runner';
import { describeBuildProgress } from './build-progress';

function file(filePath: string, status: ActionState['status'] = 'complete'): ActionState {
  return { type: 'file', filePath, content: '', status, abort() {}, executed: true } as unknown as ActionState;
}

function shell(status: ActionState['status'] = 'running'): ActionState {
  return { type: 'shell', content: 'npm install', status, abort() {}, executed: true } as unknown as ActionState;
}

function start(status: ActionState['status'] = 'running'): ActionState {
  return { type: 'start', content: 'npm run dev', status, abort() {}, executed: true } as unknown as ActionState;
}

const quiet = { streaming: false, hasPreview: false };

describe('describeBuildProgress', () => {
  it('counts the files that are done, not the actions that were emitted', () => {
    /*
     * A continued response re-emits every file it has written so far, each under a fresh action id.
     * Counting raw actions would tell the user "8 de 12" for a build of four files.
     */
    const progress = describeBuildProgress({
      ...quiet,
      actions: [file('src/App.tsx'), file('src/main.tsx'), file('src/App.tsx', 'running')],
    });

    expect(progress.filesTotal).toBe(2);
    expect(progress.filesDone).toBe(1);
    expect(progress.message).toContain('1 de 2');
    expect(progress.stage).toBe('writing');
  });

  it('names the install and the server start rather than the files behind them', () => {
    const installing = describeBuildProgress({ ...quiet, actions: [file('package.json'), shell()] });
    expect(installing.stage).toBe('installing');
    expect(installing.message).toContain('dependencias');

    const starting = describeBuildProgress({ ...quiet, actions: [file('package.json'), shell('complete'), start()] });
    expect(starting.stage).toBe('starting');
    expect(starting.message).toContain('servidor');
  });

  it('reports a failed file ahead of whatever ran after it', () => {
    /*
     * The queue keeps going after a failure — that was the fix for the poisoned chain — so a build
     * with a broken file carries right on to the install. Saying "installing" there would hide the
     * only thing the user can act on.
     */
    const progress = describeBuildProgress({
      ...quiet,
      actions: [file('src/App.tsx', 'failed'), shell()],
    });

    expect(progress.stage).toBe('failed');
    expect(progress.failedPaths).toEqual(['src/App.tsx']);
    expect(progress.message).toContain('1 archivo');
  });

  it('prefers the runner giving up over any stage still nominally in motion', () => {
    const progress = describeBuildProgress({
      ...quiet,
      actions: [file('package.json'), start()],
      serverTimeout: 'el proceso murió',
    });

    expect(progress.stage).toBe('stalled');
    expect(progress.busy).toBe(false);
  });

  it('is ready once a preview exists and nothing is still running', () => {
    const progress = describeBuildProgress({
      streaming: false,
      hasPreview: true,
      actions: [file('src/App.tsx'), file('src/main.tsx'), start('complete')],
    });

    expect(progress.stage).toBe('ready');
    expect(progress.message).toContain('2 archivos');
    expect(progress.busy).toBe(false);
  });

  it('says something while the model is still writing and no action exists yet', () => {
    const progress = describeBuildProgress({ streaming: true, hasPreview: false, actions: [] });

    expect(progress.stage).toBe('thinking');
    expect(progress.busy).toBe(true);
  });

  it('does not spin forever on a turn that finished without a preview', () => {
    /*
     * The files are on disk and nothing is running. A build that ended this way is still
     * publishable — publishing compiles the disk, not the dev server — so it must not read as if it
     * were still working.
     */
    const progress = describeBuildProgress({
      ...quiet,
      actions: [file('src/App.tsx'), file('src/main.tsx'), start('complete')],
    });

    expect(progress.stage).toBe('written');
    expect(progress.busy).toBe(false);
    expect(progress.message).toContain('sin vista previa');
  });

  it('has nothing to say before a build starts', () => {
    const progress = describeBuildProgress({ ...quiet, actions: [] });

    expect(progress.stage).toBe('idle');
    expect(progress.busy).toBe(false);
  });
});
