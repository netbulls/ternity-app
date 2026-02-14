import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { stgTogglTags, labels } from '../../db/schema.js';
import { log } from '../logger.js';
import { findTargetId, upsertMapping } from './mappings.js';

export async function transformLabels() {
  const counts = { created: 0, updated: 0, skipped: 0 };
  const rows = await db.select().from(stgTogglTags);

  for (const row of rows) {
    const raw = row.rawData as Record<string, unknown>;
    const externalId = row.externalId;
    const name = (raw.name as string) ?? 'Unknown Tag';

    const existingId = await findTargetId('toggl', 'tags', externalId);

    if (existingId) {
      await db.update(labels).set({ name }).where(eq(labels.id, existingId));
      counts.updated++;
    } else {
      const [created] = await db.insert(labels).values({ name }).returning();
      await upsertMapping('toggl', 'tags', externalId, 'labels', created!.id);
      counts.created++;
    }
  }

  log.info(`Transform labels: ${counts.created} created, ${counts.updated} updated, ${counts.skipped} skipped`);
  return counts;
}
