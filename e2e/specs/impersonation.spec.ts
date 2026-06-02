// Verifies: docs/prd/impersonation.md#technical-approach
//
// X-Impersonate-User-Id header:
//   • when sent by an admin → backend resolves data against the impersonated
//     user (GET /api/me returns the impersonated user's profile)
//   • when sent by a non-admin → 403 (only admins may impersonate)
//
// We use direct API requests rather than UI clicking because the header
// behavior is what the PRD pins (UX/banner is separately exercised in unit
// tests). The cross-stack value here is: admin's JWT/role + header
// combination resolves to the right user end-to-end.

import { test, expect } from '../fixtures/test.js';

test('admin impersonation routes data through the target user', async ({
  meta,
  playwright,
}) => {
  // Admin baseline — /api/me returns the admin.
  const adminCtx = await playwright.request.newContext({
    baseURL: meta.apiUrl,
    extraHTTPHeaders: { 'x-dev-user-id': meta.seed.adminUserId },
  });
  const meAdmin = await (await adminCtx.get('/api/me')).json();
  expect(meAdmin.userId).toBe(meta.seed.adminUserId);
  expect(meAdmin.globalRole).toBe('admin');

  // With X-Impersonate-User-Id, the same admin sees the contractor's profile.
  const impCtx = await playwright.request.newContext({
    baseURL: meta.apiUrl,
    extraHTTPHeaders: {
      'x-dev-user-id': meta.seed.adminUserId,
      'x-impersonate-user-id': meta.seed.contractorUserId,
    },
  });
  const meImp = await (await impCtx.get('/api/me')).json();
  expect(meImp.userId).toBe(meta.seed.contractorUserId);
  expect(meImp.globalRole).toBe('user');

  // Non-admin attempting the same header is rejected (403).
  const userCtx = await playwright.request.newContext({
    baseURL: meta.apiUrl,
    extraHTTPHeaders: {
      'x-dev-user-id': meta.seed.contractorUserId,
      'x-impersonate-user-id': meta.seed.adminUserId,
    },
  });
  const rej = await userCtx.get('/api/me');
  expect(rej.status(), `body: ${await rej.text()}`).toBe(403);

  await Promise.all([adminCtx.dispose(), impCtx.dispose(), userCtx.dispose()]);
});
