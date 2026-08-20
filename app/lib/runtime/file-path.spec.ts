import { describe, expect, it } from 'vitest';
import { toWorkdirRelative } from './action-runner';

/*
 * This decides where every generated file lands. It was computed with path.relative on a path that
 * is often already relative, which resolves it against the process working directory and returns a
 * path climbing out of the project — so the files were written outside it, or rejected, and the
 * only symptom was npm not finding package.json much later.
 */
const WORK_DIR = '/home/project';

describe('toWorkdirRelative', () => {
  it('leaves a path that is already relative alone', () => {
    expect(toWorkdirRelative(WORK_DIR, 'package.json')).toBe('package.json');
    expect(toWorkdirRelative(WORK_DIR, 'src/components/Hero.tsx')).toBe('src/components/Hero.tsx');
  });

  it('strips a leading ./, which models write often', () => {
    expect(toWorkdirRelative(WORK_DIR, './package.json')).toBe('package.json');
  });

  it('makes an absolute path relative to the working directory', () => {
    expect(toWorkdirRelative(WORK_DIR, '/home/project/package.json')).toBe('package.json');
    expect(toWorkdirRelative(WORK_DIR, '/home/project/src/App.tsx')).toBe('src/App.tsx');
  });

  it('tolerates the whitespace a streamed attribute can carry', () => {
    expect(toWorkdirRelative(WORK_DIR, '  src/App.tsx  ')).toBe('src/App.tsx');
  });

  /*
   * The regression itself: no result may ever climb out of the project. The runner rejects such a
   * path outright and WebContainer would write it somewhere nobody looks.
   */
  it('never returns a path that climbs out of the project', () => {
    for (const candidate of ['package.json', './src/App.tsx', '/home/project/tailwind.config.js']) {
      expect(toWorkdirRelative(WORK_DIR, candidate).startsWith('..')).toBe(false);
    }
  });
});
