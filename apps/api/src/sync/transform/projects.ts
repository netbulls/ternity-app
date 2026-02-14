import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { stgTogglProjects, projects } from '../../db/schema.js';
import { log } from '../logger.js';
import { findTargetId, upsertMapping } from './mappings.js';

export async function transformProjects() {
  const counts = { created: 0, updated: 0, skipped: 0 };
  const rows = await db.select().from(stgTogglProjects);

  for (const row of rows) {
    const raw = row.rawData as Record<string, unknown>;
    const externalId = row.externalId;
    const name = (raw.name as string) ?? 'Unknown Project';
    const color = (raw.color as string) ?? '#00D4AA';
    const togglClientId = raw.client_id ?? raw.cid;

    // Resolve client_id via mappings
    let clientId: string | null = null;
    if (togglClientId) {
      clientId = await findTargetId('toggl', 'clients', String(togglClientId));
    }

    if (!clientId) {
      // Create or find a default "Unassigned" client
      clientId = await getOrCreateDefaultClient();
    }

    const existingId = await findTargetId('toggl', 'projects', externalId);

    if (existingId) {
      await db
        .update(projects)
        .set({ name, color, clientId })
        .where(eq(projects.id, existingId));
      counts.updated++;
    } else {
      const [created] = await db
        .insert(projects)
        .values({ name, color, clientId })
        .returning();
      await upsertMapping('toggl', 'projects', externalId, 'projects', created!.id);
      counts.created++;
    }
  }

  log.info(`Transform projects: ${counts.created} created, ${counts.updated} updated, ${counts.skipped} skipped`);
  return counts;
}

let defaultClientId: string | null = null;

async function getOrCreateDefaultClient(): Promise<string> {
  if (defaultClientId) return defaultClientId;

  const { clients } = await import('../../db/schema.js');
  const [existing] = await db
    .select()
    .from(clients)
    .where(eq(clients.name, 'Unassigned'))
    .limit(1);

  if (existing) {
    defaultClientId = existing.id;
    return existing.id;
  }

  const [created] = await db.insert(clients).values({ name: 'Unassigned' }).returning();
  defaultClientId = created!.id;
  return created!.id;
}
