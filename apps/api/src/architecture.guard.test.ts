import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  findAnyInSqlTemplates,
  findPluginsMissingFp,
} from '../../../tooling/guards/source-guards.js';

// Guard tests (no DB) for two bug classes found during the production-readiness work,
// using the portable scanners in /tooling/guards. Both catch a recognisable bad shape.

const srcDir = dirname(fileURLToPath(import.meta.url));
const pluginsDir = join(srcDir, 'plugins');

// Skip under Stryker — see comment in body-validation.guard.test.ts.
const inStrykerSandbox = process.cwd().includes('.stryker-tmp');

describe.skipIf(inStrykerSandbox)('architecture guards', () => {
  it('no `sql`… ANY(${…}) …`` — Drizzle cannot serialize a JS array (use inArray)', () => {
    // Caused admin-leave-types bulk PATCH to 500 before the fix.
    expect(findAnyInSqlTemplates(srcDir)).toEqual([]);
  });

  it('every plugin that adds hooks is fp()-wrapped (hooks must reach sibling routes)', () => {
    // An unwrapped plugin runs encapsulated → its onRequest hook silently no-ops, which
    // is exactly what hid the error-simulation bug.
    expect(findPluginsMissingFp(pluginsDir)).toEqual([]);
  });
});
