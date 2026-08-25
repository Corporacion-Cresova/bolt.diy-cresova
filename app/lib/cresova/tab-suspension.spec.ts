import { beforeAll, describe, expect, it, vi } from 'vitest';
import { describeTabSuspension, recordRunnerMessage, watchTabSuspension } from './tab-suspension';

/**
 * A document just real enough to be left and come back to.
 *
 * The module reads `document` when something happens rather than when it loads, so a stand-in that
 * can change its visibility and replay its listeners is the whole harness this needs.
 */
function fakeDocument() {
  const listeners = new Map<string, Array<() => void>>();

  return {
    visibilityState: 'visible' as 'visible' | 'hidden',
    addEventListener(type: string, listener: () => void) {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    fire(type: string) {
      for (const listener of listeners.get(type) ?? []) {
        listener();
      }
    },
    leave(this: { visibilityState: string; fire: (type: string) => void }) {
      this.visibilityState = 'hidden';
      this.fire('visibilitychange');
    },
    comeBack(this: { visibilityState: string; fire: (type: string) => void }) {
      this.visibilityState = 'visible';
      this.fire('visibilitychange');
    },
  };
}

const doc = fakeDocument();

describe('what a tab records about being left in the background', () => {
  beforeAll(() => {
    vi.stubGlobal('document', doc);

    /*
     * Deliberately absent, which is a case the report has to survive: only Chromium reports long
     * tasks, and a report that threw on Firefox would take the rest of the diagnostics with it.
     */
    vi.stubGlobal('PerformanceObserver', undefined);

    watchTabSuspension();
  });

  it('says nothing happened before anything has', () => {
    expect(describeTabSuspension().join('\n')).toContain('no se ha vuelto a la pestaña');
  });

  it('counts what the runner sent only while nobody was watching', () => {
    recordRunnerMessage(1000);
    expect(describeTabSuspension().join('\n')).not.toContain('KB');

    doc.leave();
    recordRunnerMessage(4096);
    recordRunnerMessage(4096);

    // the clock is real, so the stretch has to be long enough to count as one
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 60_000);
    doc.comeBack();
    vi.useRealTimers();

    const report = describeTabSuspension().join('\n');

    expect(report).toContain('2 mensajes');
    expect(report).toContain('8 KB');
    expect(report).toContain('tras 60 s fuera');
  });

  it('reports being frozen, which is what tells an avalanche from a slow tab', () => {
    doc.leave();
    doc.fire('freeze');

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 30_000);
    doc.comeBack();
    vi.useRealTimers();

    const report = describeTabSuspension().join('\n');

    expect(report).toContain('el navegador llegó a congelarla: sí');
    expect(report).toContain('congelada');
  });

  it('ignores a glance at another window', () => {
    const before = describeTabSuspension().length;

    doc.leave();
    doc.comeBack();

    expect(describeTabSuspension().length).toBe(before);
  });

  it('carries counts and never the contents of what it counted', () => {
    doc.leave();
    recordRunnerMessage('OPEN_ROUTER_API_KEY=sk-or-v1-not-a-real-key'.length);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 20_000);
    doc.comeBack();
    vi.useRealTimers();

    expect(describeTabSuspension().join('\n')).not.toMatch(/sk-|API_KEY|=/);
  });
});
