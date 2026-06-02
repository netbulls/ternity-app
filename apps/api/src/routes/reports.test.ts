import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { db, truncateAll } from '../../test/db.js';
import { buildApp } from '../../test/app.js';
import {
  clients,
  entrySegments,
  projects,
  reportTemplates,
  tags,
  entryTags,
  timeEntries,
  users,
} from '../db/schema.js';
import { reportsRoutes } from './reports.js';

// Integration tests for:
//   GET  /api/reports/data            — aggregation, RBAC, filtering
//   POST /api/reports/preview         — HTML render (content-type check + data shape)
//   GET  /api/reports/templates       — CRUD list
//   POST /api/reports/templates       — CRUD create
//   PATCH /api/reports/templates/:id  — CRUD update + ownership
//   DELETE /api/reports/templates/:id — CRUD delete + 204
//
// POST /api/reports/pdf is NOT tested here (requires live Gotenberg service).

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp(reportsRoutes);
});
afterAll(async () => {
  await app.close();
});
beforeEach(truncateAll);

// ── Seed helpers ────────────────────────────────────────────────────────────

async function makeUser(role: 'admin' | 'user' = 'user') {
  const [u] = await db
    .insert(users)
    .values({ displayName: `U-${Math.random()}`, email: `u${Math.random()}@x.io`, globalRole: role })
    .returning();
  return u!;
}

async function makeProject(name = 'Acme', color = '#00D4AA') {
  const [c] = await db.insert(clients).values({ name: `${name} Client` }).returning();
  const [p] = await db.insert(projects).values({ name, clientId: c!.id, color }).returning();
  return { project: p!, client: c! };
}

async function makeEntry(userId: string, over: Partial<typeof timeEntries.$inferInsert> = {}) {
  const [e] = await db.insert(timeEntries).values({ userId, description: 'Task', ...over }).returning();
  return e!;
}

/**
 * Seed a manual segment at midday UTC on a given YYYY-MM-DD.
 * Midday UTC = 14:00 Warsaw (summer) / 13:00 (winter) — safely in the same calendar day.
 */
async function makeSegmentAt(entryId: string, dateISO: string, durationSeconds: number) {
  const startedAt = new Date(dateISO + 'T12:00:00Z');
  await db.insert(entrySegments).values({
    entryId,
    type: 'manual',
    startedAt,
    stoppedAt: new Date(startedAt.getTime() + durationSeconds * 1000),
    durationSeconds,
  });
}

// Minimal valid ReportConfig for POST /api/reports/preview
const minConfig = {
  dateFrom: '2026-03-01',
  dateTo: '2026-03-31',
  projectIds: [],
  userIds: [],
  clientIds: [],
  tagIds: [],
};

