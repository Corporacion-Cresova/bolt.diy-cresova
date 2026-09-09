/**
 * Copies starter templates into public/templates so importing one costs zero GitHub API calls.
 *
 * GitHub's unauthenticated budget is 60 requests an hour and a template import used to spend a
 * large share of it, so imports failed for an hour at a time. A vendored template is just a
 * static asset served by the app itself.
 *
 * Uso:
 *   node scripts/vendor-templates.mjs              solo las plantillas locales de este repo
 *   node scripts/vendor-templates.mjs --upstream   además re-descarga las de GitHub
 *
 * Lo de GitHub está detrás de una bandera por una razón concreta: los JSON vendorizados de
 * terceros llevan parches nuestros. `vite-shadcn` no pasaba su propio typecheck —un `props` sin
 * usar y un import muerto, TS6133 y TS6192— y eso hacía fallar el build al publicar; se corrigió
 * a mano sobre el JSON, porque un archivo generado no tiene otro lugar donde guardar un parche.
 * Re-clonar sin querer los borra y el fallo vuelve sin que nadie lo relacione. Ya pasó una vez.
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

/**
 * Plantillas que viven en este repo, no en GitHub.
 *
 * `cresova-base` se vendorizaba a mano, y eso significa que el JSON que de verdad llega al modelo
 * y la carpeta que uno lee podían decir cosas distintas sin que nada lo notara. El código que se
 * lee tiene que ser el código que se envía.
 */
const LOCAL_TEMPLATES = [{ slug: 'cresova-base', dir: 'templates/cresova-base', repo: 'cresova/cresova-base' }];

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

/** Empaqueta un directorio de archivos de texto en el JSON que la app sirve. */
function vendor(slug, repo, dir) {
  const files = [];
  let skipped = 0;

  for (const path of walk(dir)) {
    const buffer = readFileSync(join(dir, path));

    if (isBinary(buffer)) {
      skipped++;
      continue;
    }

    files.push({ path, content: buffer.toString('utf8') });
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  writeFileSync(join(OUTPUT_DIR, `${slug}.json`), `${JSON.stringify({ repo, files })}\n`);
  console.log(`✔ ${slug}: ${files.length} files${skipped ? `, ${skipped} binary skipped` : ''}`);
}

for (const { slug, dir, repo } of LOCAL_TEMPLATES) {
  vendor(slug, repo, dir);
}

const refreshUpstream = process.argv.includes('--upstream');

if (!refreshUpstream) {
  console.log('Plantillas de GitHub sin tocar. Para re-descargarlas: --upstream (revisá el diff, lleva parches).');
}

for (const repo of refreshUpstream ? TEMPLATES : []) {
  const slug = repo.split('/').pop();
  const checkout = mkdtempSync(join(tmpdir(), 'cresova-template-'));

  try {
    execSync(`git clone --depth 1 -q https://github.com/${repo} ${checkout}`, { stdio: ['ignore', 'ignore', 'pipe'] });

    vendor(slug, repo, checkout);
  } catch (error) {
    console.error(`✘ ${slug}: ${error.message.split('\n')[0]}`);
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
}
