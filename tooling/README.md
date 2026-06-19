# tooling — portable production-readiness guards

Reusable checks distilled from the Ternity production-readiness work. They turn classes
of bug we found into **automated guards** so the same mistake can't silently come back.

Self-contained and dependency-free — designed to be **copied** into another project
(`netbulls.ternity.auth`, future services, …). Copy the `tooling/` folder, wire the two
hookup points below, done.

## What's inside

| File | What it is |
|---|---|
| `eslint/index.js` | ESLint flat-config preset — in-editor feedback. Uses only the built-in `no-restricted-syntax` rule (no custom plugin to install). |
| `guards/source-guards.js` | Source-scan functions you assert against in your own test runner. Plain ESM + a `.d.ts` for types. |

## What it catches (and what it can't)

Two kinds of bug:

- **Structural** — a recognisable bad *shape* in the source. These the guards catch:
  - casting `request.body` instead of validating it (→ malformed input 500s instead of 400) — ESLint rule **and** scan
  - `sql`… ANY(${jsArray}) …`` — Drizzle can't serialize a JS array, 500s at runtime (use `inArray`) — scan
  - a Fastify plugin that adds hooks but isn't `fp()`-wrapped (hooks silently don't apply) — scan
- **Logic** — correct-looking shape, wrong meaning (e.g. `< end` vs `<= end`, an escaping function that escapes *wrongly*). **No scanner can catch these** — they're the job of tests + mutation testing. Don't expect the guards to.

Stack assumptions: TypeScript + Fastify + Drizzle + Zod + fastify-plugin. Use only the
guards a given project needs.

## Adopt in a new project (option A — copy)

1. Copy this `tooling/` folder to the new repo's root.

2. **ESLint** — spread the preset into the flat config (`eslint.config.js`):

   ```js
   import ternityGuards from './tooling/eslint/index.js';
   export default tseslint.config(
     // …existing config…
     ...ternityGuards,
   );
   ```

   Requires the typescript-eslint parser to be active (so the TS AST the selectors target exists).

3. **Guard tests** — add a test file per relevant guard. Pass the directory; assert empty.
   Example (vitest), for an API with routes in `src/routes` and plugins in `src/plugins`:

   ```ts
   import { describe, expect, it } from 'vitest';
   import {
     findUnvalidatedRequestBody,
     findRequestBodyCasts,
     findAnyInSqlTemplates,
     findPluginsMissingFp,
     findPostCreateMissing201,
   } from '../tooling/guards/source-guards.js'; // adjust the relative path

   describe('production-readiness guards', () => {
     it('routes validate request.body', () => {
       expect(findUnvalidatedRequestBody('src/routes')).toEqual([]);
       expect(findRequestBodyCasts('src/routes')).toEqual([]);
     });
     it('no ANY(${…}) in sql templates', () => {
       expect(findAnyInSqlTemplates('src')).toEqual([]);
     });
     it('plugins adding hooks are fp()-wrapped', () => {
       expect(findPluginsMissingFp('src/plugins')).toEqual([]);
     });
     it('resource-creating POSTs return 201', () => {
       // Allowed opt-out for hybrid handlers: a `// @status-code 200 — <reason>` comment
       // anywhere inside the handler body.
       expect(findPostCreateMissing201('src/routes')).toEqual([]);
     });
   });
   ```

   Live example in this repo: `apps/api/src/routes/body-validation.guard.test.ts` and
   `apps/api/src/architecture.guard.test.ts`.

## Option A trade-off

Copy-paste means **no shared source of truth** — improvements made in one repo don't reach
the others automatically. When you change a guard, copy it to the other repos. If that
drift becomes painful, graduate to a git-referenced or published package.
