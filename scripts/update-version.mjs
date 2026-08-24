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
const fromGit = Number(git('git rev-list --count HEAD', '0')) + 1;

/*
 * Never lower than what is already published.
 *
 * The count belongs to whoever is committing, and pull requests land here squashed: a branch can
 * easily hold more commits than the history they collapse into, so the number this produces on one
 * machine is not comparable with the number it produces on another. Taken literally it went
 * backwards — 197 in the file, 88 on `main` — and a build number that goes backwards is worse than
 * one that stands still, because the badge in the header is what tells someone whether the deploy
 * they just triggered is the one they are looking at.
 *
 * Reading the previous value keeps it moving in one direction whatever the count says, and covers
 * the case where there is no repository to ask at all.
 */
const previous = (() => {
  try {
    return Number(JSON.parse(readFileSync('app/version.json', 'utf8')).build) || 0;
  } catch {
    return 0;
  }
})();

const build = Math.max(fromGit, previous + 1);

const payload = {
  version,
  build,
  date: new Date().toISOString().slice(0, 10),
};

writeFileSync('app/version.json', `${JSON.stringify(payload, null, 2)}\n`);
console.log(`📦 Cresova Builder v${version} build ${build}`);
