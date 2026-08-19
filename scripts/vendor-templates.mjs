/**
 * Copies starter templates into public/templates so importing one costs zero GitHub API calls.
 *
 * GitHub's unauthenticated budget is 60 requests an hour and a template import used to spend a
 * large share of it, so imports failed for an hour at a time. A vendored template is just a
 * static asset served by the app itself.
 *
 * Usage: node scripts/vendor-templates.mjs
 */
import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

const TEMPLATES = [
  'xKevIsDev/bolt-vite-react-ts-template',
  'xKevIsDev/vanilla-vite-template',
  'xKevIsDev/bolt-astro-basic-template',
  'xKevIsDev/vite-shadcn',
];

const OUTPUT_DIR = 'public/templates';
const SKIPPED_DIRS = new Set(['.git', 'node_modules']);

function walk(dir, root = dir) {
  return readdirSync(dir).flatMap((entry) => {
    if (SKIPPED_DIRS.has(entry)) {
      return [];
    }

    const full = join(dir, entry);

    return statSync(full).isDirectory() ? walk(full, root) : [relative(root, full)];
  });
}

function isBinary(buffer) {
  // a NUL byte in the first KB is the usual giveaway, and the pipeline only handles text anyway
  return buffer.subarray(0, 1024).includes(0);
}

mkdirSync(OUTPUT_DIR, { recursive: true });

for (const repo of TEMPLATES) {
  const slug = repo.split('/').pop();
  const checkout = mkdtempSync(join(tmpdir(), 'cresova-template-'));

  try {
    execSync(`git clone --depth 1 -q https://github.com/${repo} ${checkout}`, { stdio: ['ignore', 'ignore', 'pipe'] });

    const files = [];
    let skipped = 0;

    for (const path of walk(checkout)) {
      const buffer = readFileSync(join(checkout, path));

      if (isBinary(buffer)) {
        skipped++;
        continue;
      }

      files.push({ path, content: buffer.toString('utf8') });
    }

    files.sort((a, b) => a.path.localeCompare(b.path));
    writeFileSync(join(OUTPUT_DIR, `${slug}.json`), `${JSON.stringify({ repo, files })}\n`);
    console.log(`✔ ${slug}: ${files.length} files${skipped ? `, ${skipped} binary skipped` : ''}`);
  } catch (error) {
    console.error(`✘ ${slug}: ${error.message.split('\n')[0]}`);
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
}
