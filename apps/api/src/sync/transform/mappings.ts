import { and, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { syncMappings } from '../../db/schema.js';

type SyncSource = 'toggl' | 'timetastic';

export async function findMapping(source: SyncSource, entity: string, externalId: string) {
  const [row] = await db
    .select()
    .from(syncMappings)
    .where(
      and(
        eq(syncMappings.source, source),
        eq(syncMappings.entity, entity),
        eq(syncMappings.externalId, externalId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function findTargetId(
  source: SyncSource,
  entity: string,
  externalId: string,
): Promise<string | null> {
  const mapping = await findMapping(source, entity, externalId);
  return mapping?.targetId ?? null;
}

export async function upsertMapping(
  source: SyncSource,
  entity: string,
  externalId: string,
  targetTable: string,
  targetId: string,
) {
  const existing = await findMapping(source, entity, externalId);
  if (existing) {
    await db
      .update(syncMappings)
      .set({ targetTable, targetId, updatedAt: new Date() })
      .where(eq(syncMappings.id, existing.id));
    return existing.id;
  }

  const [row] = await db
    .insert(syncMappings)
    .values({ source, entity, externalId, targetTable, targetId })
    .returning({ id: syncMappings.id });
  return row!.id;
}
