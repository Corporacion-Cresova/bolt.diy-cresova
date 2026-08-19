/**
 * Writes app/version.json so the running app can show which build it is.
 *
 * It runs from the pre-commit hook rather than at build time because .dockerignore excludes
 * .git: inside the EasyPanel image there is no repository to ask, so the number has to be
 * committed with the code.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const git = (command, fallback) => {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return fallback;
  }
};

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

/*
 * The hook runs before the commit exists, so the commit being written is the next one.
 * The commit hash is deliberately not stored: at this point it has not been computed yet,
 * and a stale hash is worse than no hash.
 */
const build = Number(git('git rev-list --count HEAD', '0')) + 1;

const payload = {
  version,
  build,
  date: new Date().toISOString().slice(0, 10),
};

writeFileSync('app/version.json', `${JSON.stringify(payload, null, 2)}\n`);
console.log(`📦 Cresova Builder v${version} build ${build}`);