const inject = (method: string, url: string, userId: string, body?: unknown) =>
  app.inject({
    method: method as 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url,
    headers: {
      'x-dev-user-id': userId,
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    payload: body !== undefined ? (body as object) : undefined,
  });

// ── GET /api/reports/data ────────────────────────────────────────────────────

describe('GET /api/reports/data', () => {
  it('requires dateFrom and dateTo — 400 when missing', async () => {
    const u = await makeUser();
    const res = await inject('GET', '/api/reports/data', u.id);
    expect(res.statusCode).toBe(400);
  });

  it('returns empty-data shape when no entries exist', async () => {
    const u = await makeUser();
    const res = await inject('GET', '/api/reports/data?dateFrom=2026-03-01&dateTo=2026-03-31', u.id);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.dateFrom).toBe('2026-03-01');
    expect(body.dateTo).toBe('2026-03-31');
    expect(body.summary.totalSeconds).toBe(0);
    expect(body.summary.totalEntries).toBe(0);
    expect(body.summary.userCount).toBe(0);
    expect(body.summary.projectCount).toBe(0);
    expect(body.userBreakdown).toHaveLength(0);
    expect(body.userDetails).toHaveLength(0);
    expect(body.projectBreakdown).toHaveLength(0);
  });

  it('counts working days correctly for a full March 2026 range (21 weekdays)', async () => {
    const u = await makeUser();
    const res = await inject('GET', '/api/reports/data?dateFrom=2026-03-01&dateTo=2026-03-31', u.id);
    expect(res.json().summary.workingDays).toBe(22); // March 2026: 22 weekdays
  });

  it('aggregates segment durations into totalSeconds', async () => {
    const u = await makeUser();
    const e = await makeEntry(u.id, { description: 'Work' });
    await makeSegmentAt(e.id, '2026-03-15', 3600); // 1h
    await makeSegmentAt(e.id, '2026-03-15', 1800); // 30min (same entry, same day)

    const res = await inject('GET', '/api/reports/data?dateFrom=2026-03-01&dateTo=2026-03-31', u.id);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.summary.totalSeconds).toBe(5400); // 1h30m
    expect(body.summary.totalEntries).toBe(1);
    expect(body.summary.userCount).toBe(1);
  });

  it('excludes entries outside the date range', async () => {
    const u = await makeUser();
    const inRange = await makeEntry(u.id, { description: 'March' });
    await makeSegmentAt(inRange.id, '2026-03-15', 3600);
    const outOfRange = await makeEntry(u.id, { description: 'April' });
    await makeSegmentAt(outOfRange.id, '2026-04-15', 3600);

    const res = await inject('GET', '/api/reports/data?dateFrom=2026-03-01&dateTo=2026-03-31', u.id);
    expect(res.json().summary.totalEntries).toBe(1);
    expect(res.json().summary.totalSeconds).toBe(3600);
  });

  it('excludes inactive (soft-deleted) entries', async () => {
    const u = await makeUser();
    const e = await makeEntry(u.id, { isActive: false });
    await makeSegmentAt(e.id, '2026-03-15', 7200);

    const res = await inject('GET', '/api/reports/data?dateFrom=2026-03-01&dateTo=2026-03-31', u.id);
    expect(res.json().summary.totalSeconds).toBe(0);
  });

  it('a non-admin user sees only their own entries', async () => {
    const alice = await makeUser('user');
    const bob = await makeUser('user');
    const eAlice = await makeEntry(alice.id, { description: 'Alice task' });
    await makeSegmentAt(eAlice.id, '2026-03-15', 1800);
    const eBob = await makeEntry(bob.id, { description: "Bob's task" });
    await makeSegmentAt(eBob.id, '2026-03-15', 3600);

    const res = await inject('GET', '/api/reports/data?dateFrom=2026-03-01&dateTo=2026-03-31', alice.id);
    const body = res.json();
    expect(body.summary.userCount).toBe(1);
    expect(body.summary.totalSeconds).toBe(1800);
    expect(body.userBreakdown[0].userId).toBe(alice.id);
  });

  it('an admin user sees all users by default', async () => {
    const admin = await makeUser('admin');
    const u2 = await makeUser('user');
    const e1 = await makeEntry(admin.id);
    await makeSegmentAt(e1.id, '2026-03-15', 1800);
    const e2 = await makeEntry(u2.id);
    await makeSegmentAt(e2.id, '2026-03-15', 3600);

    const res = await inject('GET', '/api/reports/data?dateFrom=2026-03-01&dateTo=2026-03-31', admin.id);
    const body = res.json();
    expect(body.summary.userCount).toBe(2);
    expect(body.summary.totalSeconds).toBe(5400);
  });

  it('an admin can filter to a specific userId via ?userIds=', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('user');
    const eAdmin = await makeEntry(admin.id);
    await makeSegmentAt(eAdmin.id, '2026-03-15', 7200);
    const eTarget = await makeEntry(target.id);
    await makeSegmentAt(eTarget.id, '2026-03-15', 1800);

    const res = await inject(
      'GET',
      `/api/reports/data?dateFrom=2026-03-01&dateTo=2026-03-31&userIds=${target.id}`,
      admin.id,
    );
    const body = res.json();
    expect(body.summary.userCount).toBe(1);
    expect(body.summary.totalSeconds).toBe(1800);
    expect(body.userBreakdown[0].userId).toBe(target.id);
  });

  it('userBreakdown is sorted by totalSeconds descending and percentages sum to ~100', async () => {
    const admin = await makeUser('admin');
    const u2 = await makeUser('user');
    const e1 = await makeEntry(admin.id);
    await makeSegmentAt(e1.id, '2026-03-15', 7200); // 2h
    const e2 = await makeEntry(u2.id);
    await makeSegmentAt(e2.id, '2026-03-15', 3600); // 1h

    const res = await inject('GET', '/api/reports/data?dateFrom=2026-03-01&dateTo=2026-03-31', admin.id);
    const breakdown: Array<{ totalSeconds: number; percentage: number }> = res.json().userBreakdown;
    // Sorted desc
    expect(breakdown[0]!.totalSeconds).toBe(7200);
    expect(breakdown[1]!.totalSeconds).toBe(3600);
    // Percentages: 67 + 33 = 100
    expect(breakdown[0]!.percentage).toBe(67);
    expect(breakdown[1]!.percentage).toBe(33);
    const pctSum = breakdown.reduce((s, u) => s + u.percentage, 0);
    expect(pctSum).toBeLessThanOrEqual(101); // rounding drift
    expect(pctSum).toBeGreaterThanOrEqual(99);
  });

  it('projectBreakdown groups entries by project and computes percentages', async () => {
    const u = await makeUser('admin');
    const { project: pA } = await makeProject('Alpha', '#ff0000');
    const { project: pB } = await makeProject('Beta', '#0000ff');

    const eA = await makeEntry(u.id, { projectId: pA.id });
    await makeSegmentAt(eA.id, '2026-03-15', 3000);
    const eB = await makeEntry(u.id, { projectId: pB.id });
    await makeSegmentAt(eB.id, '2026-03-15', 1000);

    const res = await inject('GET', '/api/reports/data?dateFrom=2026-03-01&dateTo=2026-03-31', u.id);
    const projectBreak: Array<{
      projectId: string | null;
      projectName: string;
      totalSeconds: number;
      percentage: number;
    }> = res.json().projectBreakdown;
    expect(projectBreak).toHaveLength(2);
    // sorted desc
    expect(projectBreak[0]!.projectName).toBe('Alpha');
    expect(projectBreak[0]!.projectId).toBe(pA.id); // real UUID, not the name
    expect(projectBreak[0]!.totalSeconds).toBe(3000);
    expect(projectBreak[0]!.percentage).toBe(75); // 3000/4000
    expect(projectBreak[1]!.projectName).toBe('Beta');
    expect(projectBreak[1]!.projectId).toBe(pB.id);
    expect(projectBreak[1]!.percentage).toBe(25);
  });

  it('two projects with the same name in different clients stay separate', async () => {
    // Pins the second half of the original bug — projectSet was keyed by name,
    // so same-named projects across clients would have merged into one row.
    const u = await makeUser('admin');
    const { project: pA } = await makeProject('Shared Name', '#ff0000');
    const { project: pB } = await makeProject('Shared Name', '#0000ff');
    expect(pA.id).not.toBe(pB.id);

    const eA = await makeEntry(u.id, { projectId: pA.id });
    await makeSegmentAt(eA.id, '2026-03-15', 1800);
    const eB = await makeEntry(u.id, { projectId: pB.id });
    await makeSegmentAt(eB.id, '2026-03-15', 1800);

    const res = await inject('GET', '/api/reports/data?dateFrom=2026-03-01&dateTo=2026-03-31', u.id);
    const pb: Array<{ projectId: string | null }> = res.json().projectBreakdown;
    expect(pb).toHaveLength(2);
    const ids = pb.map((p) => p.projectId).sort();
    expect(ids).toEqual([pA.id, pB.id].sort());
  });

  it('entries without a project appear under "No project" in projectBreakdown', async () => {
    const u = await makeUser('user');
    const e = await makeEntry(u.id); // no projectId
    await makeSegmentAt(e.id, '2026-03-15', 1800);

    const res = await inject('GET', '/api/reports/data?dateFrom=2026-03-01&dateTo=2026-03-31', u.id);
    const pb: Array<{ projectId: string | null; projectName: string; percentage: number }> =
      res.json().projectBreakdown;
    expect(pb).toHaveLength(1);
    expect(pb[0]!.projectId).toBeNull(); // sentinel for "no project"
    expect(pb[0]!.projectName).toBe('No project');
    expect(pb[0]!.percentage).toBe(100);
  });

  it('userDetails.dayGroups are sorted by date ascending', async () => {
    const u = await makeUser('user');
    const e1 = await makeEntry(u.id, { description: 'Later' });
    await makeSegmentAt(e1.id, '2026-03-20', 1800);
    const e2 = await makeEntry(u.id, { description: 'Earlier' });
    await makeSegmentAt(e2.id, '2026-03-10', 3600);

    const res = await inject('GET', '/api/reports/data?dateFrom=2026-03-01&dateTo=2026-03-31', u.id);
    const details = res.json().userDetails[0];
    expect(details.dayGroups[0].date).toBe('2026-03-10');
    expect(details.dayGroups[1].date).toBe('2026-03-20');
  });

  it('filters by projectIds query param — only matching entries included', async () => {
    const u = await makeUser('admin');
    const { project: pA } = await makeProject('Alpha');
    const { project: pB } = await makeProject('Beta');
    const eA = await makeEntry(u.id, { projectId: pA.id });
    await makeSegmentAt(eA.id, '2026-03-15', 1000);
    const eB = await makeEntry(u.id, { projectId: pB.id });
    await makeSegmentAt(eB.id, '2026-03-15', 2000);

    const res = await inject(
      'GET',
      `/api/reports/data?dateFrom=2026-03-01&dateTo=2026-03-31&projectIds=${pA.id}`,
      u.id,
    );
    const body = res.json();
    expect(body.summary.totalSeconds).toBe(1000);
    expect(body.summary.projectCount).toBe(1);
  });

  it('filters by clientIds query param', async () => {
    const u = await makeUser('admin');
    const { project: pA, client: cA } = await makeProject('Alpha');
    const { project: pB } = await makeProject('Beta');
    const eA = await makeEntry(u.id, { projectId: pA.id });
    await makeSegmentAt(eA.id, '2026-03-15', 1000);
    const eB = await makeEntry(u.id, { projectId: pB.id });
    await makeSegmentAt(eB.id, '2026-03-15', 2000);

    const res = await inject(
      'GET',
      `/api/reports/data?dateFrom=2026-03-01&dateTo=2026-03-31&clientIds=${cA.id}`,
      u.id,
    );
    expect(res.json().summary.totalSeconds).toBe(1000);
  });

  it('filters by tagIds — only entries with that tag included', async () => {
    const u = await makeUser('user');
    const [tag] = await db.insert(tags).values({ name: 'Billable', userId: u.id }).returning();
    const tagged = await makeEntry(u.id, { description: 'Tagged' });
    await makeSegmentAt(tagged.id, '2026-03-15', 3600);
    await db.insert(entryTags).values({ entryId: tagged.id, tagId: tag!.id });

    const untagged = await makeEntry(u.id, { description: 'Untagged' });
    await makeSegmentAt(untagged.id, '2026-03-15', 1800);

    const res = await inject(
      'GET',
      `/api/reports/data?dateFrom=2026-03-01&dateTo=2026-03-31&tagIds=${tag!.id}`,
      u.id,
    );
    const body = res.json();
    expect(body.summary.totalEntries).toBe(1);
    expect(body.summary.totalSeconds).toBe(3600);
  });

  it('generatedAt is an ISO timestamp string', async () => {
    const u = await makeUser();
    const res = await inject('GET', '/api/reports/data?dateFrom=2026-03-01&dateTo=2026-03-31', u.id);
    const { generatedAt } = res.json();
    expect(typeof generatedAt).toBe('string');
    expect(new Date(generatedAt).getTime()).toBeGreaterThan(0);
  });
});

