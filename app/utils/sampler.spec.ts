import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSampler } from './sampler';

/**
 * A stand-in for `document` good enough for the one thing the sampler asks of it.
 *
 * `jsdom` is not among this project's test dependencies and pulling it in for a boolean and an
 * event listener would be a poor trade.
 */
function fakeDocument() {
  const listeners: Array<() => void> = [];

  return {
    hidden: false,
    addEventListener(type: string, listener: () => void) {
      if (type === 'visibilitychange') {
        listeners.push(listener);
      }
    },
    removeEventListener() {},
    hide(this: { hidden: boolean }) {
      this.hidden = true;
      listeners.forEach((listener) => listener());
    },
  };
}

describe('createSampler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as Record<string, unknown>).document;
  });

  it('runs the first call at once and drops the ones crowded behind it', () => {
    const fn = vi.fn();
    const sampled = createSampler(fn, 100);

    sampled('a');
    sampled('b');
    sampled('c');

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('still runs the last call of a burst once the interval is up', () => {
    const fn = vi.fn();
    const sampled = createSampler(fn, 100);

    sampled('a');
    sampled('b');
    sampled('c');

    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('c');
  });

  it('does not run a trailing call that was already made', () => {
    const fn = vi.fn();
    const sampled = createSampler(fn, 100);

    sampled('a');
    vi.advanceTimersByTime(200);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('makes the pending call the moment the tab goes to the background', () => {
    /*
     * Without this the trailing call waits on a timer the browser has just decided to clamp — to a
     * second at first, to once a minute after five. The last chunk of a file, or the last parse of
     * a message, would sit there for as long as nobody looked at the tab.
     */
    const document = fakeDocument();
    (globalThis as Record<string, unknown>).document = document;

    const fn = vi.fn();
    const sampled = createSampler(fn, 100);

    sampled('a');
    sampled('b');

    expect(fn).toHaveBeenCalledTimes(1);

    document.hide();

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('b');

    // and the timer it replaced must not fire a second time with the same arguments
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('has nothing to do on hide when no call is pending', () => {
    const document = fakeDocument();
    (globalThis as Record<string, unknown>).document = document;

    const fn = vi.fn();
    createSampler(fn, 100);

    document.hide();

    expect(fn).not.toHaveBeenCalled();
  });
});
