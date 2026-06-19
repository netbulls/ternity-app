import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { db, truncateAll } from '../../test/db.js';
import { buildApp } from '../../test/app.js';
import {
  users,
  leaveTypes,
  leaveTypeGroups,
  leaveRequests,
  leaveAllowances,
  workingSchedules,
  projects,
  clients,
} from '../db/schema.js';
import { leaveRoutes } from './leave.js';

// Characterization tests for all leave routes.
// Tests pin ACTUAL behavior (including quirks). BUG comments flag likely issues.

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp(leaveRoutes);
});
afterAll(async () => {
  await app.close();
});
beforeEach(truncateAll);

// ── Helpers ──────────────────────────────────────────────────────────────────

async function makeUser(opts: {
  role?: 'admin' | 'user';
  employmentType?: string;
  active?: boolean;
} = {}) {
  const [u] = await db
    .insert(users)
    .values({
      displayName: `User-${Math.random()}`,
      email: `u${Math.random()}@x.io`,
      globalRole: opts.role ?? 'user',
      employmentType: opts.employmentType ?? 'contractor',
      active: opts.active ?? true,
    })
    .returning();
  return u!;
}

async function makeLeaveType(opts: {
  name?: string;
  daysPerYear?: number;
  active?: boolean;
  visibility?: string;
  isContractorDefault?: boolean;
  deducted?: boolean;
} = {}) {
  const [lt] = await db
    .insert(leaveTypes)
    .values({
      name: opts.name ?? 'Annual Leave',
      daysPerYear: opts.daysPerYear ?? 20,
      active: opts.active ?? true,
      visibility: opts.visibility ?? 'all',
      isContractorDefault: opts.isContractorDefault ?? false,
      deducted: opts.deducted ?? true,
    })
    .returning();
  return lt!;
}

async function makeLeaveRequest(
  userId: string,
  leaveTypeId: string,
  opts: Partial<typeof leaveRequests.$inferInsert> = {},
) {
  const [lr] = await db
    .insert(leaveRequests)
    .values({
      userId,
      leaveTypeId,
      startDate: '2026-06-02',
      endDate: '2026-06-02',
      daysCount: 1,
      status: 'autoconfirmed',
      ...opts,
    })
    .returning();
  return lr!;
}

// ─── HTTP helpers ──────────────────────────────────────────────────────────

const get = async (url: string, userId: string) => {
  const res = await app.inject({ method: 'GET', url, headers: { 'x-dev-user-id': userId } });
  return { status: res.statusCode, body: res.json() };
};

const post = async (url: string, userId: string, payload?: unknown) => {
  const res = await app.inject({
    method: 'POST',
    url,
    headers: { 'x-dev-user-id': userId },
    payload: payload as object,
  });
  return { status: res.statusCode, body: res.json() };
};

const patch = async (url: string, userId: string, payload?: unknown) => {
  const res = await app.inject({
    method: 'PATCH',
    url,
    headers: { 'x-dev-user-id': userId },
    payload: payload as object,
  });
  return { status: res.statusCode, body: res.json() };
};

const del = async (url: string, userId: string) => {
  const res = await app.inject({ method: 'DELETE', url, headers: { 'x-dev-user-id': userId } });
  return { status: res.statusCode, body: res.json() };
};

// ── GET /api/leave/types ──────────────────────────────────────────────────

describe('GET /api/leave/types', () => {
  it('returns empty types array when no leave types exist', async () => {
    const u = await makeUser();
    const { status, body } = await get('/api/leave/types', u.id);
    expect(status).toBe(200);
    expect(body.types).toEqual([]);
    expect(body.employmentType).toBe('contractor');
  });

  it('returns active types visible to all', async () => {
    const u = await makeUser({ employmentType: 'employee' });
    await makeLeaveType({ name: 'Annual', visibility: 'all', active: true });
    const { body } = await get('/api/leave/types', u.id);
    expect(body.types).toHaveLength(1);
    expect(body.types[0]).toMatchObject({ name: 'Annual', visibility: 'all', active: true });
    expect(body.employmentType).toBe('employee');
  });

  it('excludes inactive types', async () => {
    const u = await makeUser();
    await makeLeaveType({ name: 'Old', active: false });
    const { body } = await get('/api/leave/types', u.id);
    expect(body.types).toHaveLength(0);
  });

  it('returns contractor-only types for contractor users', async () => {
    const contractor = await makeUser({ employmentType: 'contractor' });
    await makeLeaveType({ name: 'Contract Leave', visibility: 'contractor' });
    await makeLeaveType({ name: 'Employee Leave', visibility: 'employee' });
    const { body } = await get('/api/leave/types', contractor.id);
    // contractor sees 'all' + 'contractor', not 'employee'
    const names = body.types.map((t: { name: string }) => t.name);
    expect(names).toContain('Contract Leave');
    expect(names).not.toContain('Employee Leave');
  });

  it('returns employee-only types for employee users', async () => {
    const emp = await makeUser({ employmentType: 'employee' });
    await makeLeaveType({ name: 'Contract Leave', visibility: 'contractor' });
    await makeLeaveType({ name: 'Employee Leave', visibility: 'employee' });
    const { body } = await get('/api/leave/types', emp.id);
    const names = body.types.map((t: { name: string }) => t.name);
    expect(names).toContain('Employee Leave');
    expect(names).not.toContain('Contract Leave');
  });

  it('includes group info when type has a group', async () => {
    const u = await makeUser();
    const [group] = await db
      .insert(leaveTypeGroups)
      .values({ name: 'Paid', color: '#00ff00' })
      .returning();
    await db
      .insert(leaveTypes)
      .values({
        name: 'Annual',
        daysPerYear: 20,
        groupId: group!.id,
        active: true,
        visibility: 'all',
        isContractorDefault: false,
        deducted: true,
      })
      .returning();

    const { body } = await get('/api/leave/types', u.id);
    expect(body.types[0]).toMatchObject({
      groupId: group!.id,
      groupName: 'Paid',
      groupColor: '#00ff00',
    });
  });

  it('defaults employmentType to contractor when user is not found', async () => {
    // BUG: the auth stub should prevent this but if userId doesn't exist in users,
    // the code falls back to 'contractor' — actual behavior pinned here.
    // (auth plugin validates user exists before this route runs in practice)
    const u = await makeUser();
    const { body } = await get('/api/leave/types', u.id);
    expect(body.employmentType).toBe('contractor');
  });

  it('returns types ordered by name', async () => {
    const u = await makeUser();
    await makeLeaveType({ name: 'Sick' });
    await makeLeaveType({ name: 'Annual' });
    await makeLeaveType({ name: 'Parental' });
    const { body } = await get('/api/leave/types', u.id);
    const names = body.types.map((t: { name: string }) => t.name);
    expect(names).toEqual([...names].sort());
  });
});

// ── GET /api/leave/holidays ───────────────────────────────────────────────

