import { describe, expect, it } from 'vitest';
import { watchDevServerErrors } from './dev-server-errors';

/*
 * The real output that produced this, kept verbatim. A dev server that serves perfectly and
 * compiles badly is the case the whole file exists for: everything upstream reads healthy and the
 * user gets a blank page.
 */
const REAL_FAILURE =
  '1:18:33 AM [31m[1m[vite][22m[39m Pre-transform error: [postcss] ' +
  "/data/projects/cresova-8f50bc13b49892fb/src/index.css:76:5: @apply should not be used with the 'group' utility\n";

/*
 * And the noise it has to sit next to. An install prints all of this every single time, so a
 * matcher that fires on any of it is worse than no matcher: the alert stops meaning anything.
 */
const ORDINARY_NOISE = `
added 275 packages, and audited 276 packages in 20s

65 packages are looking for funding
  run \`npm fund\` for details

17 vulnerabilities (2 low, 4 moderate, 11 high)

To address all issues, run:
  npm audit fix

Run \`npm audit\` for details.

  VITE v5.4.8  ready in 354 ms

  ➜  Local:   http://localhost:5173/
Browserslist: caniuse-lite is outdated. Please run:
  npx update-browserslist-db@latest
`;

describe('reading a dev server error out of its own output', () => {
  it('says nothing about an ordinary install and startup', () => {
    const watcher = watchDevServerErrors();

    for (const line of ORDINARY_NOISE.split('\n')) {
      expect(watcher.read(`${line}\n`)).toBeUndefined();
    }
  });

  it('catches the stylesheet that would not compile, without the colour codes', () => {
    const failure = watchDevServerErrors().read(REAL_FAILURE);

    expect(failure).toContain('Pre-transform error');
    expect(failure).toContain('src/index.css:76:5');
    expect(failure).toContain("@apply should not be used with the 'group' utility");
    expect(failure).not.toContain('');
  });

  it('catches a message split across two chunks, because output arrives where it arrives', () => {
    const watcher = watchDevServerErrors();
    const half = Math.floor(REAL_FAILURE.length / 2);

    expect(watcher.read(REAL_FAILURE.slice(0, half))).toBeUndefined();
    expect(watcher.read(REAL_FAILURE.slice(half))).toContain('@apply should not be used');
  });

  it('reports the same error once, however many times the server repeats it', () => {
    const watcher = watchDevServerErrors();

    expect(watcher.read(REAL_FAILURE)).toBeTruthy();
    expect(watcher.read(REAL_FAILURE)).toBeUndefined();
    expect(watcher.read(REAL_FAILURE)).toBeUndefined();
  });

  it('reports a different error after one it already reported', () => {
    const watcher = watchDevServerErrors();

    expect(watcher.read(REAL_FAILURE)).toBeTruthy();
    expect(watcher.read('[vite] Internal server error: Failed to load url /src/missing.tsx\n')).toContain(
      'Internal server error',
    );
  });

  it('catches the other shapes the same failure takes', () => {
    expect(watchDevServerErrors().read('error during build:\nsomething broke\n')).toContain('error during build');
    expect(watchDevServerErrors().read('Failed to resolve import "./nope" from "src/App.tsx"\n')).toContain(
      'Failed to resolve import',
    );
  });

  /*
   * The tail carried between chunks has to stay bounded. The bug this whole session started from
   * was an unbounded buffer re-scanned on every chunk, so this pins the shape rather than trusting
   * it: a megabyte of output must not make the next read any more expensive than the first.
   */
  it('does not grow what it re-scans as the output grows', () => {
    const watcher = watchDevServerErrors();
    const chunk = 'x'.repeat(4096);

    const started = performance.now();

    for (let index = 0; index < 500; index++) {
      watcher.read(chunk);
    }

    expect(performance.now() - started).toBeLessThan(1000);
  });
});
