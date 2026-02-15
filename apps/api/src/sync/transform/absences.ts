import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { stgTtAbsences, leaveRequests, leaveTypes, clients, projects } from '../../db/schema.js';
import { log } from '../logger.js';
import { findTargetId, upsertMapping } from './mappings.js';

const TT_STATUS_MAP: Record<string, 'pending' | 'approved' | 'rejected' | 'cancelled'> = {
  Approved: 'approved',
  Pending: 'pending',
  Declined: 'rejected',
  Cancelled: 'cancelled',
  // Lowercase variants
  approved: 'approved',
  pending: 'pending',
  declined: 'rejected',
  cancelled: 'cancelled',
};

export async function transformAbsences() {
  const counts = { created: 0, updated: 0, skipped: 0 };
  const rows = await db.select().from(stgTtAbsences);
  const leaveProjectId = await getOrCreateLeaveProject();

  for (const row of rows) {
    const raw = row.rawData as Record<string, unknown>;
    const externalId = row.externalId;

    // Resolve user
    const ttUserId = raw.userId ?? raw.UserId ?? raw.user_id;
    if (!ttUserId) {
      counts.skipped++;
      continue;
    }
    const userId = await findTargetId('timetastic', 'users', String(ttUserId));
    if (!userId) {
      log.warn(`  Skipping absence ${externalId}: no user mapping for tt user ${ttUserId}`);
      counts.skipped++;
      continue;
    }

    // Resolve leave type
    const ttLeaveTypeId = raw.leaveTypeId ?? raw.LeaveTypeId ?? raw.leave_type_id;
    let leaveTypeId: string | null = null;
    if (ttLeaveTypeId) {
      leaveTypeId = await findTargetId('timetastic', 'leave_types', String(ttLeaveTypeId));
    }
    if (!leaveTypeId) {
      leaveTypeId = await getOrCreateDefaultLeaveType();
    }

    const startDate =
      (raw.startDate as string) ?? (raw.StartDate as string) ?? (raw.start_date as string);
    const endDate = (raw.endDate as string) ?? (raw.EndDate as string) ?? (raw.end_date as string);

    if (!startDate || !endDate) {
      counts.skipped++;
      continue;
    }

    // Normalize dates to YYYY-MM-DD
    const startStr = new Date(startDate).toISOString().split('T')[0]!;
    const endStr = new Date(endDate).toISOString().split('T')[0]!;

    const rawDays = raw.deductionDays ?? raw.DeductionDays ?? raw.duration;
    const daysCount = typeof rawDays === 'number' ? Math.max(1, Math.round(rawDays)) : 1;

    const statusRaw = (raw.status as string) ?? (raw.Status as string) ?? 'Pending';
    const status = TT_STATUS_MAP[statusRaw] ?? 'pending';
    const note = (raw.reason as string) ?? (raw.Reason as string) ?? null;

    const existingId = await findTargetId('timetastic', 'absences', externalId);

    if (existingId) {
      await db
        .update(leaveRequests)
        .set({
          userId,
          projectId: leaveProjectId,
          leaveTypeId,
          startDate: startStr,
          endDate: endStr,
          daysCount,
          status,
          note,
        })
        .where(eq(leaveRequests.id, existingId));
      counts.updated++;
    } else {
      const [created] = await db
        .insert(leaveRequests)
        .values({
          userId,
          projectId: leaveProjectId,
          leaveTypeId,
          startDate: startStr,
          endDate: endStr,
          daysCount,
          status,
          note,
        })
        .returning();
      await upsertMapping('timetastic', 'absences', externalId, 'leave_requests', created!.id);
      counts.created++;
    }
  }

  log.info(
    `Transform absences: ${counts.created} created, ${counts.updated} updated, ${counts.skipped} skipped`,
  );
  return counts;
}

let leaveProjectId: string | null = null;

async function getOrCreateLeaveProject(): Promise<string> {
  if (leaveProjectId) return leaveProjectId;

  // Find or create "Organization" client
  let [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.name, 'Organization'))
    .limit(1);
  if (!client) {
    [client] = await db.insert(clients).values({ name: 'Organization' }).returning();
  }

  // Find or create "Leave" project under Organization
  let [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.name, 'Leave'))
    .limit(1);
  if (!project) {
    [project] = await db
      .insert(projects)
      .values({ name: 'Leave', clientId: client!.id })
      .returning();
  }

  leaveProjectId = project!.id;
  return project!.id;
}

let defaultLeaveTypeId: string | null = null;

async function getOrCreateDefaultLeaveType(): Promise<string> {
  if (defaultLeaveTypeId) return defaultLeaveTypeId;

  const [existing] = await db
    .select()
    .from(leaveTypes)
    .where(eq(leaveTypes.name, 'Other'))
    .limit(1);
  if (existing) {
    defaultLeaveTypeId = existing.id;
    return existing.id;
  }

  const [created] = await db
    .insert(leaveTypes)
    .values({ name: 'Other', daysPerYear: 0, deducted: false })
    .returning();
  defaultLeaveTypeId = created!.id;
  return created!.id;
}