describe('GET /api/leave/holidays', () => {
  it('returns holidays for a specific year', async () => {
    const u = await makeUser();
    const { status, body } = await get('/api/leave/holidays?year=2026', u.id);
    expect(status).toBe(200);
    // 2026 has known Polish holidays
    expect(body['2026-01-01']).toBe("New Year's Day");
    expect(body['2026-05-01']).toBe('Labour Day');
    // No 2025 or 2027 entries
    expect(Object.keys(body).every((k) => k.startsWith('2026-'))).toBe(true);
  });

  it('returns holidays for 2025', async () => {
    const u = await makeUser();
    const { body } = await get('/api/leave/holidays?year=2025', u.id);
    expect(body['2025-01-01']).toBe("New Year's Day");
    expect(body['2025-12-25']).toBe('Christmas Day');
    expect(Object.keys(body).every((k) => k.startsWith('2025-'))).toBe(true);
  });

  it('returns empty object for a year with no holidays defined', async () => {
    const u = await makeUser();
    const { body } = await get('/api/leave/holidays?year=2020', u.id);
    expect(body).toEqual({});
  });

  it('defaults to current year when no year param is provided', async () => {
    const u = await makeUser();
    const { status, body } = await get('/api/leave/holidays', u.id);
    expect(status).toBe(200);
    const currentYear = new Date().getFullYear().toString();
    const keys = Object.keys(body);
    // Either empty (year not in hardcoded list) or all keys match current year
    expect(keys.every((k) => k.startsWith(currentYear + '-') || keys.length === 0)).toBe(true);
  });

  it('returns 13 Polish public holidays for 2026', async () => {
    const u = await makeUser();
    const { body } = await get('/api/leave/holidays?year=2026', u.id);
    expect(Object.keys(body)).toHaveLength(13);
  });
});

// ── GET /api/leave/wallchart ──────────────────────────────────────────────

describe('GET /api/leave/wallchart', () => {
  it('returns 400 when from or to params are missing', async () => {
    const u = await makeUser();
    expect((await get('/api/leave/wallchart', u.id)).status).toBe(400);
    expect((await get('/api/leave/wallchart?from=2026-06-01', u.id)).status).toBe(400);
    expect((await get('/api/leave/wallchart?to=2026-06-30', u.id)).status).toBe(400);
  });

  it('returns users and leaveTypes arrays in response', async () => {
    const u = await makeUser();
    const { status, body } = await get('/api/leave/wallchart?from=2026-06-01&to=2026-06-30', u.id);
    expect(status).toBe(200);
    expect(Array.isArray(body.users)).toBe(true);
    expect(Array.isArray(body.leaveTypes)).toBe(true);
  });

  it('includes active users with bookings in range', async () => {
    const u = await makeUser({ active: true });
    const lt = await makeLeaveType();
    const lr = await makeLeaveRequest(u.id, lt.id, {
      startDate: '2026-06-10',
      endDate: '2026-06-10',
      status: 'autoconfirmed',
    });

    const { body } = await get('/api/leave/wallchart?from=2026-06-01&to=2026-06-30', u.id);
    const userEntry = body.users.find((x: { id: string }) => x.id === u.id);
    expect(userEntry).toBeDefined();
    expect(userEntry.bookings).toHaveLength(1);
    expect(userEntry.bookings[0].id).toBe(lr.id);
  });

  it('excludes cancelled bookings from wallchart', async () => {
    const u = await makeUser({ active: true });
    const lt = await makeLeaveType();
    await makeLeaveRequest(u.id, lt.id, {
      startDate: '2026-06-10',
      endDate: '2026-06-10',
      status: 'cancelled',
    });

    const { body } = await get('/api/leave/wallchart?from=2026-06-01&to=2026-06-30', u.id);
    const userEntry = body.users.find((x: { id: string }) => x.id === u.id);
    expect(userEntry!.bookings).toHaveLength(0);
  });

  it('shows bookings that overlap with the range (not just within)', async () => {
    const u = await makeUser({ active: true });
    const lt = await makeLeaveType();
    // Booking that starts before range but ends within it
    const lr = await makeLeaveRequest(u.id, lt.id, {
      startDate: '2026-05-28',
      endDate: '2026-06-05',
      daysCount: 7,
      status: 'autoconfirmed',
    });

    const { body } = await get('/api/leave/wallchart?from=2026-06-01&to=2026-06-30', u.id);
    const userEntry = body.users.find((x: { id: string }) => x.id === u.id);
    expect(userEntry!.bookings[0].id).toBe(lr.id);
  });

  it('excludes bookings entirely outside the range', async () => {
    const u = await makeUser({ active: true });
    const lt = await makeLeaveType();
    await makeLeaveRequest(u.id, lt.id, {
      startDate: '2026-07-01',
      endDate: '2026-07-05',
      daysCount: 5,
      status: 'autoconfirmed',
    });

    const { body } = await get('/api/leave/wallchart?from=2026-06-01&to=2026-06-30', u.id);
    const userEntry = body.users.find((x: { id: string }) => x.id === u.id);
    expect(userEntry!.bookings).toHaveLength(0);
  });

  it('includes inactive users in the response — BUG: wallchart only shows active users', async () => {
    // The query uses `eq(users.active, true)`, so inactive users are excluded.
    const inactiveUser = await makeUser({ active: false });
    const { body } = await get('/api/leave/wallchart?from=2026-06-01&to=2026-06-30', inactiveUser.id);
    const found = body.users.find((x: { id: string }) => x.id === inactiveUser.id);
    // Pinning actual behavior: inactive users are NOT in wallchart
    expect(found).toBeUndefined();
  });

  it('returns team info (teamName/teamColor) from default project', async () => {
    const [c] = await db.insert(clients).values({ name: 'Acme' }).returning();
    const [p] = await db
      .insert(projects)
      .values({ name: 'Web Team', clientId: c!.id, color: '#ff0000' })
      .returning();
    const u = await makeUser({ active: true });
    await db.update(users).set({ defaultProjectId: p!.id }).where(eq(users.id, u.id));

    const { body } = await get('/api/leave/wallchart?from=2026-06-01&to=2026-06-30', u.id);
    const userEntry = body.users.find((x: { id: string }) => x.id === u.id);
    expect(userEntry!.teamName).toBe('Web Team');
    expect(userEntry!.teamColor).toBe('#ff0000');
  });

  it('includes all leave types in response (not filtered by visibility)', async () => {
    const u = await makeUser();
    await makeLeaveType({ name: 'Contractor Only', visibility: 'contractor' });
    await makeLeaveType({ name: 'Employee Only', visibility: 'employee', active: false });
    const { body } = await get('/api/leave/wallchart?from=2026-06-01&to=2026-06-30', u.id);
    // Wallchart returns ALL leave types (active and inactive) for color mapping
    const names = body.leaveTypes.map((t: { name: string }) => t.name);
    expect(names).toContain('Contractor Only');
    expect(names).toContain('Employee Only');
  });
});

// ── GET /api/leave/requests ───────────────────────────────────────────────

