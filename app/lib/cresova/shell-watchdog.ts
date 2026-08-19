/**
 * Guards against the failure that silently freezes a build: a shell command that never exits.
 *
 * `BoltShell.executeCommand` resolves only when the process prints its exit code, and the action
 * queue is serialized, so one command waiting on a keyboard answer stops every action after it.
 * Nothing recovers from that today except reloading the page.
 */

/** Commands that legitimately take minutes. */
const LONG_RUNNING_PATTERN = /\b(install|ci|add|update-browserslist-db|create-|build)\b/i;

export const DEFAULT_COMMAND_TIMEOUT_MS = 90_000;
export const LONG_COMMAND_TIMEOUT_MS = 300_000;

/** How many times we send Ctrl-C before giving up on a command that ignores it. */
export const MAX_COMMAND_INTERRUPTS = 3;

export function getCommandTimeout(command: string): number {
  return LONG_RUNNING_PATTERN.test(command) ? LONG_COMMAND_TIMEOUT_MS : DEFAULT_COMMAND_TIMEOUT_MS;
}

/**
 * Adds the flags that stop a command from asking the user anything. `npx create-*` and
 * `shadcn init` block on a confirmation prompt that nobody can answer inside WebContainer.
 */
export function ensureNonInteractiveFlags(command: string): string {
  return command
    .replace(/\bnpx\s+(?!--yes\b|-y\b)/g, 'npx --yes ')
    .replace(/\bnpm\s+init\s+(?!--yes\b|-y\b)/g, 'npm init --yes ')
    .replace(/\bnpm\s+create\s+(?!--yes\b|-y\b)/g, 'npm create --yes ');
}

/**
 * Same as above plus a non-interactive environment. Only for one-off commands: `CI=true` changes
 * how some dev servers and test runners behave, so start actions keep their plain environment.
 */
export function makeCommandNonInteractive(command: string): string {
  return `export CI=true FORCE_COLOR=0 && ${ensureNonInteractiveFlags(command)}`;
}
