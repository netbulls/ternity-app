import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { stgTogglTags, tags } from '../../db/schema.js';
import { log } from '../logger.js';
import { findTargetId, upsertMapping } from './mappings.js';

export async function transformTags() {
  const counts = { created: 0, updated: 0, skipped: 0 };
  const rows = await db.select().from(stgTogglTags);

  for (const row of rows) {
    const raw = row.rawData as Record<string, unknown>;
    const externalId = row.externalId;
    const name = (raw.name as string) ?? 'Unknown Tag';

    const existingId = await findTargetId('toggl', 'tags', externalId);

    if (existingId) {
      await db.update(tags).set({ name }).where(eq(tags.id, existingId));
      counts.updated++;
    } else {
      // Tags from Toggl are workspace-level — user_id is assigned later
      // by the time-entries transform when it creates per-user tag copies.
      // For now, skip creation here; the time-entries transform handles it.
      counts.skipped++;
    }
  }

  log.info(
    `Transform tags: ${counts.created} created, ${counts.updated} updated, ${counts.skipped} skipped`,
  );
  return counts;
}
