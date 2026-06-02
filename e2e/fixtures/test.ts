import { test as base, expect, type APIRequestContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Custom Playwright fixtures for Ternity E2E:
//   • `meta`       — the test-instance metadata (URLs + seeded IDs)
//   • `baseURL`    — overridden to point at the web server we spun up
//   • `actAs(id)`  — sets X-Dev-User-Id on the browser context so every
//                    request to /api/* runs as that user (stub auth mode)
//   • `apiAs(id)`  — APIRequestContext pre-set with X-Dev-User-Id, for
//                    direct API calls from specs (faster than driving UI)
//
// The seed (one admin, one contractor, one project, one leave type, one
// allowance row) is set up once by `scripts/test-instance.sh` and never
// mutated by fixtures — specs create their own per-test data via the API.

export interface TestInstanceMeta {
  webUrl: string;
  apiUrl: string;
  databaseUrl: string;
  dockerContainerId: string;
  seed: {
    adminUserId: string;
    contractorUserId: string;
    clientId: string;
    projectId: string;
    leaveTypeId: string;
    allowanceYear: number;
  };
}

function loadMeta(): TestInstanceMeta {
  const root = path.resolve(__dirname, '../..');
  const sidecar = path.join(root, 'e2e/.last-instance.json');
  const { metaPath } = JSON.parse(readFileSync(sidecar, 'utf8'));
  return JSON.parse(readFileSync(metaPath, 'utf8'));
}

type Fixtures = {
  meta: TestInstanceMeta;
  actAs: (userId: string) => Promise<void>;
  apiAs: (userId: string) => Promise<APIRequestContext>;
};

export const test = base.extend<Fixtures>({
  meta: async ({}, use) => {
    await use(loadMeta());
  },

  // Override Playwright's baseURL so `page.goto('/')` lands on the web server.
  baseURL: async ({}, use) => {
    await use(loadMeta().webUrl);
  },

  actAs: async ({ context }, use) => {
    await use(async (userId: string) => {
      await context.setExtraHTTPHeaders({ 'x-dev-user-id': userId });
    });
  },

  apiAs: async ({ playwright }, use) => {
    const meta = loadMeta();
    const ctxs: APIRequestContext[] = [];
    await use(async (userId: string) => {
      const ctx = await playwright.request.newContext({
        baseURL: meta.apiUrl,
        extraHTTPHeaders: { 'x-dev-user-id': userId },
      });
      ctxs.push(ctx);
      return ctx;
    });
    await Promise.all(ctxs.map((c) => c.dispose()));
  },
});

export { expect };
