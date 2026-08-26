import { beforeAll, describe, expect, it, vi } from 'vitest';
import { describeBrowserErrors, watchBrowserErrors } from './browser-errors';

/** A window just real enough to throw things at. */
const handlers = new Map<string, Array<(event: unknown) => void>>();

const fakeWindow = {
  addEventListener(type: string, listener: (event: unknown) => void) {
    handlers.set(type, [...(handlers.get(type) ?? []), listener]);
  },
};

function fire(type: string, event: unknown) {
  for (const handler of handlers.get(type) ?? []) {
    handler(event);
  }
}

const report = () => describeBrowserErrors().join('\n');

describe('what the browser reports when something throws', () => {
  beforeAll(() => {
    vi.stubGlobal('window', fakeWindow);
    watchBrowserErrors();
  });

  it('says so plainly when nothing has thrown', () => {
    expect(report()).toContain('ninguno');
  });

  it('keeps an uncaught error and where it came from', () => {
    fire('error', {
      message: 'Cannot read properties of undefined (reading `map`)',
      filename: 'https://cresova.com/assets/Header-BL6qiV7W.js',
      lineno: 42,
      colno: 7,
    });

    expect(report()).toContain('Cannot read properties of undefined');
    expect(report()).toContain('en https://cresova.com/assets/Header-BL6qiV7W.js:42:7');
  });

  it('keeps a promise nobody handled, which has no place to point at', () => {
    fire('unhandledrejection', { reason: new Error('The runner did not answer fs.writeFile in time') });

    expect(report()).toContain('The runner did not answer fs.writeFile in time');
  });

  it('reads a rejection that was thrown as a plain string', () => {
    fire('unhandledrejection', { reason: 'sin motivo' });

    expect(report()).toContain('sin motivo');
  });

  /*
   * A render loop throws the same thing hundreds of times, and the errors that explain it are the
   * ones that came before. Counting keeps them; keeping copies would push them out.
   */
  it('counts a repeat instead of letting it push out what came before', () => {
    const before = report();

    for (let index = 0; index < 50; index++) {
      fire('unhandledrejection', { reason: 'en bucle' });
    }

    expect(report()).toContain('en bucle (×50)');
    expect(report()).toContain('Cannot read properties of undefined');
    expect(before).not.toContain('en bucle');
  });

  it('keeps the report short when everything is different', () => {
    for (let index = 0; index < 30; index++) {
      fire('unhandledrejection', { reason: `fallo distinto ${index}` });
    }

    expect(report()).toContain('fallo distinto 29');
    expect(report()).not.toContain('fallo distinto 0 ');
    expect(report().split('\n').length).toBeLessThan(20);
  });

  it('cuts a message that arrives as a whole stack trace', () => {
    fire('unhandledrejection', { reason: 'x'.repeat(5000) });

    for (const line of describeBrowserErrors()) {
      expect(line.length).toBeLessThan(400);
    }
  });
});
