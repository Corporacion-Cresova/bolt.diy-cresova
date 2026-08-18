import { detectProjectCommands, type ProjectCommands } from '~/utils/projectCommands';
import type { FileMap } from '~/lib/stores/files';
import { webcontainer } from '~/lib/webcontainer';

/**
 * Commands that keep running once started (dev servers, static servers, watchers).
 *
 * These must never be executed as a blocking `shell` action: `BoltShell.executeCommand`
 * waits for the process to exit, which never happens for a server, and that stalls the
 * whole action queue. Bolt already has a non blocking action type for this (`start`),
 * so we only need to recognise the command reliably.
 */
const DEV_SERVER_PATTERNS: RegExp[] = [
  // npm/pnpm/yarn/bun scripts that serve the app
  /(?:^|&&|;|\|\|)\s*(?:[A-Z_]+=\S+\s+)*(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:dev|start|serve|preview|watch)\b/i,

  // direct binaries, optionally through npx
  /(?:^|&&|;|\|\|)\s*(?:npx\s+(?:--yes\s+)?)?vite(?!\s+build)\b/i,
  /(?:^|&&|;|\|\|)\s*(?:npx\s+(?:--yes\s+)?)?(?:next|nuxt|astro|remix|expo)\s+(?:dev|start)\b/i,
  /(?:^|&&|;|\|\|)\s*(?:npx\s+(?:--yes\s+)?)?ng\s+serve\b/i,
  /(?:^|&&|;|\|\|)\s*(?:npx\s+(?:--yes\s+)?)?(?:serve|http-server|live-server)\b/i,
];

export function isDevServerCommand(command: string): boolean {
  const normalized = command.trim();

  if (!normalized) {
    return false;
  }

  return DEV_SERVER_PATTERNS.some((pattern) => pattern.test(normalized));
}

function fileMapToFileContents(files: FileMap): { path: string; content: string }[] {
  return Object.entries(files).flatMap(([path, dirent]) =>
    dirent?.type === 'file' && !dirent.isBinary ? [{ path, content: dirent.content }] : [],
  );
}

/**
 * Resolves how the current workspace is supposed to be started, reusing the same detection
 * Bolt uses for template/folder/git imports instead of assuming `npm run dev`.
 */
export async function detectWorkspaceCommands(files: FileMap): Promise<ProjectCommands> {
  return detectProjectCommands(fileMapToFileContents(files));
}

export async function hasInstalledDependencies(): Promise<boolean> {
  try {
    const container = await webcontainer;
    const entries = await container.fs.readdir('node_modules');

    return entries.length > 0;
  } catch {
    return false;
  }
}