// ── POST /api/reports/preview ─────────────────────────────────────────────────

describe('POST /api/reports/preview', () => {
  it('returns HTML content-type with non-empty body', async () => {
    const u = await makeUser();
    const res = await inject('POST', '/api/reports/preview', u.id, {
      template: 'classic-corporate',
      config: minConfig,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.body.length).toBeGreaterThan(100);
  });

  it('rejects an unknown template with 400', async () => {
    // BUG: GeneratePdfRequestSchema.parse() throws a ZodError which is not caught
    // and mapped to 400. Fastify treats unhandled errors as 500.
    // Expected: 400. Actual: 500.
    const u = await makeUser();
    const res = await inject('POST', '/api/reports/preview', u.id, {
      template: 'not-a-template',
      config: minConfig,
    });
    expect(res.statusCode).toBe(400); // ZodError mapped to 400 by the global error handler
  });

  it('rejects missing config fields with 400', async () => {
    // BUG: Same as above — ZodError from GeneratePdfRequestSchema.parse() surfaces as 500.
    const u = await makeUser();
    const res = await inject('POST', '/api/reports/preview', u.id, {
      template: 'classic-corporate',
      // config entirely omitted
    });
    expect(res.statusCode).toBe(400); // ZodError mapped to 400 by the global error handler
  });

  it('renders HTML containing the date range in some form', async () => {
    const u = await makeUser();
    const res = await inject('POST', '/api/reports/preview', u.id, {
      template: 'classic-corporate',
      config: { ...minConfig, dateFrom: '2026-03-01', dateTo: '2026-03-31' },
    });
    // The HTML template should mention the date range somewhere
    expect(res.body).toMatch(/2026/);
  });
});

// ── GET /api/reports/templates ───────────────────────────────────────────────

describe('GET /api/reports/templates', () => {
  it('returns an empty array when user has no saved templates', async () => {
    const u = await makeUser();
    const res = await inject('GET', '/api/reports/templates', u.id);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });

  it('returns only the callers own templates, sorted by name', async () => {
    const alice = await makeUser();
    const bob = await makeUser();

    // Seed directly via db to bypass route quirks
    await db.insert(reportTemplates).values([
      { name: 'Zebra', userId: alice.id, config: minConfig as Record<string, unknown> },
      { name: 'Alpha', userId: alice.id, config: minConfig as Record<string, unknown> },
      { name: "Bob's", userId: bob.id, config: minConfig as Record<string, unknown> },
    ]);

    const res = await inject('GET', '/api/reports/templates', alice.id);
    expect(res.statusCode).toBe(200);
    const body: Array<{ name: string; userId?: string }> = res.json();
    expect(body).toHaveLength(2); // bob's not included
    expect(body[0]!.name).toBe('Alpha');
    expect(body[1]!.name).toBe('Zebra');
  });

  it('returns template fields: id, name, config, isFavorite, createdAt, updatedAt', async () => {
    const u = await makeUser();
    await db.insert(reportTemplates).values({
      name: 'My Report',
      userId: u.id,
      config: minConfig as Record<string, unknown>,
      isFavorite: true,
    });

    const [tmpl] = res_json_arr(await inject('GET', '/api/reports/templates', u.id));
    expect(tmpl).toMatchObject({ name: 'My Report', isFavorite: true });
    expect(typeof tmpl!.id).toBe('string');
    expect(typeof tmpl!.createdAt).toBe('string');
    expect(typeof tmpl!.updatedAt).toBe('string');
  });
});

function res_json_arr(res: Awaited<ReturnType<typeof inject>>): Array<Record<string, unknown>> {
  return res.json() as Array<Record<string, unknown>>;
}

// ── POST /api/reports/templates ──────────────────────────────────────────────

describe('POST /api/reports/templates', () => {
  it('creates a template and returns the created object', async () => {
    const u = await makeUser();
    const res = await inject('POST', '/api/reports/templates', u.id, {
      name: 'Q1 Report',
      config: minConfig,
      isFavorite: false,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.name).toBe('Q1 Report');
    expect(body.isFavorite).toBe(false);
    expect(typeof body.id).toBe('string');
  });

  it('rejects a name longer than 200 characters with 400', async () => {
    // BUG: CreateReportTemplateSchema.parse() throws ZodError for name > 200 chars.
    // No error handler maps ZodError → 400, so Fastify returns 500.
    const u = await makeUser();
    const res = await inject('POST', '/api/reports/templates', u.id, {
      name: 'X'.repeat(201),
      config: minConfig,
    });
    expect(res.statusCode).toBe(400); // ZodError mapped to 400 by the global error handler
  });

  it('rejects an empty name with 400', async () => {
    // BUG: ZodError for empty name surfaces as 500, not 400.
    const u = await makeUser();
    const res = await inject('POST', '/api/reports/templates', u.id, {
      name: '',
      config: minConfig,
    });
    expect(res.statusCode).toBe(400); // ZodError mapped to 400 by the global error handler
  });
});

// ── PATCH /api/reports/templates/:id ─────────────────────────────────────────

describe('PATCH /api/reports/templates/:id', () => {
  async function createTemplate(userId: string, name = 'Base') {
    const [r] = await db
      .insert(reportTemplates)
      .values({ name, userId, config: minConfig as Record<string, unknown> })
      .returning();
    return r!;
  }

  it('updates the name of an owned template', async () => {
    const u = await makeUser();
    const tmpl = await createTemplate(u.id);

    const res = await inject('PATCH', `/api/reports/templates/${tmpl.id}`, u.id, {
      name: 'Renamed',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Renamed');
  });

  it('updates isFavorite independently', async () => {
    const u = await makeUser();
    const tmpl = await createTemplate(u.id);

    const res = await inject('PATCH', `/api/reports/templates/${tmpl.id}`, u.id, {
      isFavorite: true,
    });
    expect(res.json().isFavorite).toBe(true);
  });

  it('returns 404 for a template owned by another user', async () => {
    const alice = await makeUser();
    const bob = await makeUser();
    const tmpl = await createTemplate(bob.id);

    const res = await inject('PATCH', `/api/reports/templates/${tmpl.id}`, alice.id, {
      name: 'Hijacked',
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for a non-existent template id', async () => {
    const u = await makeUser();
    const res = await inject(
      'PATCH',
      '/api/reports/templates/00000000-0000-0000-0000-000000000000',
      u.id,
      { name: 'Ghost' },
    );
    expect(res.statusCode).toBe(404);
  });
});

// ── DELETE /api/reports/templates/:id ────────────────────────────────────────

describe('DELETE /api/reports/templates/:id', () => {
  it('deletes an owned template and returns 204', async () => {
    const u = await makeUser();
    const [tmpl] = await db
      .insert(reportTemplates)
      .values({ name: 'Gone', userId: u.id, config: minConfig as Record<string, unknown> })
      .returning();

    const res = await inject('DELETE', `/api/reports/templates/${tmpl!.id}`, u.id);
    expect(res.statusCode).toBe(204);

    // Confirm deleted
    const after = await inject('GET', '/api/reports/templates', u.id);
    expect(after.json()).toHaveLength(0);
  });

  it('silently succeeds (204) when deleting a non-owned or non-existent template', async () => {
    // NOTE: The route does NOT check ownership before deletion — it calls db.delete
    // and then reply.code(204).send() unconditionally. This is a potential bug
    // (another user's template could be silently ignored, but the call returns 204).
    // We characterize actual behaviour: always 204.
    const alice = await makeUser();
    const bob = await makeUser();
    const [tmpl] = await db
      .insert(reportTemplates)
      .values({ name: "Bob's", userId: bob.id, config: minConfig as Record<string, unknown> })
      .returning();

    const res = await inject('DELETE', `/api/reports/templates/${tmpl!.id}`, alice.id);
    // BUG: The DELETE route returns 204 regardless of whether the template belonged
    // to the caller. The template WHERE clause uses userId matching, so the delete
    // is a no-op for non-owners, but the caller still gets 204.
    expect(res.statusCode).toBe(204);

    // Bob's template must still exist
    const check = await inject('GET', '/api/reports/templates', bob.id);
    expect(check.json()).toHaveLength(1);
  });
});
