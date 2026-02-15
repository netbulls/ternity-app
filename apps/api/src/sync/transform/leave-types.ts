import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { stgTtLeaveTypes, leaveTypes } from '../../db/schema.js';
import { log } from '../logger.js';
import { findTargetId, upsertMapping } from './mappings.js';

export async function transformLeaveTypes() {
  const counts = { created: 0, updated: 0, skipped: 0 };
  const rows = await db.select().from(stgTtLeaveTypes);

  for (const row of rows) {
    const raw = row.rawData as Record<string, unknown>;
    const externalId = row.externalId;
    const name = (raw.name as string) ?? (raw.Name as string) ?? 'Unknown Leave Type';
    const color = (raw.color as string) ?? (raw.Color as string) ?? null;
    const deducted = raw.deducted ?? raw.Deducted ?? true;
    const daysPerYear =
      typeof (raw.allowance ?? raw.Allowance) === 'number'
        ? (raw.allowance as number) ?? (raw.Allowance as number)
        : 0;

    const existingId = await findTargetId('timetastic', 'leave_types', externalId);

    if (existingId) {
      await db
        .update(leaveTypes)
        .set({ name, color, deducted: Boolean(deducted), daysPerYear })
        .where(eq(leaveTypes.id, existingId));
      counts.updated++;
    } else {
      const [created] = await db
        .insert(leaveTypes)
        .values({ name, daysPerYear, color, deducted: Boolean(deducted) })
        .returning();
      await upsertMapping('timetastic', 'leave_types', externalId, 'leave_types', created!.id);
      counts.created++;
    }
  }

  log.info(`Transform leave_types: ${counts.created} created, ${counts.updated} updated, ${counts.skipped} skipped`);
  return counts;
}
