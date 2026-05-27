// Portable source-scan guards (no dependencies, plain ESM).
//
// These encode classes of bug found during the Ternity production-readiness work as
// checks that scan source files and return offenders. A project wraps each in its own
// test runner (vitest/jest) and asserts the result is empty — so a regression fails the
// build with a pointer to the offending file.
//
// They catch STRUCTURAL bugs (a recognisable bad shape in the source). They cannot catch
// LOGIC bugs (a correct-looking shape with wrong meaning, e.g. `< end` vs `<= end`) —
// those are the domain of tests + mutation testing, not a scanner.
//
// Stack assumptions: TypeScript + Fastify (request.body) + Drizzle (sql``) + Zod
// (.parse/.safeParse) + fastify-plugin (fp()). Use only the guards relevant to a project.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** List `.ts` source files under `dir` (skips `.test.ts` and `.d.ts`). */
function listSourceFiles(dir, { recursive = false } = {}) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (recursive) out.push(...listSourceFiles(full, { recursive }));
      continue;
    }
    if (entry.endsWith('.ts') && !entry.endsWith('.test.ts') && !entry.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** Validated reads look like `Schema.parse(request.body…)` / `.safeParse(request.body…)`. */
function stripValidatedBodyReads(src) {
  return src.replace(/\.(safeParse|parse)\(\s*request\.body/g, '.$1(__validated__');
}

/**
 * S4 — request bodies must be validated, not cast. Returns files (with count) that read
 * `request.body` without a Zod `.parse`/`.safeParse`. An unvalidated body means malformed
 * input 500s instead of returning 400.
 */
export function findUnvalidatedRequestBody(routesDir, opts) {
  const offenders = [];
  for (const file of listSourceFiles(routesDir, opts)) {
    const stripped = stripValidatedBodyReads(readFileSync(file, 'utf8'));
    const n = (stripped.match(/request\.body/g) ?? []).length;
    if (n > 0) offenders.push(`${file} (${n} unvalidated read(s))`);
  }
  return offenders;
}

/** S4 (sharper signal) — files that cast `request.body` with `as`. */
export function findRequestBodyCasts(routesDir, opts) {
  return listSourceFiles(routesDir, opts).filter((f) =>
    /request\.body\s+as\b/.test(readFileSync(f, 'utf8')),
  );
}

/**
 * Drizzle serialization trap — `sql`… ANY(${jsArray}) …`` cannot serialize a JS array and
 * 500s at runtime. Returns files using the `ANY(${…})` idiom; the fix is `inArray(col, arr)`.
 */
export function findAnyInSqlTemplates(srcDir, opts = { recursive: true }) {
  return listSourceFiles(srcDir, opts).filter((f) => /ANY\(\s*\$\{/.test(readFileSync(f, 'utf8')));
}

/**
 * Fastify encapsulation trap — a plugin that adds hooks but isn't `fp()`-wrapped runs in an
 * encapsulated child scope, so its hooks silently don't apply to sibling/parent routes.
 * Returns plugin files that call `addHook` without importing/using fastify-plugin.
 */
export function findPluginsMissingFp(pluginsDir, opts) {
  return listSourceFiles(pluginsDir, opts).filter((f) => {
    const src = readFileSync(f, 'utf8');
    return /\.addHook\(/.test(src) && !/fastify-plugin|fp\(/.test(src);
  });
}
