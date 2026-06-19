import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, truncateAll } from '../../../test/db.js';
import { clients, leaveRequests, leaveTypes, projects, stgTtAbsences, users } from '../../db/schema.js';
import { findTargetId, upsertMapping } from './mappings.js';

// Characterization tests for the absences→leave_requests transform: user/leave-type
// resolution, the "Leave"/"Organization" + "Other" default rows, TT status mapping,
// date normalization and the daysCount rounding rule. Real Postgres via the harness.
//
// transform/absences.ts caches the leave-project and default-leave-type ids at module
// scope; re-import per test (vi.resetModules) so truncateAll can't strand the cache.

let transformAbsences: typeof import('./absences.js').transformAbsences;

beforeEach(async () => {
  await truncateAll();
  vi.resetModules();
  ({ transformAbsences } = await import('./absences.js'));
});

async function makeMappedUser(ttUserId: string) {
  const [u] = await db
    .insert(users)
    .values({ displayName: 'U', email: `${ttUserId}@netbulls.io` })
    .returning();
  await upsertMapping('timetastic', 'users', ttUserId, 'users', u!.id);
  return u!;
}

async function makeMappedLeaveType(ttLeaveTypeId: string, name = 'Holiday') {
  const [lt] = await db.insert(leaveTypes).values({ name, daysPerYear: 26 }).returning();
  await upsertMapping('timetastic', 'leave_types', ttLeaveTypeId, 'leave_types', lt!.id);
  return lt!;
}

const seedAbsence = (externalId: string, raw: Record<string, unknown>) =>
  db.insert(stgTtAbsences).values({ externalId, rawData: raw });

async function leaveReqByAbsence(externalId: string) {
  const id = await findTargetId('timetastic', 'absences', externalId);
  if (!id) return null;
  const [r] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
  return r ?? null;
}

const onlyLeaveReq = async () => {
  const [r] = await db.select().from(leaveRequests);
  return r!;
};

describe('transformAbsences — provisioning & skips', () => {
  it('provisions the "Leave" project and "Organization" client even with no rows', async () => {
    const counts = await transformAbsences();
    expect(counts).toEqual({ created: 0, updated: 0, skipped: 0 });
    expect(await db.select().from(projects).where(eq(projects.name, 'Leave'))).toHaveLength(1);
    expect(await db.select().from(clients).where(eq(clients.name, 'Organization'))).toHaveLength(1);
  });

  it('skips an absence with no user id', async () => {
    await seedAbsence('a1', { startDate: '2026-01-01', endDate: '2026-01-02' });
    expect(await transformAbsences()).toEqual({ created: 0, updated: 0, skipped: 1 });
  });

  it('skips an absence whose tt user has no mapping', async () => {
    await seedAbsence('a1', { userId: 'TT1', startDate: '2026-01-01', endDate: '2026-01-02' });
    expect(await transformAbsences()).toEqual({ created: 0, updated: 0, skipped: 1 });
  });

  it('skips an absence missing start or end date', async () => {
    await makeMappedUser('TT1');
    await seedAbsence('a1', { userId: 'TT1', startDate: '2026-01-01' }); // no endDate
    expect(await transformAbsences()).toEqual({ created: 0, updated: 0, skipped: 1 });
  });
});

describe('transformAbsences — create', () => {
  it('creates a leave request under the Leave project and records a mapping', async () => {
    const u = await makeMappedUser('TT1');
    const lt = await makeMappedLeaveType('LT1');
    await seedAbsence('a1', {
      userId: 'TT1',
      leaveTypeId: 'LT1',
      startDate: '2026-05-20',
      endDate: '2026-05-22',
      deductionDays: 3,
      status: 'Approved',
      reason: 'Vacation',
    });

    const counts = await transformAbsences();
    expect(counts).toEqual({ created: 1, updated: 0, skipped: 0 });

    const r = await onlyLeaveReq();
    expect(r.userId).toBe(u.id);
    expect(r.leaveTypeId).toBe(lt.id);
    expect(r.startDate).toBe('2026-05-20');
    expect(r.endDate).toBe('2026-05-22');
    expect(r.daysCount).toBe(3);
    expect(r.status).toBe('approved');
    expect(r.note).toBe('Vacation');

    const [leaveProject] = await db.select().from(projects).where(eq(projects.name, 'Leave'));
    expect(r.projectId).toBe(leaveProject!.id);
    expect(await findTargetId('timetastic', 'absences', 'a1')).toBe(r.id);
  });

  it('reads PascalCase TT field variants (UserId/LeaveTypeId/StartDate/EndDate/Status/Reason)', async () => {
    const u = await makeMappedUser('TT1');
    const lt = await makeMappedLeaveType('LT1');
    await seedAbsence('a1', {
      UserId: 'TT1',
      LeaveTypeId: 'LT1',
      StartDate: '2026-05-20',
      EndDate: '2026-05-20',
      DeductionDays: 1,
      Status: 'Declined',
      Reason: 'Sick',
    });

    await transformAbsences();
    const r = await onlyLeaveReq();
    expect(r.userId).toBe(u.id);
    expect(r.leaveTypeId).toBe(lt.id);
    expect(r.status).toBe('rejected');
    expect(r.note).toBe('Sick');
  });

  it('falls back to a default "Other" leave type when none is mapped', async () => {
    await makeMappedUser('TT1');
    await seedAbsence('a1', { userId: 'TT1', startDate: '2026-05-20', endDate: '2026-05-20' });

    await transformAbsences();

    const [other] = await db.select().from(leaveTypes).where(eq(leaveTypes.name, 'Other'));
    expect(other).toBeDefined();
    expect(other!.daysPerYear).toBe(0);
    expect(other!.deducted).toBe(false);
    expect((await onlyLeaveReq()).leaveTypeId).toBe(other!.id);
  });

  it('normalizes timestamps to YYYY-MM-DD dates', async () => {
    await makeMappedUser('TT1');
    await seedAbsence('a1', {
      userId: 'TT1',
      startDate: '2026-05-20T08:30:00.000Z',
      endDate: '2026-05-21T17:00:00.000Z',
    });

    await transformAbsences();
    const r = await onlyLeaveReq();
    expect(r.startDate).toBe('2026-05-20');
    expect(r.endDate).toBe('2026-05-21');
  });

  it('defaults note to null when no reason is given', async () => {
    await makeMappedUser('TT1');
    await seedAbsence('a1', { userId: 'TT1', startDate: '2026-05-20', endDate: '2026-05-20' });
    await transformAbsences();
    expect((await onlyLeaveReq()).note).toBeNull();
  });
});

