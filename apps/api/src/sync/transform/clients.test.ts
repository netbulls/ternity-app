import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, truncateAll } from '../../../test/db.js';
import { clients, stgTogglClients } from '../../db/schema.js';
import { findTargetId } from './mappings.js';
import { transformClients } from './clients.js';

// Characterization tests for the clients staging→target transform. Establishes the
// idempotency pattern for transforms: re-running over the same staging data updates
// in place (via sync_mappings) rather than duplicating. Real Postgres via test harness.

beforeEach(truncateAll);

async function seedStagingClient(externalId: string, raw: Record<string, unknown>): Promise<void> {
  await db.insert(stgTogglClients).values({ externalId, rawData: raw });
}

describe('transformClients', () => {
  it('returns all-zero counts and creates nothing when staging is empty', async () => {
    const counts = await transformClients();
    expect(counts).toEqual({ created: 0, updated: 0, skipped: 0 });
    expect(await db.select().from(clients)).toHaveLength(0);
  });

  it('creates a client from staging and records a toggl→clients mapping', async () => {
    await seedStagingClient('100', { name: 'Acme' });

    const counts = await transformClients();
    expect(counts).toEqual({ created: 1, updated: 0, skipped: 0 });

    const rows = await db.select().from(clients);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe('Acme');

    // mapping points at the created client
    expect(await findTargetId('toggl', 'clients', '100')).toBe(rows[0]!.id);
  });

  it('falls back to "Unknown Client" when rawData has no name', async () => {
    await seedStagingClient('100', { color: '#fff' });

    await transformClients();

    const rows = await db.select().from(clients);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe('Unknown Client');
  });

  it('is idempotent: a second run over the same staging updates in place, no duplicates', async () => {
    await seedStagingClient('100', { name: 'Acme' });

    const first = await transformClients();
    const second = await transformClients();

    expect(first).toEqual({ created: 1, updated: 0, skipped: 0 });
    expect(second).toEqual({ created: 0, updated: 1, skipped: 0 });
    expect(await db.select().from(clients)).toHaveLength(1);
  });

  it('updates the existing client name when the staging name changes', async () => {
    await seedStagingClient('100', { name: 'Acme' });
    await transformClients();
    const [before] = await db.select().from(clients);

    // staging name changes for the same externalId
    await db
      .update(stgTogglClients)
      .set({ rawData: { name: 'Acme Corp' } })
      .where(eq(stgTogglClients.externalId, '100'));
    const counts = await transformClients();

    expect(counts).toEqual({ created: 0, updated: 1, skipped: 0 });
    const rows = await db.select().from(clients);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(before!.id); // same row, updated in place
    expect(rows[0]!.name).toBe('Acme Corp');
  });

  it('creates a distinct client per distinct staging externalId', async () => {
    await seedStagingClient('100', { name: 'Acme' });
    await seedStagingClient('200', { name: 'Globex' });

    const counts = await transformClients();
    expect(counts).toEqual({ created: 2, updated: 0, skipped: 0 });
    expect(await db.select().from(clients)).toHaveLength(2);
  });
});
