import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users, stgTogglUsers, stgTtUsers, stgTtAbsences } from '../../db/schema.js';
import { log } from '../logger.js';
import { upsertMapping } from './mappings.js';

/** Emails to skip during user matching (known bad data in external systems) */
const IGNORED_EMAILS = new Set([
  'bartosz.klak@netbulls.lio', // Typo in Toggl — real user is bartosz.klak@netbulls.io
]);

/** TT user names to skip (test accounts) */
const IGNORED_TT_NAMES = new Set(['Test User', 'Tester Tester']);

/** Strip Polish diacritics to ASCII */
function stripDiacritics(s: string): string {
  const map: Record<string, string> = {
    ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
    Ą: 'A', Ć: 'C', Ę: 'E', Ł: 'L', Ń: 'N', Ó: 'O', Ś: 'S', Ź: 'Z', Ż: 'Z',
  };
  return s.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (ch) => map[ch] ?? ch);
}

/** Build email from TT display name: "Artur Adam Dzadz" → "artur.dzadz" (drop middle names) */
function nameToLocalPart(name: string): string {
  const parts = stripDiacritics(name).toLowerCase().split(/\s+/);
  if (parts.length < 2) return parts[0] ?? '';
  return `${parts[0]}.${parts[parts.length - 1]}`;
}

/** Email domains to try when matching TT names to users */
const EMAIL_DOMAINS = ['netbulls.io', 'yosensi.io'];

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
    if (IGNORED_EMAILS.has(email)) {
      log.info(`  Skipping ignored email: ${email}`);
      continue;
    }

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

  // ── Phase 2: Name-based matching for TT users found in absences ──────────
  // The TT /users API only returns active users. Absences reference all users
  // including deactivated ones. Match them by building email from name.

  const matchedTtIds = new Set<string>();
  for (const m of report.matched) {
    if (m.timetasticId) matchedTtIds.add(m.timetasticId);
  }
  // Also collect already-mapped TT IDs from the users table
  const existingTtUsers = await db.select({ timetasticId: users.timetasticId }).from(users);
  for (const u of existingTtUsers) {
    if (u.timetasticId) matchedTtIds.add(u.timetasticId);
  }

  // Extract unique (userId, userName) pairs from absences
  const absenceUsers = await db
    .selectDistinct({
      userId: sql<string>`raw_data->>'userId'`,
      userName: sql<string>`raw_data->>'userName'`,
    })
    .from(stgTtAbsences);

  let nameMatched = 0;
  let nameSkipped = 0;
  for (const { userId: ttUserId, userName } of absenceUsers) {
    if (!ttUserId || !userName) continue;
    if (matchedTtIds.has(ttUserId)) continue;
    if (IGNORED_TT_NAMES.has(userName)) continue;

    const localPart = nameToLocalPart(userName);
    if (!localPart || !localPart.includes('.')) {
      log.warn(`  Cannot build email from TT name "${userName}" (id ${ttUserId})`);
      nameSkipped++;
      continue;
    }

    // Try each domain until we find a match
    let found = false;
    for (const domain of EMAIL_DOMAINS) {
      const candidateEmail = `${localPart}@${domain}`;
      const [existing] = await db.select().from(users).where(eq(users.email, candidateEmail)).limit(1);
      if (existing) {
        if (apply && !existing.timetasticId) {
          await db
            .update(users)
            .set({ timetasticId: ttUserId, updatedAt: new Date() })
            .where(eq(users.id, existing.id));
          await upsertMapping('timetastic', 'users', ttUserId, 'users', existing.id);
          log.info(`  Name-matched TT "${userName}" (${ttUserId}) → ${candidateEmail}`);
        }
        matchedTtIds.add(ttUserId);
        nameMatched++;
        found = true;
        break;
      }
    }

    if (!found) {
      log.warn(`  No user found for TT "${userName}" (${ttUserId}) — tried ${localPart}@{${EMAIL_DOMAINS.join(',')}}`);
      nameSkipped++;
    }
  }

  if (nameMatched > 0 || nameSkipped > 0) {
    log.info(`  Name-based TT matching: ${nameMatched} matched, ${nameSkipped} unmatched`);
  }

  return report;
}
