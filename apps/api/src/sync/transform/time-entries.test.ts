import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, truncateAll } from '../../../test/db.js';
import {
  clients,
  entrySegments,
  entryTags,
  projects,
  stgTogglTags,
  stgTogglTimeEntries,
  tags,
  timeEntries,
  users,
} from '../../db/schema.js';
import { findTargetId, upsertMapping } from './mappings.js';

// Characterization tests for the time-entries transform: flatten staging rows into
// time_entries + a single clocked segment, resolve user/project/tag mappings, and
// fall back to a synthetic "No Project". Real Postgres via the test harness.
//
// transform/time-entries.ts caches the "No Project" id at module scope; truncateAll
// would leave that cache pointing at a deleted row. Re-import the module per test
// (vi.resetModules) so the cache starts empty each time.

let transformTimeEntries: typeof import('./time-entries.js').transformTimeEntries;

beforeEach(async () => {
  await truncateAll();
  vi.resetModules();
  ({ transformTimeEntries } = await import('./time-entries.js'));
});

async function makeMappedUser(togglUserId: string) {
  const [u] = await db
    .insert(users)
    .values({ displayName: 'U', email: `${togglUserId}@netbulls.io` })
    .returning();
  await upsertMapping('toggl', 'users', togglUserId, 'users', u!.id);
  return u!;
}

async function makeMappedProject(togglProjectId: string, name = 'Project X') {
  const [c] = await db.insert(clients).values({ name: `Client ${togglProjectId}` }).returning();
  const [p] = await db.insert(projects).values({ name, clientId: c!.id }).returning();
  await upsertMapping('toggl', 'projects', togglProjectId, 'projects', p!.id);
  return p!;
}

const seedEntry = (externalId: string, raw: Record<string, unknown>) =>
  db.insert(stgTogglTimeEntries).values({ externalId, rawData: raw });
const seedTogglTag = (tagId: string, name: string) =>
  db.insert(stgTogglTags).values({ externalId: tagId, rawData: { name } });

const segmentsOf = (entryId: string) =>
  db.select().from(entrySegments).where(eq(entrySegments.entryId, entryId));

// ── Skip paths ─────────────────────────────────────────────────────────────

describe('transformTimeEntries — skip paths', () => {
  it('skips an entry with no user_id/uid', async () => {
    await seedEntry('e1', { description: 'orphan', seconds: 60 });
    const counts = await transformTimeEntries();
    expect(counts).toEqual({ created: 0, updated: 0, skipped: 1 });
    expect(await db.select().from(timeEntries)).toHaveLength(0);
  });

  it('skips an entry whose toggl user has no mapping', async () => {
    await seedEntry('e1', { user_id: 12345, seconds: 60 });
    const counts = await transformTimeEntries();
    expect(counts).toEqual({ created: 0, updated: 0, skipped: 1 });
    expect(await db.select().from(timeEntries)).toHaveLength(0);
  });
});

// ── Create path ──────────────────────────────────────────────────────────