describe('transformAbsences — daysCount rounding', () => {
  beforeEach(async () => {
    await makeMappedUser('TT1');
  });

  const cases: { label: string; raw: Record<string, unknown>; expected: number }[] = [
    { label: 'half day rounds up to 1', raw: { deductionDays: 0.5 }, expected: 1 },
    { label: '2.6 rounds to 3', raw: { deductionDays: 2.6 }, expected: 3 },
    { label: '0 floors to a minimum of 1', raw: { deductionDays: 0 }, expected: 1 },
    { label: 'missing defaults to 1', raw: {}, expected: 1 },
    { label: 'duration field is used as a fallback', raw: { duration: 2 }, expected: 2 },
  ];

  for (const { label, raw, expected } of cases) {
    it(label, async () => {
      await seedAbsence('a1', {
        userId: 'TT1',
        startDate: '2026-05-20',
        endDate: '2026-05-20',
        ...raw,
      });
      await transformAbsences();
      expect((await onlyLeaveReq()).daysCount).toBe(expected);
    });
  }
});

describe('transformAbsences — status mapping', () => {
  beforeEach(async () => {
    await makeMappedUser('TT1');
  });

  const cases: { input: Record<string, unknown>; expected: string }[] = [
    { input: { status: 'Approved' }, expected: 'approved' },
    { input: { status: 'Pending' }, expected: 'pending' },
    { input: { status: 'Declined' }, expected: 'rejected' },
    { input: { status: 'Cancelled' }, expected: 'cancelled' },
    { input: { status: 'approved' }, expected: 'approved' },
    { input: { status: 'declined' }, expected: 'rejected' },
    { input: { status: 'Whatever' }, expected: 'pending' }, // unknown → pending
    { input: {}, expected: 'pending' }, // absent → 'Pending' default → pending
  ];

  cases.forEach(({ input, expected }, i) => {
    it(`maps ${JSON.stringify(input.status ?? '(absent)')} → ${expected}`, async () => {
      await seedAbsence(`a${i}`, {
        userId: 'TT1',
        startDate: '2026-05-20',
        endDate: '2026-05-20',
        ...input,
      });
      await transformAbsences();
      const r = await leaveReqByAbsence(`a${i}`);
      expect(r!.status).toBe(expected);
    });
  });
});

describe('transformAbsences — update & idempotency', () => {
  it('is idempotent: a second run updates in place — one request, one mapping', async () => {
    await makeMappedUser('TT1');
    await seedAbsence('a1', { userId: 'TT1', startDate: '2026-05-20', endDate: '2026-05-20' });

    const first = await transformAbsences();
    const second = await transformAbsences();

    expect(first).toEqual({ created: 1, updated: 0, skipped: 0 });
    expect(second).toEqual({ created: 0, updated: 1, skipped: 0 });
    expect(await db.select().from(leaveRequests)).toHaveLength(1);
  });

  it('updates fields when the staging row changes', async () => {
    await makeMappedUser('TT1');
    await seedAbsence('a1', {
      userId: 'TT1',
      startDate: '2026-05-20',
      endDate: '2026-05-20',
      status: 'Pending',
    });
    await transformAbsences();
    const before = await onlyLeaveReq();

    await db
      .update(stgTtAbsences)
      .set({
        rawData: {
          userId: 'TT1',
          startDate: '2026-05-20',
          endDate: '2026-05-25',
          status: 'Approved',
          deductionDays: 6,
        },
      })
      .where(eq(stgTtAbsences.externalId, 'a1'));
    await transformAbsences();

    const after = await onlyLeaveReq();
    expect(after.id).toBe(before.id);
    expect(after.endDate).toBe('2026-05-25');
    expect(after.status).toBe('approved');
    expect(after.daysCount).toBe(6);
  });
});