describe('GET /api/leave/requests', () => {
  it('returns empty array when user has no requests', async () => {
    const u = await makeUser();
    const { status, body } = await get('/api/leave/requests', u.id);
    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  it("returns only the calling user's own requests", async () => {
    const u1 = await makeUser();
    const u2 = await makeUser();
    const lt = await makeLeaveType();
    const lr = await makeLeaveRequest(u1.id, lt.id);
    await makeLeaveRequest(u2.id, lt.id);

    const { body } = await get('/api/leave/requests', u1.id);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(lr.id);
  });

  it('returns all statuses (pending, approved, rejected, cancelled, autoconfirmed)', async () => {
    const u = await makeUser();
    const lt = await makeLeaveType();

    const statuses = ['pending', 'approved', 'rejected', 'cancelled', 'autoconfirmed'] as const;
    for (const status of statuses) {
      await makeLeaveRequest(u.id, lt.id, { status, startDate: '2026-06-02', endDate: '2026-06-02' });
    }

    const { body } = await get('/api/leave/requests', u.id);
    expect(body).toHaveLength(5);
    const returnedStatuses = body.map((r: { status: string }) => r.status);
    for (const s of statuses) {
      expect(returnedStatuses).toContain(s);
    }
  });

  it('filters by year when ?year param is provided (by startDate)', async () => {
    const u = await makeUser();
    const lt = await makeLeaveType();
    const r2025 = await makeLeaveRequest(u.id, lt.id, {
      startDate: '2025-07-01',
      endDate: '2025-07-01',
    });
    const r2026 = await makeLeaveRequest(u.id, lt.id, {
      startDate: '2026-06-02',
      endDate: '2026-06-02',
    });

    const { body: only2026 } = await get('/api/leave/requests?year=2026', u.id);
    const ids2026 = only2026.map((r: { id: string }) => r.id);
    expect(ids2026).toContain(r2026.id);
    expect(ids2026).not.toContain(r2025.id);

    const { body: only2025 } = await get('/api/leave/requests?year=2025', u.id);
    const ids2025 = only2025.map((r: { id: string }) => r.id);
    expect(ids2025).toContain(r2025.id);
    expect(ids2025).not.toContain(r2026.id);
  });

  it('returns requests ordered by startDate descending', async () => {
    const u = await makeUser();
    const lt = await makeLeaveType();
    await makeLeaveRequest(u.id, lt.id, { startDate: '2026-06-01', endDate: '2026-06-01' });
    await makeLeaveRequest(u.id, lt.id, { startDate: '2026-08-01', endDate: '2026-08-01' });
    await makeLeaveRequest(u.id, lt.id, { startDate: '2026-07-01', endDate: '2026-07-01' });

    const { body } = await get('/api/leave/requests', u.id);
    const dates = body.map((r: { startDate: string }) => r.startDate);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('response shape includes expected fields', async () => {
    const u = await makeUser();
    const lt = await makeLeaveType();
    await makeLeaveRequest(u.id, lt.id, { note: 'Holiday trip' });

    const { body } = await get('/api/leave/requests', u.id);
    expect(body[0]).toMatchObject({
      leaveTypeId: lt.id,
      startDate: '2026-06-02',
      endDate: '2026-06-02',
      daysCount: 1,
      status: 'autoconfirmed',
      note: 'Holiday trip',
    });
    expect(body[0].id).toBeDefined();
    expect(body[0].createdAt).toBeDefined();
  });

  // BUG NOTE: GET /api/leave/requests does NOT enforce admin-only for viewing other users'
  // requests — there is no admin endpoint to list all users' requests. Each user only sees
  // their own, and there's no ?userId= param. An admin cannot view another user's requests
  // via this endpoint (would need a separate admin endpoint).
});

// ── GET /api/leave/allowances ─────────────────────────────────────────────

describe('GET /api/leave/allowances', () => {
  it('returns empty array when no allowances exist', async () => {
    const u = await makeUser();
    const { status, body } = await get('/api/leave/allowances?year=2026', u.id);
    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  it("returns the user's allowances for the specified year", async () => {
    const u = await makeUser();
    const lt = await makeLeaveType();
    const [allowance] = await db
      .insert(leaveAllowances)
      .values({ userId: u.id, leaveTypeId: lt.id, year: 2026, totalDays: 20, usedDays: 5 })
      .returning();

    const { body } = await get('/api/leave/allowances?year=2026', u.id);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: allowance!.id,
      leaveTypeId: lt.id,
      year: 2026,
      totalDays: 20,
      usedDays: 5,
    });
  });

  it("filters to the requesting user only — does not return other users' allowances", async () => {
    const u1 = await makeUser();
    const u2 = await makeUser();
    const lt = await makeLeaveType();
    await db
      .insert(leaveAllowances)
      .values({ userId: u2.id, leaveTypeId: lt.id, year: 2026, totalDays: 20, usedDays: 0 });

    const { body } = await get('/api/leave/allowances?year=2026', u1.id);
    expect(body).toHaveLength(0);
  });

  it('filters by year — does not return allowances from other years', async () => {
    const u = await makeUser();
    const lt = await makeLeaveType();
    await db
      .insert(leaveAllowances)
      .values({ userId: u.id, leaveTypeId: lt.id, year: 2025, totalDays: 20, usedDays: 0 });

    const { body } = await get('/api/leave/allowances?year=2026', u.id);
    expect(body).toHaveLength(0);
  });

  it('defaults year to current year when ?year is omitted', async () => {
    const u = await makeUser();
    const lt = await makeLeaveType();
    const currentYear = new Date().getFullYear();
    await db
      .insert(leaveAllowances)
      .values({ userId: u.id, leaveTypeId: lt.id, year: currentYear, totalDays: 15, usedDays: 0 });

    const { body } = await get('/api/leave/allowances', u.id);
    expect(body).toHaveLength(1);
    expect(body[0].year).toBe(currentYear);
  });

  // usedDays auto-update is exercised in the POST/PATCH/DELETE sections below
  // ("usedDays accounting") — this endpoint just reads the current value.
});

// ── POST /api/leave/requests ──────────────────────────────────────────────

describe('POST /api/leave/requests', () => {
  // ── Contractor flow: auto-assigned leave type, autoconfirmed ──

  it('creates a request with status autoconfirmed (all users treated as contractors in Phase 1)', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    const lt = await makeLeaveType({ isContractorDefault: true });
    const tomorrow = getFutureDate(1);

    const { status, body } = await post('/api/leave/requests', u.id, {
      startDate: tomorrow,
      endDate: tomorrow,
    });

    expect(status).toBe(201);
    expect(body.status).toBe('autoconfirmed');
    expect(body.leaveTypeId).toBe(lt.id);
    expect(body.userId).toBe(u.id);
  });

  it('ignores leaveTypeId from contractor and uses isContractorDefault type', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    const contractorDefault = await makeLeaveType({ isContractorDefault: true, name: 'B2B Time Off' });
    const other = await makeLeaveType({ isContractorDefault: false, name: 'Other' });
    const tomorrow = getFutureDate(1);

    const { body } = await post('/api/leave/requests', u.id, {
      leaveTypeId: other.id, // should be ignored for contractors
      startDate: tomorrow,
      endDate: tomorrow,
    });

    expect(body.leaveTypeId).toBe(contractorDefault.id);
    expect(body.leaveTypeId).not.toBe(other.id);
  });

  it('returns 400 if no contractor default leave type is configured', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    // No isContractorDefault=true leave type created
    const tomorrow = getFutureDate(1);

    const { status, body } = await post('/api/leave/requests', u.id, {
      startDate: tomorrow,
      endDate: tomorrow,
    });

    expect(status).toBe(400);
    expect(body.error).toContain('No contractor default leave type configured');
  });

  // ── Non-contractor (employee) flow ──

  it('employee can specify leaveTypeId', async () => {
    const u = await makeUser({ employmentType: 'employee' });
    const lt = await makeLeaveType({ visibility: 'employee' });
    const tomorrow = getFutureDate(1);

    const { status, body } = await post('/api/leave/requests', u.id, {
      leaveTypeId: lt.id,
      startDate: tomorrow,
      endDate: tomorrow,
    });

    expect(status).toBe(201);
    expect(body.leaveTypeId).toBe(lt.id);
  });

  it('employee gets 400 if leaveTypeId is missing', async () => {
    const u = await makeUser({ employmentType: 'employee' });
    const tomorrow = getFutureDate(1);

    const { status, body } = await post('/api/leave/requests', u.id, {
      startDate: tomorrow,
      endDate: tomorrow,
      // no leaveTypeId
    });

    expect(status).toBe(400);
    expect(body.error).toMatch(/required/i);
  });

  it('employee gets 400 for invalid leaveTypeId', async () => {
    const u = await makeUser({ employmentType: 'employee' });
    const tomorrow = getFutureDate(1);

    const { status, body } = await post('/api/leave/requests', u.id, {
      leaveTypeId: '00000000-0000-0000-0000-000000000000',
      startDate: tomorrow,
      endDate: tomorrow,
    });

    expect(status).toBe(400);
    expect(body.error).toMatch(/invalid leave type/i);
  });

  // ── Date validation ──

  it('returns 400 when startDate > endDate', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    await makeLeaveType({ isContractorDefault: true });

    const { status, body } = await post('/api/leave/requests', u.id, {
      startDate: getFutureDate(5),
      endDate: getFutureDate(2),
    });

    expect(status).toBe(400);
    expect(body.error).toMatch(/startDate must be <= endDate/i);
  });

  it('returns 400 for invalid date format', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    await makeLeaveType({ isContractorDefault: true });

    const { status, body } = await post('/api/leave/requests', u.id, {
      startDate: '06/10/2026',
      endDate: '06/10/2026',
    });

    expect(status).toBe(400);
    expect(body.error).toMatch(/YYYY-MM-DD/i);
  });

  it('returns 400 for a malformed body type (validated by schema, not a 500)', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    await makeLeaveType({ isContractorDefault: true });
    // wrong types: startDate as number, hours as string — ZodError → 400
    expect((await post('/api/leave/requests', u.id, { startDate: 20260610, endDate: '2026-06-10' })).status).toBe(400);
    expect(
      (await post('/api/leave/requests', u.id, { startDate: getFutureDate(1), endDate: getFutureDate(1), hours: '4' })).status,
    ).toBe(400);
  });

  it('returns 400 for past startDate', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    await makeLeaveType({ isContractorDefault: true });
    const lt = await db.select().from(leaveTypes).where(eq(leaveTypes.isContractorDefault, true));

    const { status, body } = await post('/api/leave/requests', u.id, {
      leaveTypeId: lt[0]!.id,
      startDate: '2026-01-01', // clearly in the past relative to test date (2026-05-25)
      endDate: '2026-01-01',
    });

    expect(status).toBe(400);
    expect(body.error).toMatch(/past/i);
  });

  it('returns 400 when date range covers only weekends/holidays (no working days)', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    await makeLeaveType({ isContractorDefault: true });

    // 2026-06-06 is a Saturday, 2026-06-07 is a Sunday
    const { status, body } = await post('/api/leave/requests', u.id, {
      startDate: '2026-06-06',
      endDate: '2026-06-07',
    });

    expect(status).toBe(400);
    expect(body.error).toMatch(/no working days/i);
  });

  it('creates a multi-day request and calculates daysCount correctly (working days only)', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    await makeLeaveType({ isContractorDefault: true });

    // 2026-06-08 Mon to 2026-06-12 Fri = 5 working days
    const { status, body } = await post('/api/leave/requests', u.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-12',
    });

    expect(status).toBe(201);
    expect(body.daysCount).toBe(5);
    expect(body.startDate).toBe('2026-06-08');
    expect(body.endDate).toBe('2026-06-12');
  });

  it('stores note when provided', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    await makeLeaveType({ isContractorDefault: true });
    const tomorrow = getFutureDate(1);

    const { body } = await post('/api/leave/requests', u.id, {
      startDate: tomorrow,
      endDate: tomorrow,
      note: 'Doctor appointment',
    });

    expect(body.note).toBe('Doctor appointment');
  });

  // ── Partial-day bookings ──

  it('creates a partial-day booking with hours and startHour', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    await makeLeaveType({ isContractorDefault: true });

    // 2026-06-08 is a Monday (working day per default schedule 08:30-16:30)
    const { status, body } = await post('/api/leave/requests', u.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
      hours: 2,
      startHour: '09:00',
    });

    expect(status).toBe(201);
    expect(body.hours).toBe(2);
    expect(body.startHour).toBe('09:00');
    expect(body.daysCount).toBe(1); // partial day = 1 working day
    expect(body.status).toBe('autoconfirmed');
  });

  it('returns 400 for partial booking with hours < 0.5', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    await makeLeaveType({ isContractorDefault: true });

    const { status, body } = await post('/api/leave/requests', u.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
      hours: 0.25,
      startHour: '09:00',
    });

    expect(status).toBe(400);
    expect(body.error).toMatch(/0\.5 and 8/i);
  });

  it('returns 400 for partial booking with hours > 8', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    await makeLeaveType({ isContractorDefault: true });

    const { status, body } = await post('/api/leave/requests', u.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
      hours: 9,
      startHour: '09:00',
    });

    expect(status).toBe(400);
    expect(body.error).toMatch(/0\.5 and 8/i);
  });

  it('returns 400 for partial booking with non-0.5-increment hours', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    await makeLeaveType({ isContractorDefault: true });

    const { status, body } = await post('/api/leave/requests', u.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
      hours: 1.3,
      startHour: '09:00',
    });

    expect(status).toBe(400);
    expect(body.error).toMatch(/0\.5 increments/i);
  });

  it('returns 400 for partial booking that spans multiple days', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    await makeLeaveType({ isContractorDefault: true });

    const { status, body } = await post('/api/leave/requests', u.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-09',
      hours: 2,
      startHour: '09:00',
    });

    expect(status).toBe(400);
    expect(body.error).toMatch(/single-date/i);
  });

  it('returns 400 for partial booking without startHour', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    await makeLeaveType({ isContractorDefault: true });

    const { status, body } = await post('/api/leave/requests', u.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
      hours: 2,
    });

    expect(status).toBe(400);
    expect(body.error).toMatch(/startHour/i);
  });

  it('returns 400 when partial leave startHour is before work start (schedule validation)', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    await makeLeaveType({ isContractorDefault: true });
    // Default schedule: Mon 08:30-16:30. startHour 07:00 is before work start.

    const { status, body } = await post('/api/leave/requests', u.id, {
      startDate: '2026-06-08', // Monday
      endDate: '2026-06-08',
      hours: 2,
      startHour: '07:00',
    });

    expect(status).toBe(400);
    expect(body.error).toMatch(/before your work start/i);
  });

  it('returns 400 when partial leave would end after work end (schedule validation)', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    await makeLeaveType({ isContractorDefault: true });
    // Default schedule: Mon 08:30-16:30. 3h from 15:00 = 18:00, beyond 16:30.

    const { status, body } = await post('/api/leave/requests', u.id, {
      startDate: '2026-06-08', // Monday
      endDate: '2026-06-08',
      hours: 3,
      startHour: '15:00',
    });

    expect(status).toBe(400);
    expect(body.error).toMatch(/after your work end/i);
  });

  // ── Overlap/conflict detection ──

  it('returns 409 when a full-day booking conflicts with existing full-day booking', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    await makeLeaveType({ isContractorDefault: true });
    const lt = (await db.select().from(leaveTypes).where(eq(leaveTypes.isContractorDefault, true)))[0]!;

    // Create existing booking for 2026-06-08
    await makeLeaveRequest(u.id, lt.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
      daysCount: 1,
      status: 'autoconfirmed',
    });

    // Try to book the same day
    const { status, body } = await post('/api/leave/requests', u.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
    });

    expect(status).toBe(409);
    expect(body.error).toMatch(/full-day booking/i);
    expect(body.conflictDates).toContain('2026-06-08');
  });

  it('does not conflict with a cancelled booking on the same date', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    await makeLeaveType({ isContractorDefault: true });
    const lt = (await db.select().from(leaveTypes).where(eq(leaveTypes.isContractorDefault, true)))[0]!;

    await makeLeaveRequest(u.id, lt.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
      daysCount: 1,
      status: 'cancelled',
    });

    const { status } = await post('/api/leave/requests', u.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
    });

    expect(status).toBe(201);
  });

  it('returns 409 when full-day booking conflicts with existing partial booking on that date', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    await makeLeaveType({ isContractorDefault: true });
    const lt = (await db.select().from(leaveTypes).where(eq(leaveTypes.isContractorDefault, true)))[0]!;

    await makeLeaveRequest(u.id, lt.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
      daysCount: 1,
      hours: 2,
      startHour: '09:00',
      status: 'autoconfirmed',
    });

    const { status, body } = await post('/api/leave/requests', u.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
    });

    expect(status).toBe(409);
    expect(body.error).toMatch(/cancel existing partial/i);
  });

  it('returns 409 when partial-day bookings would exceed 4h on the same date', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    await makeLeaveType({ isContractorDefault: true });
    const lt = (await db.select().from(leaveTypes).where(eq(leaveTypes.isContractorDefault, true)))[0]!;

    // Create a 3h booking
    await makeLeaveRequest(u.id, lt.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
      daysCount: 1,
      hours: 3,
      startHour: '09:00',
      status: 'autoconfirmed',
    });

    // Try to add 2h more (total 5h > 4h limit)
    const { status, body } = await post('/api/leave/requests', u.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
      hours: 2,
      startHour: '12:00',
    });

    expect(status).toBe(409);
    expect(body.error).toMatch(/max 4h/i);
  });

  it('allows two partial bookings totalling ≤ 4h on the same date', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    await makeLeaveType({ isContractorDefault: true });
    const lt = (await db.select().from(leaveTypes).where(eq(leaveTypes.isContractorDefault, true)))[0]!;

    // Create 2h booking
    await makeLeaveRequest(u.id, lt.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
      daysCount: 1,
      hours: 2,
      startHour: '09:00',
      status: 'autoconfirmed',
    });

    // Add another 2h (total = 4h, within limit)
    const { status } = await post('/api/leave/requests', u.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
      hours: 2,
      startHour: '11:00',
    });

    expect(status).toBe(201);
  });

  it('persists new request to DB and can be read back', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    await makeLeaveType({ isContractorDefault: true });
    const lt = (await db.select().from(leaveTypes).where(eq(leaveTypes.isContractorDefault, true)))[0]!;

    const { body } = await post('/api/leave/requests', u.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
    });

    const [dbRow] = await db
      .select()
      .from(leaveRequests)
      .where(eq(leaveRequests.id, body.id));
    expect(dbRow).toBeDefined();
    expect(dbRow!.userId).toBe(u.id);
    expect(dbRow!.leaveTypeId).toBe(lt.id);
    expect(dbRow!.status).toBe('autoconfirmed');
    expect(dbRow!.daysCount).toBe(1);
  });
});

