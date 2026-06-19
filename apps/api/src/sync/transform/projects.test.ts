import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, truncateAll } from '../../../test/db.js';
import { clients, projects, stgTogglProjects } from '../../db/schema.js';
import { findTargetId, upsertMapping } from './mappings.js';

// Characterization tests for the projects staging→target transform: name/color
// fallbacks, client resolution via mappings, and the "Unassigned" default-client
// path. Real Postgres via the test harness.
//
// transform/projects.ts caches the default client id at module scope; re-import per
// test (vi.resetModules) so truncateAll doesn't leave the cache pointing at a deleted row.

let transformProjects: typeof import('./projects.js').transformProjects;

beforeEach(async () => {
  await truncateAll();
  vi.resetModules();
  ({ transformProjects } = await import('./projects.js'));
});

async function makeMappedClient(togglClientId: string, name = 'Acme') {
  const [c] = await db.insert(clients).values({ name }).returning();
  await upsertMapping('toggl', 'clients', togglClientId, 'clients', c!.id);
  return c!;
}

const seedProject = (externalId: string, raw: Record<string, unknown>) =>
  db.insert(stgTogglProjects).values({ externalId, rawData: raw });

const onlyProject = async () => {
  const [p] = await db.select().from(projects);
  return p!;
};

describe('transformProjects', () => {
  it('returns all-zero counts and creates nothing when staging is empty', async () => {
    expect(await transformProjects()).toEqual({ created: 0, updated: 0, skipped: 0 });
    expect(await db.select().from(projects)).toHaveLength(0);
  });

  it('creates a project under its mapped client and records a mapping', async () => {
    const c = await makeMappedClient('10');
    await seedProject('p1', { name: 'Website', color: '#ff0000', client_id: 10 });

    const counts = await transformProjects();
    expect(counts).toEqual({ created: 1, updated: 0, skipped: 0 });

    const p = await onlyProject();
    expect(p.name).toBe('Website');
    expect(p.color).toBe('#ff0000');
    expect(p.clientId).toBe(c.id);
    expect(await findTargetId('toggl', 'projects', 'p1')).toBe(p.id);
  });

  it('falls back to "Unknown Project" and the brand color when absent', async () => {
    await makeMappedClient('10');
    await seedProject('p1', { client_id: 10 });

    await transformProjects();
    const p = await onlyProject();
    expect(p.name).toBe('Unknown Project');
    expect(p.color).toBe('#00D4AA');
  });

  it('falls back to the cid field when client_id is absent', async () => {
    const c = await makeMappedClient('10');
    await seedProject('p1', { name: 'X', cid: 10 });

    await transformProjects();
    expect((await onlyProject()).clientId).toBe(c.id);
  });

  it('routes a project with no client to a default "Unassigned" client', async () => {
    await seedProject('p1', { name: 'Orphan' }); // no client_id/cid

    await transformProjects();

    const [unassigned] = await db.select().from(clients).where(eq(clients.name, 'Unassigned'));
    expect(unassigned).toBeDefined();
    expect((await onlyProject()).clientId).toBe(unassigned!.id);
  });

  it('routes a project with an unmapped client to "Unassigned"', async () => {
    await seedProject('p1', { name: 'Orphan', client_id: 999 }); // 999 has no mapping

    await transformProjects();
    const [unassigned] = await db.select().from(clients).where(eq(clients.name, 'Unassigned'));
    expect((await onlyProject()).clientId).toBe(unassigned!.id);
  });

  it('reuses an existing "Unassigned" client instead of creating a duplicate', async () => {
    await db.insert(clients).values({ name: 'Unassigned' });
    await seedProject('p1', { name: 'Orphan' });

    await transformProjects();
    expect(await db.select().from(clients).where(eq(clients.name, 'Unassigned'))).toHaveLength(1);
  });

  it('is idempotent: a second run updates in place, no duplicates', async () => {
    await makeMappedClient('10');
    await seedProject('p1', { name: 'Website', client_id: 10 });

    const first = await transformProjects();
    const second = await transformProjects();

    expect(first).toEqual({ created: 1, updated: 0, skipped: 0 });
    expect(second).toEqual({ created: 0, updated: 1, skipped: 0 });
    expect(await db.select().from(projects)).toHaveLength(1);
  });

  it('updates name, color and client on a changed staging row', async () => {
    const c1 = await makeMappedClient('10', 'Acme');
    const c2 = await makeMappedClient('20', 'Globex');
    await seedProject('p1', { name: 'Website', color: '#ff0000', client_id: 10 });
    await transformProjects();
    const before = await onlyProject();
    expect(before.clientId).toBe(c1.id);

    await db
      .update(stgTogglProjects)
      .set({ rawData: { name: 'Website v2', color: '#0000ff', client_id: 20 } })
      .where(eq(stgTogglProjects.externalId, 'p1'));
    await transformProjects();

    const after = await onlyProject();
    expect(after.id).toBe(before.id);
    expect(after.name).toBe('Website v2');
    expect(after.color).toBe('#0000ff');
    expect(after.clientId).toBe(c2.id);
  });

  it('creates a distinct project per distinct staging externalId', async () => {
    await makeMappedClient('10');
    await seedProject('p1', { name: 'A', client_id: 10 });
    await seedProject('p2', { name: 'B', client_id: 10 });

    const counts = await transformProjects();
    expect(counts).toEqual({ created: 2, updated: 0, skipped: 0 });
    expect(await db.select().from(projects)).toHaveLength(2);
  });
});
