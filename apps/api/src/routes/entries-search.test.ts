import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { db, truncateAll } from '../../test/db.js';
import { buildApp } from '../../test/app.js';
import { clients, entrySegments, projects, timeEntries, users } from '../db/schema.js';
import { entriesRoutes } from './entries.js';

// Integration tests for GET /api/entries/search. This route builds a raw SQL query
// with drizzle's sql`` template; the audit flagged it as SQL injection (S1). These
// tests characterize its behavior AND demonstrate that the ${} interpolations are
// parameterized (so a payload is treated as a literal and cannot break out / bypass
// the user_id filter) — i.e. S1 is a static-analysis false positive.

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp(entriesRoutes);
});
afterAll(async () => {
  await app.close();
});
beforeEach(truncateAll);

async function makeUser(displayName: string) {
  const [u] = await db
    .insert(users)
    .values({ displayName, email: `${displayName.toLowerCase()}@x.io` })
    .returning();
  return u!;
}

async function makeEntry(
  userId: string,
  opts: { description?: string; jiraIssueKey?: string; isActive?: boolean; createdAt?: Date } = {},
) {
  const [e] = await db
    .insert(timeEntries)
    .values({
      userId,
      description: opts.description ?? '',
      jiraIssueKey: opts.jiraIssueKey ?? null,
      isActive: opts.isActive ?? true,
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
    })
    .returning();
  return e!;
}

const search = async (userId: string, q: string, extra: Record<string, string> = {}) => {
  const qs = new URLSearchParams({ q, ...extra }).toString();
  const res = await app.inject({
    method: 'GET',
    url: `/api/entries/search?${qs}`,
    headers: { 'x-dev-user-id': userId },
  });
  return { status: res.statusCode, body: res.json() as Array<{ id: string; description: string }> };
};

describe('GET /api/entries/search', () => {
  it('returns [] for queries shorter than 2 characters', async () => {
    const u = await makeUser('Ann');
    await makeEntry(u.id, { description: 'Frontend work' });
    expect((await search(u.id, 'a')).body).toEqual([]);
    expect((await search(u.id, '')).body).toEqual([]);
  });

  it('matches by description substring, case-insensitively', async () => {
    const u = await makeUser('Ann');
    await makeEntry(u.id, { description: 'Frontend Development' });
    await makeEntry(u.id, { description: 'Backend stuff' });

    const { body } = await search(u.id, 'frontend');
    expect(body.map((r) => r.description)).toEqual(['Frontend Development']);
  });

  it('matches by jira issue key', async () => {
    const u = await makeUser('Ann');
    await makeEntry(u.id, { description: 'some task', jiraIssueKey: 'PROJ-123' });

    const { body } = await search(u.id, 'PROJ-123');
    expect(body).toHaveLength(1);
  });

  it('only returns the caller’s own active, non-empty-description entries', async () => {
    const ann = await makeUser('Ann');
    const bob = await makeUser('Bob');
    await makeEntry(ann.id, { description: 'shared keyword mine' });
    await makeEntry(bob.id, { description: 'shared keyword theirs' });
    await makeEntry(ann.id, { description: 'shared keyword inactive', isActive: false });
    await makeEntry(ann.id, { description: '' }); // empty description excluded

    const { body } = await search(ann.id, 'shared keyword');
    expect(body.map((r) => r.description)).toEqual(['shared keyword mine']);
  });

  it('deduplicates by description, keeping the most recent', async () => {
    const u = await makeUser('Ann');
    await makeEntry(u.id, { description: 'Standup', createdAt: new Date('2026-01-01T00:00:00Z') });
    const recent = await makeEntry(u.id, {
      description: 'Standup',
      createdAt: new Date('2026-05-01T00:00:00Z'),
    });

    const { body } = await search(u.id, 'Standup');
    expect(body).toHaveLength(1);
    expect(body[0]!.id).toBe(recent.id);
  });

  it('caps the limit at 20', async () => {
    const u = await makeUser('Ann');
    for (let i = 0; i < 25; i++) await makeEntry(u.id, { description: `Task number ${i}` });

    expect((await search(u.id, 'Task number')).body.length).toBeLessThanOrEqual(10); // default
    expect((await search(u.id, 'Task number', { limit: '50' })).body.length).toBeLessThanOrEqual(20);
  });

  describe('injection safety (drizzle parameterization — S1 false positive)', () => {
    it('treats an OR-injection payload as a literal and does not bypass the user_id filter', async () => {
      const ann = await makeUser('Ann');
      const bob = await makeUser('Bob');
      await makeEntry(ann.id, { description: 'Ann private note' });
      await makeEntry(bob.id, { description: 'Bob private note' });

      // Classic bypass attempt; if interpolated raw it could leak Bob's rows.
      const { status, body } = await search(ann.id, "x' OR '1'='1");
      expect(status).toBe(200);
      expect(body.every((r) => r.description !== 'Bob private note')).toBe(true);
    });

    it('treats a DROP TABLE payload as a literal — the table survives', async () => {
      const u = await makeUser('Ann');
      await makeEntry(u.id, { description: 'keep me safe' });

      const { status } = await search(u.id, "'; DROP TABLE time_entries; --");
      expect(status).toBe(200);
      // table intact: the row is still queryable
      expect(await db.select().from(timeEntries)).toHaveLength(1);
    });
  });

  it('returns the documented response shape', async () => {
    const u = await makeUser('Ann');
    const [c] = await db.insert(clients).values({ name: 'Acme' }).returning();
    const [p] = await db.insert(projects).values({ name: 'Web', clientId: c!.id }).returning();
    const [e] = await db
      .insert(timeEntries)
      .values({ userId: u.id, description: 'Shape check', projectId: p!.id })
      .returning();
    await db.insert(entrySegments).values({
      entryId: e!.id,
      type: 'clocked',
      startedAt: new Date('2026-05-01T09:00:00Z'),
      stoppedAt: new Date('2026-05-01T10:00:00Z'),
      durationSeconds: 3600,
    });

    const { body } = await search(u.id, 'Shape check');
    expect(body[0]).toMatchObject({
      id: e!.id,
      description: 'Shape check',
      projectName: 'Web',
      clientName: 'Acme',
      totalDurationSeconds: 3600,
      isRunning: false,
    });
  });
});
