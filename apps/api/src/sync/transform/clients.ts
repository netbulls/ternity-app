import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { stgTogglClients, clients } from '../../db/schema.js';
import { log } from '../logger.js';
import { findTargetId, upsertMapping } from './mappings.js';

export async function transformClients() {
  const counts = { created: 0, updated: 0, skipped: 0 };
  const rows = await db.select().from(stgTogglClients);

  for (const row of rows) {
    const raw = row.rawData as Record<string, unknown>;
    const externalId = row.externalId;
    const name = (raw.name as string) ?? 'Unknown Client';

    const existingId = await findTargetId('toggl', 'clients', externalId);

    if (existingId) {
      await db.update(clients).set({ name }).where(eq(clients.id, existingId));
      counts.updated++;
    } else {
      const [created] = await db.insert(clients).values({ name }).returning();
      await upsertMapping('toggl', 'clients', externalId, 'clients', created!.id);
      counts.created++;
    }
  }

  log.info(`Transform clients: ${counts.created} created, ${counts.updated} updated, ${counts.skipped} skipped`);
  return counts;
}
