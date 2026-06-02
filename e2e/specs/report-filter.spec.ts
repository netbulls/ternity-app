// Verifies: docs/prd/reports.md (filter + aggregation contract)
//
// Reports happy path:
//   • admin creates a manual entry on the seeded project, with a known duration
//   • GET /api/reports/data?dateFrom=…&dateTo=…&projectIds=<seed> returns
//     summary numbers that reflect that entry (totalSeconds, totalEntries,
//     projectCount = 1, userCount = 1)
//   • filtering by an unrelated projectId returns an empty summary — i.e. the
//     filter actually filters

import { test, expect } from '../fixtures/test.js';

test('report aggregates an entry on the seeded project and respects filters', async ({
  meta,
  apiAs,
}) => {
  const api = await apiAs(meta.seed.adminUserId);

  // Place the entry on a well-defined day in the current week. Using "today
  // minus 0" works for any test-instance clock — the report's date filter
  // is org-timezone-aware so we use a date string + explicit start/stop.
  const today = new Date().toISOString().slice(0, 10);
  const startedAt = `${today}T09:00:00.000Z`;
  const stoppedAt = `${today}T11:00:00.000Z`; // 2 hours = 7200s
  const expectedSeconds = 7200;

  const create = await api.post('/api/entries', {
    data: {
      description: `E2E report entry ${Date.now()}`,
      projectId: meta.seed.projectId,
      startedAt,
      stoppedAt,
      note: 'e2e',
    },
  });
  expect(create.status(), `body=${await create.text()}`).toBe(201);

  // Pull the report — only this admin's data is in the DB, so totals are deterministic.
  const r = await api.get(
    `/api/reports/data?dateFrom=${today}&dateTo=${today}&projectIds=${meta.seed.projectId}`,
  );
  expect(r.ok()).toBeTruthy();
  const report = await r.json();

  expect(report.summary.totalEntries, JSON.stringify(report.summary)).toBeGreaterThanOrEqual(1);
  expect(report.summary.totalSeconds).toBeGreaterThanOrEqual(expectedSeconds);
  expect(report.summary.projectCount).toBe(1);
  expect(report.summary.userCount).toBeGreaterThanOrEqual(1);
  // projectBreakdown carries the real project UUID (post-fix). Pre-fix this used
  // to be the project name — see reports.ts's projectSet keyed by projectId now.
  expect(
    report.projectBreakdown.some(
      (p: { projectId: string | null }) => p.projectId === meta.seed.projectId,
    ),
    `projectBreakdown=${JSON.stringify(report.projectBreakdown)} seed=${meta.seed.projectId}`,
  ).toBe(true);

  // Negative filter: a different (random) projectId returns nothing.
  const other = '00000000-0000-0000-0000-000000000001';
  const r2 = await api.get(
    `/api/reports/data?dateFrom=${today}&dateTo=${today}&projectIds=${other}`,
  );
  const empty = await r2.json();
  expect(empty.summary.totalEntries).toBe(0);
  expect(empty.summary.totalSeconds).toBe(0);
});
