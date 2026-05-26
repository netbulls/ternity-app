import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Guard test (no DB): every mutating route must validate its body with Zod
// (`.parse` / `.safeParse`) instead of casting `request.body`. This locks in the S4
// work — a newly added POST/PATCH/PUT/DELETE handler that reads the body without
// validation (and would therefore 500 on malformed input instead of returning 400)
// fails here, pointing at the offending file.

const routesDir = dirname(fileURLToPath(import.meta.url));

function routeFiles(): { name: string; src: string }[] {
  return readdirSync(routesDir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => ({ name: f, src: readFileSync(join(routesDir, f), 'utf8') }));
}

/** Strip validated reads (`Schema.parse(request.body...)` / `.safeParse(request.body...)`)
 *  so only *unvalidated* `request.body` references remain. */
function unvalidatedBodyReads(src: string): number {
  const stripped = src.replace(/\.(safeParse|parse)\(\s*request\.body/g, '.$1(__validated__');
  return (stripped.match(/request\.body/g) ?? []).length;
}

describe('body-validation guard', () => {
  it('no route reads request.body without a Zod .parse/.safeParse', () => {
    const offenders = routeFiles()
      .filter((f) => unvalidatedBodyReads(f.src) > 0)
      .map((f) => `${f.name} (${unvalidatedBodyReads(f.src)} unvalidated read(s))`);
    expect(offenders).toEqual([]);
  });

  it('no route casts request.body with `as`', () => {
    const offenders = routeFiles()
      .filter((f) => /request\.body\s+as\b/.test(f.src))
      .map((f) => f.name);
    expect(offenders).toEqual([]);
  });

  it('actually scans a non-trivial number of route files (sanity)', () => {
    expect(routeFiles().length).toBeGreaterThan(10);
  });
});
