import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, truncateAll } from '../../test/db.js';
import { buildApp } from '../../test/app.js';
import {
  clients,
  entryAuditLog,
  entrySegments,
  projectMembers,
  projects,
  tags,
  timeEntries,
  users,
} from '../db/schema.js';
import { entriesRoutes } from './entries.js';

// Integration tests for POST /api/entries (create a manual entry). Covers the write
// path (entry + manual segment + tags + audit), project-permission checks, and
// characterizes the missing request-body validation (audit S4: body is cast, not
// parsed — a missing required field crashes with 500 instead of a 400).

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp(entriesRoutes);
});
afterAll(async () => {
  await app.close();
});
beforeEach(truncateAll);

async function makeUser(role: 'admin' | 'user' = 'admin') {
  const [u] = await db
    .insert(users)
    .values({ displayName: 'Actor', email: `${role}@x.io`, globalRole: role })
    .returning();
  return u!;
}

async function makeProject(name = 'Web') {
  const [c] = await db.insert(clients).values({ name: `${name} Client` }).returning();
  const [p] = await db.insert(projects).values({ name, clientId: c!.id }).returning();
  return p!;
}

const post = async (userId: string, body: unknown) => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/entries',
    headers: { 'x-dev-user-id': userId },
    payload: body as object,
  });
  return { status: res.statusCode, body: res.statusCode < 400 ? res.json() : null };
};

const validBody = (over: Record<string, unknown> = {}) => ({
  description: 'Write tests',
  startedAt: '2026-05-20T09:00:00.000Z',
  stoppedAt: '2026-05-20T10:30:00.000Z',
  note: 'logged manually',
  ...over,
});

describe('POST /api/entries', () => {
  it('creates an entry with one manual segment and returns the entry', async () => {
    const u = await makeUser('admin');
    const { status, body } = await post(u.id, validBody());

    expect(status).toBe(201);
    expect(body).toMatchObject({ description: 'Write tests', isActive: true, isRunning: false });
    expect(body.segments).toHaveLength(1);
    expect(body.segments[0]).toMatchObject({ type: 'manual', durationSeconds: 5400 });

    // persisted
    const rows = await db.select().from(timeEntries);
    expect(rows).toHaveLength(1);
    const segs = await db.select().from(entrySegments).where(eq(entrySegments.entryId, rows[0]!.id));
    expect(segs[0]!.note).toBe('logged manually');
  });

  it('computes durationSeconds from startedAt/stoppedAt', async () => {
    const u = await makeUser('admin');
    const { body } = await post(u.id, validBody({ stoppedAt: '2026-05-20T09:01:00.000Z' }));
    expect(body.segments[0].durationSeconds).toBe(60);
  });

  it('allows a null project', async () => {
    const u = await makeUser('admin');
    const { status, body } = await post(u.id, validBody({ projectId: null }));
    expect(status).toBe(201);
    expect(body.projectId).toBeNull();
  });

  it('attaches tags', async () => {
    const u = await makeUser('admin');
    const [tag] = await db.insert(tags).values({ name: 'Billable', userId: u.id }).returning();
    const { body } = await post(u.id, validBody({ tagIds: [tag!.id] }));
    expect(body.tags.map((t: { id: string }) => t.id)).toEqual([tag!.id]);
  });

  it('records a "created" audit event', async () => {
    const u = await makeUser('admin');
    const { body } = await post(u.id, validBody());
    const audit = await db.select().from(entryAuditLog).where(eq(entryAuditLog.entryId, body.id));
    expect(audit).toHaveLength(1);
    expect(audit[0]!.action).toBe('created');
  });

  describe('project permission', () => {
    it('rejects a non-admin assigning a project they are not a member of (403)', async () => {
      const u = await makeUser('user');
      const p = await makeProject();
      const { status } = await post(u.id, validBody({ projectId: p.id }));
      expect(status).toBe(403);
    });

    it('allows a non-admin assigning a project they are a member of', async () => {
      const u = await makeUser('user');
      const p = await makeProject();
      await db.insert(projectMembers).values({ userId: u.id, projectId: p.id, role: 'user' });
      const { status, body } = await post(u.id, validBody({ projectId: p.id }));
      expect(status).toBe(201);
      expect(body.projectId).toBe(p.id);
    });
  });

  it('rejects a missing required field with 400 (body validated by CreateEntrySchema)', async () => {
    const u = await makeUser('admin');
    // `note` is required by CreateEntrySchema; the route parses the body, so a missing
    // field is a ZodError → 400 (via the global error handler), not a 500 crash.
    const { startedAt, stoppedAt, description } = validBody();
    const { status } = await post(u.id, { startedAt, stoppedAt, description }); // no note
    expect(status).toBe(400);
  });

  it('rejects an empty note with 400 (min length 1)', async () => {
    const u = await makeUser('admin');
    expect((await post(u.id, validBody({ note: '' }))).status).toBe(400);
  });
});
