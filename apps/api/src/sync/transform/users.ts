import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users, stgTogglUsers, stgTtUsers } from '../../db/schema.js';
import { log } from '../logger.js';
import { upsertMapping } from './mappings.js';

interface MatchReport {
  matched: { email: string; userId: string; togglId?: string; timetasticId?: string }[];
  created: { email: string; userId: string; source: string }[];
  unmatched: { email: string; source: string }[];
}

export async function matchUsers(apply: boolean): Promise<MatchReport> {
  const report: MatchReport = { matched: [], created: [], unmatched: [] };

  // Build email map from staging tables
  const emailMap = new Map<
    string,
    { togglData?: Record<string, unknown>; timetasticData?: Record<string, unknown> }
  >();

  const togglRows = await db.select().from(stgTogglUsers);
  for (const row of togglRows) {
    const raw = row.rawData as Record<string, unknown>;
    const email = (raw.email as string)?.toLowerCase();
    if (!email) continue;
    const entry = emailMap.get(email) ?? {};
    entry.togglData = raw;
    emailMap.set(email, entry);
  }

  const ttRows = await db.select().from(stgTtUsers);
  for (const row of ttRows) {
    const raw = row.rawData as Record<string, unknown>;
    const email = (raw.email as string)?.toLowerCase() ?? (raw.Email as string)?.toLowerCase();
    if (!email) continue;
    const entry = emailMap.get(email) ?? {};
    entry.timetasticData = raw;
    emailMap.set(email, entry);
  }

  for (const [email, sources] of emailMap) {
    // Use user_id (Toggl account ID) — this is what the Reports API uses in time entries.
    // The top-level `id` is the organization-level ID, which is different.
    const togglId = sources.togglData
      ? String(sources.togglData.user_id ?? sources.togglData.id ?? sources.togglData.Id)
      : undefined;
    const timetasticId = sources.timetasticData
      ? String(sources.timetasticData.id ?? sources.timetasticData.Id)
      : undefined;

    // Try to find existing Ternity user by email
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (existing) {
      if (apply) {
        await db
          .update(users)
          .set({
            ...(togglId && !existing.togglId ? { togglId } : {}),
            ...(timetasticId && !existing.timetasticId ? { timetasticId } : {}),
            updatedAt: new Date(),
          })
          .where(eq(users.id, existing.id));

        if (togglId) {
          await upsertMapping('toggl', 'users', togglId, 'users', existing.id);
        }
        if (timetasticId) {
          await upsertMapping('timetastic', 'users', timetasticId, 'users', existing.id);
        }
      }
      report.matched.push({ email, userId: existing.id, togglId, timetasticId });
    } else if (apply) {
      // Derive display name from email: firstname.lastname@domain → "Firstname Lastname"
      const localPart = email.split('@')[0]!;
      const displayName = localPart.includes('.')
        ? localPart.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
        : localPart;

      const [created] = await db
        .insert(users)
        .values({
          displayName,
          email,
          ...(togglId ? { togglId } : {}),
          ...(timetasticId ? { timetasticId } : {}),
        })
        .returning();

      if (togglId) {
        await upsertMapping('toggl', 'users', togglId, 'users', created!.id);
      }
      if (timetasticId) {
        await upsertMapping('timetastic', 'users', timetasticId, 'users', created!.id);
      }
      report.created.push({
        email,
        userId: created!.id,
        source: [togglId ? 'toggl' : '', timetasticId ? 'timetastic' : ''].filter(Boolean).join('+'),
      });
    } else {
      report.unmatched.push({
        email,
        source: [sources.togglData ? 'toggl' : '', sources.timetasticData ? 'timetastic' : '']
          .filter(Boolean)
          .join('+'),
      });
    }
  }

  return report;
}
