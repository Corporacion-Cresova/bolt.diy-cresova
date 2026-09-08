import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every variable the server reads off `serverEnv` has to be named in worker-configuration.d.ts.
 *
 * That file is not just types: bindings.sh scrapes the names out of it to build the `--binding`
 * flags wrangler is started with, so it is the actual list of what reaches
 * `context.cloudflare.env` in production. A variable missing from it is set in EasyPanel, arrives
 * in the container, and still never reaches the code — and the `process.env` fallback does not
 * rescue it, because workerd does not populate process.env from the host environment.
 *
 * That is exactly how image generation shipped switched off: CRESOVA_IMAGES_ENABLED and
 * OPENROUTER_IMAGES_KEY were declared in app/types/global.d.ts, which bindings.sh never reads, so
 * the feature was dead in production while looking configured. It failed silently, which is the
 * worst way for a gate to fail, so this test is the alarm.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);

    if (statSync(full).isDirectory()) {
      return sourceFiles(full);
    }

    return full.endsWith('.ts') && !full.endsWith('.spec.ts') ? [full] : [];
  });
}

describe('the environment variables the server reads', () => {
  it('are all names bindings.sh will hand to wrangler', () => {
    const declared = new Set(
      [...readFileSync('worker-configuration.d.ts', 'utf8').matchAll(/^\s*([A-Z][A-Z_0-9]*):/gm)].map((m) => m[1]),
    );

    const used = new Set<string>();

    for (const file of sourceFiles('app')) {
      for (const match of readFileSync(file, 'utf8').matchAll(/serverEnv\?\.([A-Z][A-Z_0-9]*)/g)) {
        used.add(match[1]);
      }
    }

    expect(used.size).toBeGreaterThan(0);

    const missing = [...used].filter((name) => !declared.has(name)).sort();

    expect(missing).toEqual([]);
  });
});
