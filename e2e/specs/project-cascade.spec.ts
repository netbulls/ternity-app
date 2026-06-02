// Verifies: docs/prd/project-management.md#data-model
//
// `isActive` cascade rule from the PRD:
//   "A project is visible in pickers only when both the project and its
//    parent client are active. Historical data is never affected."
//
// Path: admin creates a client + a project under it → project shows up in
// the picker reference → admin deactivates the client → project disappears
// from the picker (cascade) without the project itself being deactivated.

import { test, expect } from '../fixtures/test.js';

test('admin deactivates a client → its projects vanish from pickers', async ({
  meta,
  actAs,
  apiAs,
  page,
}) => {
  await actAs(meta.seed.adminUserId);
  const api = await apiAs(meta.seed.adminUserId);

  // The admin Projects page renders (cross-stack smoke).
  await page.goto('/projects');
  await expect(page).toHaveURL(/projects/);

  // Create a fresh client + project for this run so we don't trip seed data.
  const tag = Date.now();
  const clientRes = await api.post('/api/admin/clients', {
    data: { name: `E2E Cascade Client ${tag}` },
  });
  expect(clientRes.status(), await clientRes.text()).toBe(201);
  const client = await clientRes.json();

  const projRes = await api.post('/api/admin/projects', {
    data: { name: `E2E Cascade Project ${tag}`, clientId: client.id },
  });
  expect(projRes.status(), await projRes.text()).toBe(201);
  const project = await projRes.json();

  // Project visible in /api/projects (the picker source) while both active.
  const pickerBefore = await (await api.get('/api/projects')).json();
  expect(
    pickerBefore.some((p: { id: string }) => p.id === project.id),
    'new project should show up in /api/projects when both client + project active',
  ).toBe(true);

  // Cascade: deactivate the client.
  const deact = await api.patch(`/api/admin/clients/${client.id}/deactivate`);
  expect(deact.status()).toBe(200);

  // Project gone from picker even though project.isActive is still true.
  const pickerAfter = await (await api.get('/api/projects')).json();
  expect(
    pickerAfter.some((p: { id: string }) => p.id === project.id),
    'project should be hidden from the picker once its client is inactive',
  ).toBe(false);

  // Admin /api/admin/projects still lists the project (historical / management view).
  const adminList = await (await api.get('/api/admin/projects')).json();
  const stillThere = adminList.find((p: { id: string }) => p.id === project.id);
  expect(stillThere, 'project must still exist for admin management').toBeTruthy();
  // The project itself was never touched — only the parent client.
  expect(stillThere.isActive).toBe(true);
});
