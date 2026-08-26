/**
 * Reads a dev server's own complaints out of its output.
 *
 * A project can compile badly and still serve: Vite binds its port, answers requests, and reports
 * the broken file as an error on the module it cannot transform. Everything downstream then looks
 * healthy — the readiness probe gets its answer, the preview is announced, the workbench shows a
 * live preview — and the user gets a blank page with the reason sitting in a terminal panel nobody
 * has open.
 *
 * That happened: a generated stylesheet used `@apply` on Tailwind's `group` marker, which is not a
 * utility and produces no CSS. The dev server said so on the line it happened, `npm run build`
 * failed with the same message, and from the outside it was "the preview does not work".
 *
 * Vite's own error prefixes are the whole vocabulary here. Anything looser matches the ordinary
 * noise of an install — audit warnings, deprecations, browserslist notices — and an alert that
 * cries wolf is worse than none.
 */

/**
 * What the dev server says when the project itself is broken, as opposed to merely noisy.
 *
 * Plain strings, not patterns: every one of these is a literal prefix Vite prints, and `lastIndexOf`
 * then gives the **most recent** occurrence for free. That matters more than it looks — the overlap
 * carried between chunks means an old error is still in the text being searched, and a search that
 * returns the first hit lets it mask every error that comes after it.
 */
const DEV_SERVER_ERRORS = [
  'Pre-transform error:',
  '[vite] Internal server error',
  'error during build:',
  'Failed to resolve import',
  'Failed to resolve entry for package',
  'Could not resolve entry module',
];

/**
 * How much of the previous chunk is carried forward.
 *
 * Output arrives split at arbitrary points, so a message can straddle two chunks. Enough overlap to
 * catch one that does, and bounded — this file exists partly because the last piece of code that
 * kept an unbounded tail of command output and re-scanned it per chunk cost 204 seconds of held
 * main thread in a single session.
 */
const OVERLAP_CHARS = 512;

/** A ceiling on one line, so a server that prints a whole trace on one cannot fill the alert. */
const MESSAGE_CHARS = 600;

const ANSI = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

export interface DevServerErrorWatcher {
  /** Returns the error this chunk revealed, or undefined. The same error is only reported once. */
  read(chunk: string): string | undefined;
}

export function watchDevServerErrors(): DevServerErrorWatcher {
  let overlap = '';
  let lastReported: string | undefined;

  return {
    read(chunk: string) {
      const text = `${overlap}${chunk}`;
      overlap = text.slice(-OVERLAP_CHARS);

      const clean = text.replace(ANSI, '');
      const start = Math.max(...DEV_SERVER_ERRORS.map((marker) => clean.lastIndexOf(marker)));

      if (start < 0) {
        return undefined;
      }

      const lineEnd = clean.indexOf('\n', start);

      /*
       * Only a finished line. Output arrives split wherever the pipe happened to break, so a marker
       * with nothing after it yet is half a sentence — reporting it would put a truncated message in
       * front of the user and then suppress the complete one as a duplicate of itself. The overlap
       * keeps it around, and the chunk that brings the newline reports it whole.
       */
      if (lineEnd === -1) {
        return undefined;
      }

      /*
       * The line the marker is on, and only that line. Vite puts the whole complaint on one — the
       * file, the position, what was wrong with it — so the line is both what the user needs and the
       * part that reads the same every time, which is what makes «report it once» work at all.
       */
      const message = clean.slice(start, lineEnd).trim().slice(0, MESSAGE_CHARS);

      if (!message || message === lastReported) {
        return undefined;
      }

      lastReported = message;

      return message;
    },
  };
}