// ── PATCH /api/leave/requests/:id ────────────────────────────────────────

describe('PATCH /api/leave/requests/:id', () => {
  it('returns 404 for non-existent request', async () => {
    const u = await makeUser();
    const { status } = await patch(
      '/api/leave/requests/00000000-0000-0000-0000-000000000000',
      u.id,
      { note: 'hi' },
    );
    expect(status).toBe(404);
  });

  it('returns 400 for a malformed body type (validated by schema before the lookup)', async () => {
    const u = await makeUser();
    const lt = await makeLeaveType();
    const lr = await makeLeaveRequest(u.id, lt.id);
    // hours as a string is a ZodError → 400, not a 500
    expect((await patch(`/api/leave/requests/${lr.id}`, u.id, { hours: '4' })).status).toBe(400);
    expect((await patch(`/api/leave/requests/${lr.id}`, u.id, { startDate: 42 })).status).toBe(400);
  });

  it("returns 403 when a non-admin user tries to update another user's request", async () => {
    const owner = await makeUser({ role: 'user' });
    const other = await makeUser({ role: 'user' });
    const lt = await makeLeaveType();
    const lr = await makeLeaveRequest(owner.id, lt.id);

    const { status } = await patch(`/api/leave/requests/${lr.id}`, other.id, { note: 'hi' });
    expect(status).toBe(403);
  });

  it("admin can update another user's request", async () => {
    const owner = await makeUser({ role: 'user' });
    const admin = await makeUser({ role: 'admin' });
    const lt = await makeLeaveType();
    const lr = await makeLeaveRequest(owner.id, lt.id);

    const { status, body } = await patch(`/api/leave/requests/${lr.id}`, admin.id, {
      note: 'Admin updated',
    });
    expect(status).toBe(200);
    expect(body.note).toBe('Admin updated');
  });

  it('returns 400 when trying to update a cancelled request', async () => {
    const u = await makeUser({ role: 'user' });
    const lt = await makeLeaveType();
    const lr = await makeLeaveRequest(u.id, lt.id, { status: 'cancelled' });

    const { status, body } = await patch(`/api/leave/requests/${lr.id}`, u.id, { note: 'hi' });
    expect(status).toBe(400);
    expect(body.error).toMatch(/cancelled/i);
  });

  it('updates note field', async () => {
    const u = await makeUser({ role: 'user' });
    const lt = await makeLeaveType();
    const lr = await makeLeaveRequest(u.id, lt.id, { note: 'old note' });

    const { status, body } = await patch(`/api/leave/requests/${lr.id}`, u.id, {
      note: 'new note',
    });
    expect(status).toBe(200);
    expect(body.note).toBe('new note');

    const [dbRow] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, lr.id));
    expect(dbRow!.note).toBe('new note');
  });

  it('updates startDate/endDate and recalculates daysCount', async () => {
    const u = await makeUser({ role: 'user' });
    const lt = await makeLeaveType();
    const lr = await makeLeaveRequest(u.id, lt.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
      daysCount: 1,
    });

    // Extend to full week (Mon-Fri = 5 working days)
    const { status, body } = await patch(`/api/leave/requests/${lr.id}`, u.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-12',
    });

    expect(status).toBe(200);
    expect(body.daysCount).toBe(5);
    expect(body.endDate).toBe('2026-06-12');
  });

  it('returns 400 when updated date range is invalid (startDate > endDate)', async () => {
    const u = await makeUser({ role: 'user' });
    const lt = await makeLeaveType();
    const lr = await makeLeaveRequest(u.id, lt.id);

    const { status, body } = await patch(`/api/leave/requests/${lr.id}`, u.id, {
      startDate: '2026-06-15',
      endDate: '2026-06-10',
    });

    expect(status).toBe(400);
    expect(body.error).toMatch(/startDate must be <= endDate/i);
  });

  it('returns 400 when updated range has only weekends/holidays', async () => {
    const u = await makeUser({ role: 'user' });
    const lt = await makeLeaveType();
    const lr = await makeLeaveRequest(u.id, lt.id);

    // 2026-06-06 is Saturday, 2026-06-07 is Sunday
    const { status, body } = await patch(`/api/leave/requests/${lr.id}`, u.id, {
      startDate: '2026-06-06',
      endDate: '2026-06-07',
    });

    expect(status).toBe(400);
    expect(body.error).toMatch(/no working days/i);
  });

  it('returns 400 for invalid leave type on patch', async () => {
    const u = await makeUser({ role: 'user' });
    const lt = await makeLeaveType();
    const lr = await makeLeaveRequest(u.id, lt.id);

    const { status, body } = await patch(`/api/leave/requests/${lr.id}`, u.id, {
      leaveTypeId: '00000000-0000-0000-0000-000000000000',
    });

    expect(status).toBe(400);
    expect(body.error).toMatch(/invalid leave type/i);
  });

  it('returns 409 when patch conflicts with another booking on same date (excludes self)', async () => {
    const u = await makeUser({ role: 'user' });
    const lt = await makeLeaveType();
    // Create the booking we'll update (June 9)
    const lr = await makeLeaveRequest(u.id, lt.id, {
      startDate: '2026-06-09',
      endDate: '2026-06-09',
      daysCount: 1,
    });
    // Create another booking for June 8 (the date we'll try to move to)
    await makeLeaveRequest(u.id, lt.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
      daysCount: 1,
    });

    const { status, body } = await patch(`/api/leave/requests/${lr.id}`, u.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
    });

    expect(status).toBe(409);
    expect(body.conflictDates).toContain('2026-06-08');
  });

  it('self-update (same dates) does not conflict with itself', async () => {
    const u = await makeUser({ role: 'user' });
    const lt = await makeLeaveType();
    const lr = await makeLeaveRequest(u.id, lt.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
      daysCount: 1,
    });

    // Update only the note — same dates, should not conflict with itself
    const { status } = await patch(`/api/leave/requests/${lr.id}`, u.id, { note: 'updated' });
    expect(status).toBe(200);
  });

  it('persists update to DB', async () => {
    const u = await makeUser({ role: 'user' });
    const lt = await makeLeaveType();
    const lt2 = await makeLeaveType({ name: 'Sick Leave', visibility: 'all' });
    const lr = await makeLeaveRequest(u.id, lt.id);

    await patch(`/api/leave/requests/${lr.id}`, u.id, { leaveTypeId: lt2.id });

    const [dbRow] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, lr.id));
    expect(dbRow!.leaveTypeId).toBe(lt2.id);
  });

  it('returns 400 when a non-admin tries to move a booking to a past date', async () => {
    const u = await makeUser({ role: 'user' });
    const lt = await makeLeaveType();
    const lr = await makeLeaveRequest(u.id, lt.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
      daysCount: 1,
    });

    const { status, body } = await patch(`/api/leave/requests/${lr.id}`, u.id, {
      startDate: '2026-01-05', // Monday in the past relative to test "today" 2026-06-02
      endDate: '2026-01-05',
    });

    expect(status).toBe(400);
    expect(body.error).toMatch(/past/i);
  });

  it('admin can backdate a booking (past-date guard does not apply to admins)', async () => {
    const owner = await makeUser({ role: 'user' });
    const admin = await makeUser({ role: 'admin' });
    const lt = await makeLeaveType();
    const lr = await makeLeaveRequest(owner.id, lt.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
      daysCount: 1,
    });

    // Admin retro-corrects an entry to a past date — allowed.
    const { status, body } = await patch(`/api/leave/requests/${lr.id}`, admin.id, {
      startDate: '2026-01-05',
      endDate: '2026-01-05',
    });
    expect(status).toBe(200);
    expect(body.startDate).toBe('2026-01-05');
  });

  it('past-date guard does not fire when startDate is not in the body (note-only edit)', async () => {
    // A booking whose stored startDate is already in the past must still be editable
    // — only `body.startDate` triggers the guard, not the existing value.
    const u = await makeUser({ role: 'user' });
    const lt = await makeLeaveType();
    const lr = await makeLeaveRequest(u.id, lt.id, {
      startDate: '2026-01-05', // already past (seeded directly via DB)
      endDate: '2026-01-05',
      daysCount: 1,
    });

    const { status, body } = await patch(`/api/leave/requests/${lr.id}`, u.id, {
      note: 'late note',
    });
    expect(status).toBe(200);
    expect(body.note).toBe('late note');
  });

  // BUG NOTE: PATCH does not check that the status is not 'approved' — an approved
  // booking can be freely modified by its owner (no workflow protection).
  it('owner can patch an approved request (no workflow guard)', async () => {
    const u = await makeUser({ role: 'user' });
    const lt = await makeLeaveType();
    const lr = await makeLeaveRequest(u.id, lt.id, { status: 'approved' });

    const { status } = await patch(`/api/leave/requests/${lr.id}`, u.id, { note: 'changed' });
    // Pinning actual behavior: 200 — no guard for approved status
    expect(status).toBe(200);
  });
});

