import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  stgTogglTimeEntries,
  stgTogglTags,
  timeEntries,
  entryLabels,
  labels,
} from '../../db/schema.js';
import { log } from '../logger.js';
import { findTargetId, upsertMapping } from './mappings.js';

export async function transformTimeEntries() {
  const counts = { created: 0, updated: 0, skipped: 0 };
  const rows = await db.select().from(stgTogglTimeEntries);

  // Pre-load label name→id map for tag resolution
  const allLabels = await db.select().from(labels);
  const labelByName = new Map(allLabels.map((l) => [l.name.toLowerCase(), l.id]));

  // Pre-load toggl tag_id → tag name map (for resolving tag_ids in flattened entries)
  const tagRows = await db.select().from(stgTogglTags);
  const tagIdToName = new Map<string, string>();
  for (const t of tagRows) {
    const tagRaw = t.rawData as Record<string, unknown>;
    const name = (tagRaw.name as string) ?? '';
    tagIdToName.set(t.externalId, name);
  }

  for (const row of rows) {
    const raw = row.rawData as Record<string, unknown>;
    const externalId = row.externalId;

    // Resolve user
    const togglUserId = raw.user_id ?? raw.uid;
    if (!togglUserId) {
      counts.skipped++;
      continue;
    }
    const userId = await findTargetId('toggl', 'users', String(togglUserId));
    if (!userId) {
      log.warn(`  Skipping time entry ${externalId}: no user mapping for toggl user ${togglUserId}`);
      counts.skipped++;
      continue;
    }

    // Resolve project
    const togglProjectId = raw.project_id ?? raw.pid;
    let projectId: string | null = null;
    if (togglProjectId) {
      projectId = await findTargetId('toggl', 'projects', String(togglProjectId));
    }
    if (!projectId) {
      projectId = await getOrCreateNoProjectId();
    }

    const description = (raw.description as string) ?? '';
    const startedAt = raw.start ? new Date(raw.start as string) : new Date();
    const stoppedAt = raw.stop ? new Date(raw.stop as string) : null;
    // Flattened entries use 'seconds', original format used 'duration'
    const rawDuration = raw.seconds ?? raw.duration;
    const durationSeconds =
      typeof rawDuration === 'number' && rawDuration > 0 ? rawDuration : null;

    const existingId = await findTargetId('toggl', 'time_entries', externalId);

    // Resolve tag_ids (numeric) to tag names for label matching
    const tagIds = raw.tag_ids as number[] | undefined;
    const tagNames = tagIds
      ?.map((id) => tagIdToName.get(String(id)))
      .filter((n): n is string => !!n);

    if (existingId) {
      await db
        .update(timeEntries)
        .set({ userId, projectId, description, startedAt, stoppedAt, durationSeconds })
        .where(eq(timeEntries.id, existingId));
      await syncEntryLabels(existingId, tagNames, labelByName);
      counts.updated++;
    } else {
      const [created] = await db
        .insert(timeEntries)
        .values({ userId, projectId, description, startedAt, stoppedAt, durationSeconds })
        .returning();
      await upsertMapping('toggl', 'time_entries', externalId, 'time_entries', created!.id);
      await syncEntryLabels(created!.id, tagNames, labelByName);
      counts.created++;
    }
  }

  log.info(
    `Transform time_entries: ${counts.created} created, ${counts.updated} updated, ${counts.skipped} skipped`,
  );
  return counts;
}

async function syncEntryLabels(
  entryId: string,
  tags: string[] | undefined,
  labelByName: Map<string, string>,
) {
  // Clear existing labels for this entry
  await db.delete(entryLabels).where(eq(entryLabels.entryId, entryId));

  if (!tags || tags.length === 0) return;

  const values: { entryId: string; labelId: string }[] = [];
  for (const tag of tags) {
    const labelId = labelByName.get(tag.toLowerCase());
    if (labelId) {
      values.push({ entryId, labelId });
    }
  }

  if (values.length > 0) {
    await db.insert(entryLabels).values(values);
  }
}

let noProjectId: string | null = null;

async function getOrCreateNoProjectId(): Promise<string> {
  if (noProjectId) return noProjectId;

  const { projects, clients } = await import('../../db/schema.js');

  // Find or create "Unassigned" client
  let [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.name, 'Unassigned'))
    .limit(1);
  if (!client) {
    [client] = await db.insert(clients).values({ name: 'Unassigned' }).returning();
  }

  // Find or create "No Project" project
  let [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.name, 'No Project'))
    .limit(1);
  if (!project) {
    [project] = await db
      .insert(projects)
      .values({ name: 'No Project', clientId: client!.id })
      .returning();
  }

  noProjectId = project!.id;
  return project!.id;
}