describe('transformTimeEntries — create', () => {
  it('creates an entry + one clocked segment and records the mapping', async () => {
    const u = await makeMappedUser('100');
    const p = await makeMappedProject('200');
    await seedEntry('e1', {
      user_id: 100,
      project_id: 200,
      description: 'Build feature',
      start: '2026-05-20T09:00:00.000Z',
      stop: '2026-05-20T10:00:00.000Z',
      seconds: 3600,
    });

    const counts = await transformTimeEntries();
    expect(counts).toEqual({ created: 1, updated: 0, skipped: 0 });

    const [entry] = await db.select().from(timeEntries);
    expect(entry!.userId).toBe(u.id);
    expect(entry!.projectId).toBe(p.id);
    expect(entry!.description).toBe('Build feature');
    expect(await findTargetId('toggl', 'time_entries', 'e1')).toBe(entry!.id);

    const segs = await segmentsOf(entry!.id);
    expect(segs).toHaveLength(1);
    expect(segs[0]!.type).toBe('clocked');
    expect(segs[0]!.durationSeconds).toBe(3600);
    expect(segs[0]!.startedAt).toEqual(new Date('2026-05-20T09:00:00.000Z'));
    expect(segs[0]!.stoppedAt).toEqual(new Date('2026-05-20T10:00:00.000Z'));
  });

  it('falls back to the uid field when user_id is absent', async () => {
    const u = await makeMappedUser('100');
    await makeMappedProject('200');
    await seedEntry('e1', { uid: 100, project_id: 200, seconds: 60 });

    await transformTimeEntries();
    const [entry] = await db.select().from(timeEntries);
    expect(entry!.userId).toBe(u.id);
  });

  it('falls back to the pid field when project_id is absent', async () => {
    await makeMappedUser('100');
    const p = await makeMappedProject('200');
    await seedEntry('e1', { user_id: 100, pid: 200, seconds: 60 });

    await transformTimeEntries();
    const [entry] = await db.select().from(timeEntries);
    expect(entry!.projectId).toBe(p.id);
  });

  it('defaults description to "" when absent', async () => {
    await makeMappedUser('100');
    await makeMappedProject('200');
    await seedEntry('e1', { user_id: 100, project_id: 200, seconds: 60 });

    await transformTimeEntries();
    const [entry] = await db.select().from(timeEntries);
    expect(entry!.description).toBe('');
  });

  it('routes entries with no project to a synthetic "No Project"/"Unassigned"', async () => {
    await makeMappedUser('100');
    await seedEntry('e1', { user_id: 100, seconds: 60 }); // no project_id/pid

    await transformTimeEntries();

    const [noProject] = await db.select().from(projects).where(eq(projects.name, 'No Project'));
    expect(noProject).toBeDefined();
    const [unassigned] = await db.select().from(clients).where(eq(clients.name, 'Unassigned'));
    expect(unassigned).toBeDefined();

    const [entry] = await db.select().from(timeEntries);
    expect(entry!.projectId).toBe(noProject!.id);
  });

  it('routes entries with an unmapped project to "No Project"', async () => {
    await makeMappedUser('100');
    await seedEntry('e1', { user_id: 100, project_id: 999, seconds: 60 }); // 999 unmapped

    await transformTimeEntries();
    const [noProject] = await db.select().from(projects).where(eq(projects.name, 'No Project'));
    const [entry] = await db.select().from(timeEntries);
    expect(entry!.projectId).toBe(noProject!.id);
  });
});

// ── Duration & timestamps ──────────────────────────────────────────────────

describe('transformTimeEntries — duration & timestamps', () => {
  beforeEach(async () => {
    await makeMappedUser('100');
    await makeMappedProject('200');
  });

  const durationOf = async () => {
    const [entry] = await db.select().from(timeEntries);
    const segs = await segmentsOf(entry!.id);
    return segs[0]!.durationSeconds;
  };

  it('prefers seconds over duration', async () => {
    await seedEntry('e1', { user_id: 100, project_id: 200, seconds: 3600, duration: 120 });
    await transformTimeEntries();
    expect(await durationOf()).toBe(3600);
  });

  it('uses duration when seconds is absent', async () => {
    await seedEntry('e1', { user_id: 100, project_id: 200, duration: 120 });
    await transformTimeEntries();
    expect(await durationOf()).toBe(120);
  });

  it('stores null duration for a running (negative) entry', async () => {
    await seedEntry('e1', { user_id: 100, project_id: 200, seconds: -5 });
    await transformTimeEntries();
    expect(await durationOf()).toBeNull();
  });

  it('stores null duration for a zero-second entry', async () => {
    await seedEntry('e1', { user_id: 100, project_id: 200, seconds: 0 });
    await transformTimeEntries();
    expect(await durationOf()).toBeNull();
  });

  it('leaves stoppedAt null when there is no stop, and defaults startedAt to ~now when no start', async () => {
    await seedEntry('e1', { user_id: 100, project_id: 200, seconds: -1 }); // running, no start/stop
    await transformTimeEntries();
    const [entry] = await db.select().from(timeEntries);
    const segs = await segmentsOf(entry!.id);
    expect(segs[0]!.stoppedAt).toBeNull();
    expect(segs[0]!.startedAt).toBeInstanceOf(Date);
    expect(Math.abs(Date.now() - segs[0]!.startedAt!.getTime())).toBeLessThan(60_000);
  });
});

// ── Tag resolution ─────────────────────────────────────────────────────────