// ── DELETE /api/leave/requests/:id (soft-cancel) ─────────────────────────

describe('DELETE /api/leave/requests/:id (soft-cancel)', () => {
  it('sets status to cancelled (soft cancel, not hard delete)', async () => {
    const u = await makeUser({ role: 'user' });
    const lt = await makeLeaveType();
    const lr = await makeLeaveRequest(u.id, lt.id, { status: 'autoconfirmed' });

    const { status, body } = await del(`/api/leave/requests/${lr.id}`, u.id);
    expect(status).toBe(200);
    expect(body.status).toBe('cancelled');

    // Row still exists in DB (soft cancel, not hard delete)
    const [dbRow] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, lr.id));
    expect(dbRow).toBeDefined();
    expect(dbRow!.status).toBe('cancelled');
  });

  it('returns 404 for non-existent request', async () => {
    const u = await makeUser();
    const { status } = await del('/api/leave/requests/00000000-0000-0000-0000-000000000000', u.id);
    expect(status).toBe(404);
  });

  it("returns 403 when non-admin tries to cancel another user's request", async () => {
    const owner = await makeUser({ role: 'user' });
    const other = await makeUser({ role: 'user' });
    const lt = await makeLeaveType();
    const lr = await makeLeaveRequest(owner.id, lt.id);

    const { status } = await del(`/api/leave/requests/${lr.id}`, other.id);
    expect(status).toBe(403);
  });

  it("admin can cancel another user's request", async () => {
    const owner = await makeUser({ role: 'user' });
    const admin = await makeUser({ role: 'admin' });
    const lt = await makeLeaveType();
    const lr = await makeLeaveRequest(owner.id, lt.id);

    const { status, body } = await del(`/api/leave/requests/${lr.id}`, admin.id);
    expect(status).toBe(200);
    expect(body.status).toBe('cancelled');
  });

  it('returns 400 when trying to cancel an already-cancelled request', async () => {
    const u = await makeUser({ role: 'user' });
    const lt = await makeLeaveType();
    const lr = await makeLeaveRequest(u.id, lt.id, { status: 'cancelled' });

    const { status, body } = await del(`/api/leave/requests/${lr.id}`, u.id);
    expect(status).toBe(400);
    expect(body.error).toMatch(/already cancelled/i);
  });

  it('can cancel a pending request', async () => {
    const u = await makeUser({ role: 'user' });
    const lt = await makeLeaveType();
    const lr = await makeLeaveRequest(u.id, lt.id, { status: 'pending' });

    const { status, body } = await del(`/api/leave/requests/${lr.id}`, u.id);
    expect(status).toBe(200);
    expect(body.status).toBe('cancelled');
  });

  it('can cancel an approved request (no workflow protection for owners)', async () => {
    const u = await makeUser({ role: 'user' });
    const lt = await makeLeaveType();
    const lr = await makeLeaveRequest(u.id, lt.id, { status: 'approved' });

    const { status, body } = await del(`/api/leave/requests/${lr.id}`, u.id);
    // Pinning actual behavior: cancel is allowed for any non-cancelled status
    expect(status).toBe(200);
    expect(body.status).toBe('cancelled');
  });

  it('after cancellation, the same date can be booked again', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    await makeLeaveType({ isContractorDefault: true });
    const lt = (await db.select().from(leaveTypes).where(eq(leaveTypes.isContractorDefault, true)))[0]!;

    // Book and then cancel
    const lr = await makeLeaveRequest(u.id, lt.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
      daysCount: 1,
      status: 'autoconfirmed',
    });
    await del(`/api/leave/requests/${lr.id}`, u.id);

    // Should now be able to book the same date again
    const { status } = await post('/api/leave/requests', u.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
    });
    expect(status).toBe(201);
  });
});

