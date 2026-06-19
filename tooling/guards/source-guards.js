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

/**
 * Split a routes file into per-`fastify.<verb>(...)` handler segments so we can run
 * structural checks against individual handlers (and quote the offender's path).
 *
 * Naive but adequate for Fastify route files: take the substring from each
 * `fastify.<verb>(` opening up to (but not including) the next `fastify.<verb>(` or end
 * of file. False positives are possible if a handler contains code that *quotes*
 * `fastify.<verb>(` literally — none of the Ternity routes do, but be aware.
 */
function splitFastifyHandlers(src) {
  const re = /fastify\.(get|post|patch|delete|put|head|options)\(\s*['"`]([^'"`]+)['"`]/g;
  const matches = [...src.matchAll(re)];
  return matches.map((m, i) => {
    const start = m.index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? src.length) : src.length;
    return { verb: m[1], path: m[2], body: src.slice(start, end) };
  });
}

/**
 * Convention guard — every `fastify.post(...)` that creates a resource
 * (calls `.insert(...).returning(...)`) must explicitly `reply.code(201)`.
 *
 * Caught: drift across route files (some endpoints landed on the Fastify-default 200
 * while others used 201). Surfaced by an E2E spec; this scanner stops the regression at
 * its source — write a creator-POST that forgets `reply.code(201)` and the guard test
 * fails the build with a pointer.
 *
 * Exemptions, both intentional:
 *   • `.onConflictDoUpdate(...)` in the handler → upsert (idempotent "ensure exists"),
 *     not a created-resource POST. Returns 200 by convention.
 *   • A `// @status-code 200 — <reason>` comment anywhere in the handler body documents
 *     a deliberate 200 (e.g. start-or-resume hybrid that may create OR resume).
 *
 * Returns offenders as "<file> POST <route-path>".
 */
export function findPostCreateMissing201(routesDir, opts) {
  const offenders = [];
  for (const file of listSourceFiles(routesDir, opts)) {
    const src = readFileSync(file, 'utf8');
    for (const h of splitFastifyHandlers(src)) {
      if (h.verb !== 'post') continue;
      const insertsAndReturns = /\.insert\([^)]*\)[\s\S]{0,400}?\.returning\(/.test(h.body);
      if (!insertsAndReturns) continue;
      if (/\.onConflictDoUpdate\(/.test(h.body)) continue; // upsert opt-out
      if (/@status-code\s+200/.test(h.body)) continue; // explicit opt-out
      if (/reply\.code\(\s*201\s*\)/.test(h.body)) continue;
      offenders.push(`${file} POST ${h.path}`);
    }
  }
  return offenders;
}
