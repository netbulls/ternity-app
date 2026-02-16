import { FastifyInstance } from 'fastify';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  timeEntries,
  entryLabels,
  projects,
  clients,
  labels,
} from '../db/schema.js';
import type { CreateEntry, UpdateEntry, DayGroup, Entry } from '@ternity/shared';

/** Build a full entry response with project + labels joined */
async function buildEntryResponse(entryId: string): Promise<Entry | null> {
  const [entry] = await db
    .select()
    .from(timeEntries)
    .where(eq(timeEntries.id, entryId))
    .limit(1);

  if (!entry) return null;

  let projectName: string | null = null;
  let projectColor: string | null = null;
  let clientName: string | null = null;
  if (entry.projectId) {
    const [proj] = await db
      .select({
        name: projects.name,
        color: projects.color,
        clientName: clients.name,
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(eq(projects.id, entry.projectId))
      .limit(1);
    if (proj) {
      projectName = proj.name;
      projectColor = proj.color;
      clientName = proj.clientName;
    }
  }

  const entryLabelRows = await db
    .select({ id: labels.id, name: labels.name, color: labels.color })
    .from(entryLabels)
    .innerJoin(labels, eq(entryLabels.labelId, labels.id))
    .where(eq(entryLabels.entryId, entryId));

  return {
    id: entry.id,
    description: entry.description,
    projectId: entry.projectId,
    projectName,
    projectColor,
    clientName,
    labels: entryLabelRows,
    startedAt: entry.startedAt.toISOString(),
    stoppedAt: entry.stoppedAt?.toISOString() ?? null,
    durationSeconds: entry.durationSeconds,
    userId: entry.userId,
  };
}

export async function entriesRoutes(fastify: FastifyInstance) {
  /** GET /api/entries — list entries grouped by day */
  fastify.get('/api/entries', async (request) => {
    const userId = request.auth.userId;
    const query = request.query as { from?: string; to?: string };

    // Default: last 7 days
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - 6);
    const fromDate = query.from ?? defaultFrom.toISOString().slice(0, 10);
    const toDate = query.to ?? now.toISOString().slice(0, 10);

    // Query entries within date range, plus any currently running entry
    const fromTimestamp = new Date(`${fromDate}T00:00:00.000Z`);
    const toTimestamp = new Date(`${toDate}T23:59:59.999Z`);

    const rows = await db
      .select()
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.userId, userId),
          gte(timeEntries.startedAt, fromTimestamp),
          lte(timeEntries.startedAt, toTimestamp),
        ),
      )
      .orderBy(desc(timeEntries.createdAt));

    // Build full entries with project + labels
    const entries: Entry[] = [];
    for (const row of rows) {
      const entry = await buildEntryResponse(row.id);
      if (entry) entries.push(entry);
    }

    // Group by date
    const groups = new Map<string, { totalSeconds: number; entries: Entry[] }>();
    for (const entry of entries) {
      const date = entry.startedAt.slice(0, 10);
      if (!groups.has(date)) {
        groups.set(date, { totalSeconds: 0, entries: [] });
      }
      const group = groups.get(date)!;
      group.entries.push(entry);
      if (entry.durationSeconds != null) {
        group.totalSeconds += entry.durationSeconds;
      }
    }

    const dayGroups: DayGroup[] = Array.from(groups.entries()).map(
      ([date, { totalSeconds, entries: groupEntries }]) => ({
        date,
        totalSeconds,
        entries: groupEntries,
      }),
    );

    return dayGroups;
  });

  /** POST /api/entries — create a manual entry */
  fastify.post('/api/entries', async (request) => {
    const userId = request.auth.userId;
    const body = request.body as CreateEntry;

    const startedAt = new Date(body.startedAt);
    const stoppedAt = new Date(body.stoppedAt);
    const durationSeconds = Math.round(
      (stoppedAt.getTime() - startedAt.getTime()) / 1000,
    );

    const [created] = await db
      .insert(timeEntries)
      .values({
        userId,
        description: body.description ?? '',
        projectId: body.projectId ?? null,
        startedAt,
        stoppedAt,
        durationSeconds,
      })
      .returning();

    // Attach labels
    const labelIds = body.labelIds ?? [];
    if (created && labelIds.length > 0) {
      await db.insert(entryLabels).values(
        labelIds.map((labelId: string) => ({ entryId: created.id, labelId })),
      );
    }

    return buildEntryResponse(created!.id);
  });

  /** PATCH /api/entries/:id — update an entry */
  fastify.patch('/api/entries/:id', async (request, reply) => {
    const userId = request.auth.userId;
    const { id } = request.params as { id: string };
    const body = request.body as UpdateEntry;

    // Owner check
    const [existing] = await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, id))
      .limit(1);

    if (!existing) {
      return reply.code(404).send({ error: 'Entry not found' });
    }
    if (existing.userId !== userId) {
      return reply.code(403).send({ error: 'Not your entry' });
    }

    // Build update set
    const updateSet: Record<string, unknown> = {};
    if (body.description !== undefined) updateSet.description = body.description;
    if (body.projectId !== undefined) updateSet.projectId = body.projectId;
    if (body.startedAt !== undefined) updateSet.startedAt = new Date(body.startedAt);
    if (body.stoppedAt !== undefined) {
      updateSet.stoppedAt = body.stoppedAt ? new Date(body.stoppedAt) : null;
    }

    // Recompute duration if both timestamps are set
    const startedAt = body.startedAt
      ? new Date(body.startedAt)
      : existing.startedAt;
    const stoppedAt = body.stoppedAt !== undefined
      ? (body.stoppedAt ? new Date(body.stoppedAt) : null)
      : existing.stoppedAt;
    if (startedAt && stoppedAt) {
      updateSet.durationSeconds = Math.max(
        0,
        Math.round((stoppedAt.getTime() - startedAt.getTime()) / 1000),
      );
    } else if (stoppedAt === null) {
      updateSet.durationSeconds = null;
    }

    if (Object.keys(updateSet).length > 0) {
      await db
        .update(timeEntries)
        .set(updateSet)
        .where(eq(timeEntries.id, id));
    }

    // Update labels if provided
    if (body.labelIds !== undefined) {
      await db.delete(entryLabels).where(eq(entryLabels.entryId, id));
      if (body.labelIds.length > 0) {
        await db.insert(entryLabels).values(
          body.labelIds.map((labelId: string) => ({ entryId: id, labelId })),
        );
      }
    }

    return buildEntryResponse(id);
  });

  /** DELETE /api/entries/:id — delete an entry */
  fastify.delete('/api/entries/:id', async (request, reply) => {
    const userId = request.auth.userId;
    const { id } = request.params as { id: string };

    const [existing] = await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, id))
      .limit(1);

    if (!existing) {
      return reply.code(404).send({ error: 'Entry not found' });
    }
    if (existing.userId !== userId) {
      return reply.code(403).send({ error: 'Not your entry' });
    }

    // Delete labels first (FK constraint)
    await db.delete(entryLabels).where(eq(entryLabels.entryId, id));
    await db.delete(timeEntries).where(eq(timeEntries.id, id));

    return { success: true };
  });
}