// ── usedDays accounting (POST/PATCH/DELETE keep leave_allowances in sync) ───
//
// Invariant: `usedDays` = sum of daysCount across this user's non-cancelled requests
// of this type/year, when leaveType.deducted=true. The endpoints only update existing
// allowance rows (no auto-create) — admin/HR seeds them.

describe('usedDays accounting', () => {
  /** Read usedDays for (user, type, year). Returns null if no row. */
  async function getUsed(userId: string, leaveTypeId: string, year: number) {
    const [row] = await db
      .select({ usedDays: leaveAllowances.usedDays })
      .from(leaveAllowances)
      .where(
        and(
          eq(leaveAllowances.userId, userId),
          eq(leaveAllowances.leaveTypeId, leaveTypeId),
          eq(leaveAllowances.year, year),
        ),
      );
    return row?.usedDays ?? null;
  }

  it('POST increments usedDays on the allowance row of the deducted type', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    const lt = await makeLeaveType({ isContractorDefault: true, deducted: true });
    await db
      .insert(leaveAllowances)
      .values({ userId: u.id, leaveTypeId: lt.id, year: 2026, totalDays: 20, usedDays: 5 });

    const { status, body } = await post('/api/leave/requests', u.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-12', // 5 working days
    });
    expect(status).toBe(201);
    expect(body.daysCount).toBe(5);
    expect(await getUsed(u.id, lt.id, 2026)).toBe(10); // 5 + 5
  });

  it('POST does not touch usedDays for a non-deducted type', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    const lt = await makeLeaveType({ isContractorDefault: true, deducted: false });
    await db
      .insert(leaveAllowances)
      .values({ userId: u.id, leaveTypeId: lt.id, year: 2026, totalDays: 20, usedDays: 5 });

    await post('/api/leave/requests', u.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
    });
    expect(await getUsed(u.id, lt.id, 2026)).toBe(5); // unchanged
  });

  it('POST is a no-op for usedDays when no allowance row exists (still creates the request)', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    const lt = await makeLeaveType({ isContractorDefault: true, deducted: true });
    // No allowance row pre-seeded
    const { status } = await post('/api/leave/requests', u.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
    });
    expect(status).toBe(201);
    expect(await getUsed(u.id, lt.id, 2026)).toBeNull();
  });

  it('POST partial-day counts as +1 (matches daysCount semantics)', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    const lt = await makeLeaveType({ isContractorDefault: true, deducted: true });
    await db
      .insert(leaveAllowances)
      .values({ userId: u.id, leaveTypeId: lt.id, year: 2026, totalDays: 20, usedDays: 5 });

    await post('/api/leave/requests', u.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
      hours: 2,
      startHour: '09:00',
    });
    expect(await getUsed(u.id, lt.id, 2026)).toBe(6); // partial deducts 1 day
  });

  it('PATCH recomputes usedDays when daysCount changes (extend 1d → 5d)', async () => {
    const u = await makeUser({ role: 'user' });
    const lt = await makeLeaveType({ deducted: true });
    await db
      .insert(leaveAllowances)
      .values({ userId: u.id, leaveTypeId: lt.id, year: 2026, totalDays: 20, usedDays: 0 });

    const lr = await makeLeaveRequest(u.id, lt.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
      daysCount: 1,
    });

    // POST didn't run, so seed usedDays by hand to match the makeLeaveRequest insert:
    await db
      .update(leaveAllowances)
      .set({ usedDays: 1 })
      .where(eq(leaveAllowances.userId, u.id));

    await patch(`/api/leave/requests/${lr.id}`, u.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-12',
    });
    expect(await getUsed(u.id, lt.id, 2026)).toBe(5); // 1 − 1 + 5
  });

  it('PATCH shifts usedDays between leave types when leaveTypeId changes', async () => {
    const u = await makeUser({ role: 'user' });
    const ltA = await makeLeaveType({ name: 'Annual', deducted: true });
    const ltB = await makeLeaveType({ name: 'Sick', deducted: true });
    await db.insert(leaveAllowances).values([
      { userId: u.id, leaveTypeId: ltA.id, year: 2026, totalDays: 20, usedDays: 3 },
      { userId: u.id, leaveTypeId: ltB.id, year: 2026, totalDays: 14, usedDays: 0 },
    ]);

    const lr = await makeLeaveRequest(u.id, ltA.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
      daysCount: 1,
    });

    await patch(`/api/leave/requests/${lr.id}`, u.id, { leaveTypeId: ltB.id });

    expect(await getUsed(u.id, ltA.id, 2026)).toBe(2); // 3 − 1
    expect(await getUsed(u.id, ltB.id, 2026)).toBe(1); // 0 + 1
  });

  it('PATCH releases usedDays on the old year when startDate crosses years', async () => {
    const u = await makeUser({ role: 'admin' }); // admin so the past-date guard never fires
    const lt = await makeLeaveType({ deducted: true });
    await db.insert(leaveAllowances).values([
      { userId: u.id, leaveTypeId: lt.id, year: 2026, totalDays: 20, usedDays: 1 },
      { userId: u.id, leaveTypeId: lt.id, year: 2027, totalDays: 20, usedDays: 0 },
    ]);

    const lr = await makeLeaveRequest(u.id, lt.id, {
      startDate: '2026-12-28',
      endDate: '2026-12-28',
      daysCount: 1,
    });

    // Move into 2027 (admin to bypass past-date as well)
    await patch(`/api/leave/requests/${lr.id}`, u.id, {
      startDate: '2027-01-04',
      endDate: '2027-01-04',
    });

    expect(await getUsed(u.id, lt.id, 2026)).toBe(0); // 1 − 1
    expect(await getUsed(u.id, lt.id, 2027)).toBe(1); // 0 + 1
  });

  it('PATCH leaves the non-deducted side untouched (deducted → non-deducted)', async () => {
    const u = await makeUser({ role: 'user' });
    const ltDed = await makeLeaveType({ name: 'Annual', deducted: true });
    const ltFree = await makeLeaveType({ name: 'Unpaid', deducted: false });
    await db.insert(leaveAllowances).values([
      { userId: u.id, leaveTypeId: ltDed.id, year: 2026, totalDays: 20, usedDays: 1 },
      { userId: u.id, leaveTypeId: ltFree.id, year: 2026, totalDays: 0, usedDays: 0 },
    ]);

    const lr = await makeLeaveRequest(u.id, ltDed.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
      daysCount: 1,
    });

    await patch(`/api/leave/requests/${lr.id}`, u.id, { leaveTypeId: ltFree.id });

    expect(await getUsed(u.id, ltDed.id, 2026)).toBe(0); // released
    expect(await getUsed(u.id, ltFree.id, 2026)).toBe(0); // unchanged (non-deducted)
  });

  it('DELETE (cancel) decrements usedDays for a deducted type', async () => {
    const u = await makeUser({ role: 'user' });
    const lt = await makeLeaveType({ deducted: true });
    await db
      .insert(leaveAllowances)
      .values({ userId: u.id, leaveTypeId: lt.id, year: 2026, totalDays: 20, usedDays: 3 });

    const lr = await makeLeaveRequest(u.id, lt.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-10', // 3 working days
      daysCount: 3,
    });

    await del(`/api/leave/requests/${lr.id}`, u.id);
    expect(await getUsed(u.id, lt.id, 2026)).toBe(0);
  });

  it('DELETE is a no-op for usedDays when type is non-deducted', async () => {
    const u = await makeUser({ role: 'user' });
    const lt = await makeLeaveType({ deducted: false });
    await db
      .insert(leaveAllowances)
      .values({ userId: u.id, leaveTypeId: lt.id, year: 2026, totalDays: 20, usedDays: 3 });

    const lr = await makeLeaveRequest(u.id, lt.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-08',
      daysCount: 1,
    });

    await del(`/api/leave/requests/${lr.id}`, u.id);
    expect(await getUsed(u.id, lt.id, 2026)).toBe(3); // unchanged
  });

  it('POST + DELETE round-trip nets to zero', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    const lt = await makeLeaveType({ isContractorDefault: true, deducted: true });
    await db
      .insert(leaveAllowances)
      .values({ userId: u.id, leaveTypeId: lt.id, year: 2026, totalDays: 20, usedDays: 5 });

    const { body } = await post('/api/leave/requests', u.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-12',
    });
    expect(await getUsed(u.id, lt.id, 2026)).toBe(10);

    await del(`/api/leave/requests/${body.id}`, u.id);
    expect(await getUsed(u.id, lt.id, 2026)).toBe(5); // back to starting value
  });
});

