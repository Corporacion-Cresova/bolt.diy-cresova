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

/** a turn still being written, with nothing serving yet */
const building = { turnOpen: true, hasPreview: false };

/** a turn that is over */
const done = { turnOpen: false, hasPreview: false };

describe('describeBuildProgress', () => {
  it('counts the files that are done, not the actions that were emitted', () => {
    /*
     * A continued response re-emits every file it has written so far, each under a fresh action id.
     * Counting raw actions would tell the user "8 de 12" for a build of four files.
     */
    const progress = describeBuildProgress({
      ...building,
      actions: [file('src/App.tsx'), file('src/main.tsx'), file('src/App.tsx', 'running')],
    });

    expect(progress.filesTotal).toBe(2);
    expect(progress.filesDone).toBe(1);
    expect(progress.message).toContain('1 de 2');
    expect(progress.stage).toBe('writing');
  });

  it('names the install and the server start rather than the files behind them', () => {
    const installing = describeBuildProgress({ ...building, actions: [file('package.json'), shell()] });
    expect(installing.stage).toBe('installing');
    expect(installing.message).toContain('dependencias');

    const starting = describeBuildProgress({
      ...building,
      actions: [file('package.json'), shell('complete'), start()],
    });
    expect(starting.stage).toBe('starting');
    expect(starting.message).toContain('servidor');
  });

  it('stops saying "starting the server" once the server is actually serving', () => {
    /*
     * The bug this whole file exists to prevent coming back.
     *
     * `action-runner.ts` starts the dev server without blocking and only marks the action complete
     * when its promise resolves — which is when the process *exits*. A server that works never
     * exits, so the action sits at `running` forever. Reading that as "still starting" meant the
     * chat announced "Arrancando el servidor" for as long as the project stayed healthy, with a
     * live preview sitting right next to it.
     */
    const progress = describeBuildProgress({
      turnOpen: false,
      hasPreview: true,
      actions: [file('src/App.tsx'), file('src/main.tsx'), start('running')],
    });

    expect(progress.stage).toBe('ready');
    expect(progress.busy).toBe(false);
    expect(progress.message).toContain('Sitio listo');
  });

  it('still says "starting" while the turn is open and no preview has arrived', () => {
    // the case where that message was right, and must survive the fix above
    const progress = describeBuildProgress({ ...building, actions: [file('package.json'), start('running')] });

    expect(progress.stage).toBe('starting');
    expect(progress.busy).toBe(true);
  });

  it('reports a failed file ahead of whatever ran after it', () => {
    /*
     * The queue keeps going after a failure — that was the fix for the poisoned chain — so a build
     * with a broken file carries right on to the install. Saying "installing" there would hide the
     * only thing the user can act on.
     */
    const progress = describeBuildProgress({
      ...building,
      actions: [file('src/App.tsx', 'failed'), shell()],
    });

    expect(progress.stage).toBe('failed');
    expect(progress.failedPaths).toEqual(['src/App.tsx']);
    expect(progress.message).toContain('1 archivo');
  });

  it('prefers the runner giving up over any stage still nominally in motion', () => {
    const progress = describeBuildProgress({
      ...building,
      actions: [file('package.json'), start()],
      serverTimeout: 'el proceso murió',
    });

    expect(progress.stage).toBe('stalled');
    expect(progress.busy).toBe(false);
  });

  it('calls a turn that ended mid-file incomplete, and stops spinning on it', () => {
    /*
     * A response cut off by the output limit leaves its last file action at `pending` for good:
     * the closing tag never arrives, so nothing ever runs it. Left in the "writing" branch it
     * pinned the card at "3 de 4" for the rest of the session.
     */
    const progress = describeBuildProgress({
      ...done,
      actions: [file('a.tsx'), file('b.tsx'), file('c.tsx'), file('d.tsx', 'pending')],
    });

    expect(progress.stage).toBe('truncated');
    expect(progress.busy).toBe(false);
    expect(progress.message).toContain('3 de 4');
  });

  it('lets a live preview outrank an unfinished file from the same turn', () => {
    // the site is up; whatever the turn left half-written, it is not still being written
    const progress = describeBuildProgress({
      turnOpen: false,
      hasPreview: true,
      actions: [file('a.tsx'), file('b.tsx', 'pending')],
    });

    expect(progress.stage).toBe('ready');
    expect(progress.busy).toBe(false);
  });

  it('is ready once a preview exists and nothing is still running', () => {
    const progress = describeBuildProgress({
      turnOpen: false,
      hasPreview: true,
      actions: [file('src/App.tsx'), file('src/main.tsx'), start('complete')],
    });

    expect(progress.stage).toBe('ready');
    expect(progress.message).toContain('2 archivos');
    expect(progress.busy).toBe(false);
  });

  it('says something while the model is still writing and no action exists yet', () => {
    const progress = describeBuildProgress({ turnOpen: true, hasPreview: false, actions: [] });

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
      ...done,
      actions: [file('src/App.tsx'), file('src/main.tsx'), start('complete')],
    });

    expect(progress.stage).toBe('written');
    expect(progress.busy).toBe(false);
    expect(progress.message).toContain('sin vista previa');
  });

  it('has nothing to say before a build starts', () => {
    const progress = describeBuildProgress({ ...done, actions: [] });

    expect(progress.stage).toBe('idle');
    expect(progress.busy).toBe(false);
  });
});
