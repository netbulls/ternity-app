// Verifies: docs/prd/leave-management.md#phase-1-contractor-flow-no-approval
//
// Contractor Phase 1 flow end-to-end:
//   • POST a single-day leave request → 201, status=autoconfirmed
//   • the booking surfaces on /api/leave/wallchart for the contractor
//   • leave_allowances.usedDays incremented by daysCount (deducible type)
//   • DELETE (cancel) → status=cancelled and usedDays released back to 0

import { test, expect } from '../fixtures/test.js';

/** Next Monday after `from` (avoids weekend/holiday edge cases). */
function nextMonday(from = new Date()): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

test('contractor books a day off → autoconfirmed + wallchart + usedDays sync', async ({
  page,
  meta,
  actAs,
  apiAs,
}) => {
  await actAs(meta.seed.contractorUserId);

  // The /leave page renders for the contractor (cross-stack smoke).
  await page.goto('/leave');
  await expect(page).toHaveURL(/leave/);

  const api = await apiAs(meta.seed.contractorUserId);
  const day = nextMonday();

  // Initial usedDays should be 0 (seed sets totalDays=20, usedDays=0).
  const before = await api.get(`/api/leave/allowances?year=${meta.seed.allowanceYear}`);
  const beforeRow = (await before.json()).find(
    (r: { leaveTypeId: string }) => r.leaveTypeId === meta.seed.leaveTypeId,
  );
  expect(beforeRow.usedDays).toBe(0);

  // Book — Phase 1 contractor flow auto-assigns the contractor-default type
  // even if we send a different leaveTypeId.
  const create = await api.post('/api/leave/requests', {
    data: { startDate: day, endDate: day },
  });
  expect(create.status(), await create.text()).toBe(201);
  const booking = await create.json();
  expect(booking.status).toBe('autoconfirmed');
  expect(booking.leaveTypeId).toBe(meta.seed.leaveTypeId);
  expect(booking.daysCount).toBe(1);

  // Wallchart shows the contractor + the booking for the date range.
  const wallchart = await api.get(`/api/leave/wallchart?from=${day}&to=${day}`);
  const wc = await wallchart.json();
  const contractorRow = wc.users.find(
    (u: { id: string }) => u.id === meta.seed.contractorUserId,
  );
  expect(contractorRow, 'contractor should appear on wallchart').toBeTruthy();
  expect(contractorRow.bookings.some((b: { id: string }) => b.id === booking.id)).toBe(true);

  // usedDays += 1 (deducible type).
  const after = await api.get(`/api/leave/allowances?year=${meta.seed.allowanceYear}`);
  const afterRow = (await after.json()).find(
    (r: { leaveTypeId: string }) => r.leaveTypeId === meta.seed.leaveTypeId,
  );
  expect(afterRow.usedDays).toBe(1);

  // Cancel — usedDays back to 0 (round-trip nets to zero).
  const cancel = await api.delete(`/api/leave/requests/${booking.id}`);
  expect(cancel.status()).toBe(200);
  expect((await cancel.json()).status).toBe('cancelled');

  const final = await api.get(`/api/leave/allowances?year=${meta.seed.allowanceYear}`);
  const finalRow = (await final.json()).find(
    (r: { leaveTypeId: string }) => r.leaveTypeId === meta.seed.leaveTypeId,
  );
  expect(finalRow.usedDays).toBe(0);
});