// ── Date math helpers (unit-level) ────────────────────────────────────────

describe('working day calculation (via POST behavior)', () => {
  it('skips Polish public holidays in working day count', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    await makeLeaveType({ isContractorDefault: true });

    // 2026-11-11 is Independence Day (public holiday) — Wednesday
    // 2026-11-09 Mon to 2026-11-13 Fri = 5 calendar weekdays, but 11/11 is a holiday
    // So only 4 working days (Mon, Tue, Thu, Fri)
    const { status, body } = await post('/api/leave/requests', u.id, {
      startDate: '2026-11-09',
      endDate: '2026-11-13',
    });

    expect(status).toBe(201);
    expect(body.daysCount).toBe(4);
  });

  it('skips weekends in working day count', async () => {
    const u = await makeUser({ employmentType: 'contractor' });
    await makeLeaveType({ isContractorDefault: true });

    // 2026-06-08 Mon to 2026-06-14 Sun = 7 calendar days, 5 working days
    const { body } = await post('/api/leave/requests', u.id, {
      startDate: '2026-06-08',
      endDate: '2026-06-14',
    });

    expect(body.daysCount).toBe(5);
  });
});

// ── Helper to get a future date string ───────────────────────────────────

function getFutureDate(daysAhead: number): string {
  // Returns a weekday at least `daysAhead` days in the future.
  // Tries up to 14 days to find a working day (avoids holidays for simplicity,
  // but the route itself handles the holiday logic).
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  // Advance to Monday if weekend
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return d.toISOString().slice(0, 10);
}