describe('transformTimeEntries — tags', () => {
  it('resolves numeric tag_ids to names and creates+links tags for the user', async () => {
    const u = await makeMappedUser('100');
    await makeMappedProject('200');
    await seedTogglTag('10', 'Billable');
    await seedEntry('e1', { user_id: 100, project_id: 200, seconds: 60, tag_ids: [10] });

    await transformTimeEntries();

    const userTags = await db.select().from(tags).where(eq(tags.userId, u.id));
    expect(userTags).toHaveLength(1);
    expect(userTags[0]!.name).toBe('Billable');

    const [entry] = await db.select().from(timeEntries);
    const links = await db.select().from(entryTags).where(eq(entryTags.entryId, entry!.id));
    expect(links).toHaveLength(1);
    expect(links[0]!.tagId).toBe(userTags[0]!.id);
  });

  it('drops tag_ids that have no matching staging tag', async () => {
    const u = await makeMappedUser('100');
    await makeMappedProject('200');
    await seedEntry('e1', { user_id: 100, project_id: 200, seconds: 60, tag_ids: [99] }); // unknown

    await transformTimeEntries();
    expect(await db.select().from(tags).where(eq(tags.userId, u.id))).toHaveLength(0);
    const [entry] = await db.select().from(timeEntries);
    expect(await db.select().from(entryTags).where(eq(entryTags.entryId, entry!.id))).toHaveLength(0);
  });

  it('reuses an existing tag case-insensitively instead of duplicating', async () => {
    const u = await makeMappedUser('100');
    await makeMappedProject('200');
    await db.insert(tags).values({ name: 'Billable', userId: u.id }); // existing, capitalised
    await seedTogglTag('10', 'billable'); // staging name lowercase
    await seedEntry('e1', { user_id: 100, project_id: 200, seconds: 60, tag_ids: [10] });

    await transformTimeEntries();

    const userTags = await db.select().from(tags).where(eq(tags.userId, u.id));
    expect(userTags).toHaveLength(1); // no duplicate created
    expect(userTags[0]!.name).toBe('Billable');
  });
});

// ── Update / idempotency ───────────────────────────────────────────────────

describe('transformTimeEntries — update & idempotency', () => {
  it('is idempotent: a second run updates in place — one entry, one mapping, one segment', async () => {
    await makeMappedUser('100');
    await makeMappedProject('200');
    await seedEntry('e1', {
      user_id: 100,
      project_id: 200,
      description: 'v1',
      seconds: 60,
    });

    const first = await transformTimeEntries();
    const second = await transformTimeEntries();

    expect(first).toEqual({ created: 1, updated: 0, skipped: 0 });
    expect(second).toEqual({ created: 0, updated: 1, skipped: 0 });

    const entries = await db.select().from(timeEntries);
    expect(entries).toHaveLength(1);
    expect(await segmentsOf(entries[0]!.id)).toHaveLength(1);
  });

  it('updates metadata and replaces the segment when staging changes', async () => {
    await makeMappedUser('100');
    await makeMappedProject('200');
    await seedEntry('e1', { user_id: 100, project_id: 200, description: 'v1', seconds: 60 });
    await transformTimeEntries();

    await db
      .update(stgTogglTimeEntries)
      .set({ rawData: { user_id: 100, project_id: 200, description: 'v2', seconds: 7200 } })
      .where(eq(stgTogglTimeEntries.externalId, 'e1'));
    await transformTimeEntries();

    const [entry] = await db.select().from(timeEntries);
    expect(entry!.description).toBe('v2');
    const segs = await segmentsOf(entry!.id);
    expect(segs).toHaveLength(1);
    expect(segs[0]!.durationSeconds).toBe(7200);
  });

  it('re-syncs tags on update (removes a tag that is no longer present)', async () => {
    const u = await makeMappedUser('100');
    await makeMappedProject('200');
    await seedTogglTag('10', 'Billable');
    await seedEntry('e1', { user_id: 100, project_id: 200, seconds: 60, tag_ids: [10] });
    await transformTimeEntries();

    // staging no longer carries the tag
    await db
      .update(stgTogglTimeEntries)
      .set({ rawData: { user_id: 100, project_id: 200, seconds: 60 } })
      .where(eq(stgTogglTimeEntries.externalId, 'e1'));
    await transformTimeEntries();

    const [entry] = await db.select().from(timeEntries);
    expect(await db.select().from(entryTags).where(eq(entryTags.entryId, entry!.id))).toHaveLength(0);
    // the tag row itself remains (only the link is cleared)
    expect(await db.select().from(tags).where(eq(tags.userId, u.id))).toHaveLength(1);
  });
});
