import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import {
  findUnvalidatedRequestBody,
  findRequestBodyCasts,
} from '../../../../tooling/guards/source-guards.js';

// Guard test (no DB) — uses the portable scanners in /tooling/guards. Every mutating
// route must validate its body with Zod (`.parse`/`.safeParse`) instead of casting
// `request.body`. Locks in the S4 work: a new handler that reads the body without
// validation (and would 500 on malformed input instead of returning 400) fails here.
//
// This is the project's instance of a reusable check — see /tooling/README.md.

const routesDir = dirname(fileURLToPath(import.meta.url));

// Skip under Stryker: it copies sources into .stryker-tmp/sandbox-N and instruments
// them with mutation-switching code that contains raw `request.body` references —
// the guard would flag those as violations even though the real source is fine.
const inStrykerSandbox = process.cwd().includes('.stryker-tmp');

describe.skipIf(inStrykerSandbox)('body-validation guard', () => {
  it('no route reads request.body without a Zod .parse/.safeParse', () => {
    expect(findUnvalidatedRequestBody(routesDir)).toEqual([]);
  });

  it('no route casts request.body with `as`', () => {
    expect(findRequestBodyCasts(routesDir)).toEqual([]);
  });
});
