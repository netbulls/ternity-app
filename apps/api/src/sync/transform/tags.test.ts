import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, truncateAll } from '../../../test/db.js';
import { stgTogglTags, tags, users } from '../../db/schema.js';
import { upsertMapping } from './mappings.js';
import { transformTags } from './tags.js';

// Characterization tests for the tags transform. Key quirk: it NEVER creates tags —
// Toggl tags are workspace-level, so per-user tag rows are created later by the
// time-entries transform. Here, an unmapped staging tag is *skipped*; only already-
// mapped tags are renamed. So `created` is always 0.

beforeEach(truncateAll);

async function makeMappedTag(externalId: string, name: string) {
  const [u] = await db.insert(users).values({ displayName: 'U', email: `${externalId}@x.io` }).returning();
  const [t] = await db.insert(tags).values({ name, userId: u!.id }).returning();
  await upsertMapping('toggl', 'tags', externalId, 'tags', t!.id);
  return t!;
}

const seedStagingTag = (externalId: string, raw: Record<string, unknown>) =>
  db.insert(stgTogglTags).values({ externalId, rawData: raw });

describe('transformTags', () => {
  it('returns all-zero counts when staging is empty', async () => {
    expect(await transformTags()).toEqual({ created: 0, updated: 0, skipped: 0 });
  });

  it('skips (does NOT create) a staging tag with no existing mapping', async () => {
    await seedStagingTag('10', { name: 'Billable' });

    const counts = await transformTags();
    expect(counts).toEqual({ created: 0, updated: 0, skipped: 1 });
    expect(await db.select().from(tags)).toHaveLength(0);
  });

  it('renames an already-mapped tag', async () => {
    const tag = await makeMappedTag('10', 'Old Name');
    await seedStagingTag('10', { name: 'New Name' });

    const counts = await transformTags();
    expect(counts).toEqual({ created: 0, updated: 1, skipped: 0 });

    const [updated] = await db.select().from(tags).where(eq(tags.id, tag.id));
    expect(updated!.name).toBe('New Name');
  });

  it('falls back to "Unknown Tag" when the staging row has no name', async () => {
    const tag = await makeMappedTag('10', 'Old Name');
    await seedStagingTag('10', { color: '#fff' });

    await transformTags();
    const [updated] = await db.select().from(tags).where(eq(tags.id, tag.id));
    expect(updated!.name).toBe('Unknown Tag');
  });

  it('updates mapped tags and skips unmapped ones in the same run', async () => {
    await makeMappedTag('10', 'Mapped');
    await seedStagingTag('10', { name: 'Mapped v2' });
    await seedStagingTag('20', { name: 'Unmapped' });

    expect(await transformTags()).toEqual({ created: 0, updated: 1, skipped: 1 });
    expect(await db.select().from(tags)).toHaveLength(1);
  });
});
