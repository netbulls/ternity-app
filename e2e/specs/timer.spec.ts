// Verifies: docs/prd/time-tracking.md#start-stop-timer
//
// Drives the start → stop → list happy path end-to-end:
//   web shell loads → admin starts a timer on the seeded project →
//   stops it after a beat → the entry shows up in the day-grouped
//   /api/entries response with the right project.

import { test, expect } from '../fixtures/test.js';

test('start → stop → entry appears in /api/entries with the chosen project', async ({
  page,
  meta,
  actAs,
  apiAs,
}) => {
  await actAs(meta.seed.adminUserId);

  // Cross-stack smoke: the web shell renders for an authenticated user.
  // If /api/me 401'd, the shell wouldn't render the app — it would bounce
  // through a login flow or show an error state.
  await page.goto('/');
  await expect(page).toHaveURL(/127\.0\.0\.1/);

  const api = await apiAs(meta.seed.adminUserId);
  const description = `E2E timer ${Date.now()}`;

  const start = await api.post('/api/timer/start', {
    data: { description, projectId: meta.seed.projectId },
  });
  expect(start.status(), `start body=${await start.text()}`).toBe(201);

  // Let a real second tick so the segment has a measurable duration.
  await page.waitForTimeout(1100);

  // /timer/stop is an action on an existing entry, not a create — stays 200.
  const stop = await api.post('/api/timer/stop', { data: {} });
  expect(stop.status(), `stop body=${await stop.text()}`).toBe(200);

  // /api/entries returns day groups: [{ date, totalSeconds, entries: [...] }].
  const today = new Date().toISOString().slice(0, 10);
  const res = await api.get(`/api/entries?from=${today}&to=${today}`);
  expect(res.ok()).toBeTruthy();
  const days = (await res.json()) as Array<{
    date: string;
    totalSeconds: number;
    entries: Array<{ description: string; projectId: string | null }>;
  }>;
  const allEntries = days.flatMap((d) => d.entries);
  const ours = allEntries.find((e) => e.description === description);
  expect(ours, 'created entry should be listed in /api/entries for today').toBeTruthy();
  expect(ours!.projectId).toBe(meta.seed.projectId);
});
