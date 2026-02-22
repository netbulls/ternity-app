import { FastifyInstance } from 'fastify';
import { eq, and, gte, lte, desc, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  timeEntries,
  entryLabels,
  entrySegments,
  entryAuditLog,
  labels,
  users,
  projects,
  clients,
} from '../db/schema.js';
import { recordAudit, resolveProjectName } from '../lib/audit.js';
import { buildEntryResponse } from './timer.js';
import type { CreateEntry, UpdateEntry, AdjustEntry, DayGroup, Entry } from '@ternity/shared';

/** Get the actor ID — the real user behind the action (handles impersonation) */
function getActorId(request: { auth: { realUserId?: string; userId: string } }): string {
  return request.auth.realUserId ?? request.auth.userId;
}

/** Get audit source from X-Audit-Source header, defaulting to 'api' */
function getAuditSource(request: { headers: Record<string, string | string[] | undefined> }): string {
  return (request.headers['x-audit-source'] as string) ?? 'api';
}

export async function entriesRoutes(fastify: FastifyInstance) {
  /** GET /api/entries — list entries grouped by day (batch-loaded) */
  fastify.get('/api/entries', async (request) => {
    const userId = request.auth.userId;
    const query = request.query as { from?: string; to?: string };

    // Default: last 7 days
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - 6);
    const fromDate = query.from ?? defaultFrom.toISOString().slice(0, 10);
    const toDate = query.to ?? now.toISOString().slice(0, 10);

    const fromTimestamp = new Date(`${fromDate}T00:00:00.000Z`);
    const toTimestamp = new Date(`${toDate}T23:59:59.999Z`);

    // 1. Fetch all entries for the date range
    const rows = await db
      .select()
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.userId, userId),
          gte(timeEntries.createdAt, fromTimestamp),
          lte(timeEntries.createdAt, toTimestamp),
        ),
      )
      .orderBy(desc(timeEntries.createdAt));

    if (rows.length === 0) return [];

    const entryIds = rows.map((r) => r.id);

    // 2. Batch-load segments, labels, and projects in parallel
    const [allSegments, allLabelRows, allProjectRows] = await Promise.all([
      db
        .select()
        .from(entrySegments)
        .where(inArray(entrySegments.entryId, entryIds))
        .orderBy(entrySegments.createdAt),
      db
        .select({
          entryId: entryLabels.entryId,
          id: labels.id,
          name: labels.name,
          color: labels.color,
        })
        .from(entryLabels)
        .innerJoin(labels, eq(entryLabels.labelId, labels.id))
        .where(inArray(entryLabels.entryId, entryIds)),
      (() => {
        const projectIds = [...new Set(rows.map((r) => r.projectId).filter(Boolean))] as string[];
        if (projectIds.length === 0) return Promise.resolve([]);
        return db
          .select({
            id: projects.id,
            name: projects.name,
            color: projects.color,
            clientName: clients.name,
          })
          .from(projects)
          .leftJoin(clients, eq(projects.clientId, clients.id))
          .where(inArray(projects.id, projectIds));
      })(),
    ]);

    // 3. Index by entryId / projectId for O(1) lookup
    const segmentsByEntry = new Map<string, typeof allSegments>();
    for (const seg of allSegments) {
      let arr = segmentsByEntry.get(seg.entryId);
      if (!arr) { arr = []; segmentsByEntry.set(seg.entryId, arr); }
      arr.push(seg);
    }

    const labelsByEntry = new Map<string, { id: string; name: string; color: string | null }[]>();
    for (const row of allLabelRows) {
      let arr = labelsByEntry.get(row.entryId);
      if (!arr) { arr = []; labelsByEntry.set(row.entryId, arr); }
      arr.push({ id: row.id, name: row.name, color: row.color });
    }

    const projectMap = new Map<string, { name: string; color: string | null; clientName: string | null }>();
    for (const p of allProjectRows) {
      projectMap.set(p.id, { name: p.name, color: p.color, clientName: p.clientName });
    }

    // 4. Assemble entries
    const entries: Entry[] = rows.map((row) => {
      const segments = segmentsByEntry.get(row.id) ?? [];
      const proj = row.projectId ? projectMap.get(row.projectId) ?? null : null;

      const totalDurationSeconds = segments.reduce(
        (sum, s) => sum + (s.durationSeconds ?? 0),
        0,
      );
      const isRunning = segments.some(
        (s) => s.type === 'clocked' && s.stoppedAt === null,
      );

      return {
        id: row.id,
        description: row.description,
        projectId: row.projectId,
        projectName: proj?.name ?? null,
        projectColor: proj?.color ?? null,
        clientName: proj?.clientName ?? null,
        labels: labelsByEntry.get(row.id) ?? [],
        segments: segments.map((s) => ({
          id: s.id,
          type: s.type,
          startedAt: s.startedAt?.toISOString() ?? null,
          stoppedAt: s.stoppedAt?.toISOString() ?? null,
          durationSeconds: s.durationSeconds,
          note: s.note,
          createdAt: s.createdAt.toISOString(),
        })),
        totalDurationSeconds,
        isRunning,
        createdAt: row.createdAt.toISOString(),
        userId: row.userId,
      };
    });

    // 5. Group by createdAt date
    const groups = new Map<string, { totalSeconds: number; entries: Entry[] }>();
    for (const entry of entries) {
      const date = entry.createdAt.slice(0, 10);
      if (!groups.has(date)) {
        groups.set(date, { totalSeconds: 0, entries: [] });
      }
      const group = groups.get(date)!;
      group.entries.push(entry);
      group.totalSeconds += entry.totalDurationSeconds;
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
    const actorId = getActorId(request);
    const source = getAuditSource(request);
    const body = request.body as CreateEntry;

    const startedAt = new Date(body.startedAt);
    const stoppedAt = new Date(body.stoppedAt);
    const durationSeconds = Math.round(
      (stoppedAt.getTime() - startedAt.getTime()) / 1000,
    );

    const result = await db.transaction(async (tx) => {
      // Insert entry (metadata only)
      const [created] = await tx
        .insert(timeEntries)
        .values({
          userId,
          description: body.description ?? '',
          projectId: body.projectId ?? null,
        })
        .returning();

      // Insert one manual segment (user-entered time, not timer-tracked)
      await tx.insert(entrySegments).values({
        entryId: created!.id,
        type: 'manual',
        startedAt,
        stoppedAt,
        durationSeconds,
        note: body.note.trim(),
      });

      // Attach labels
      const labelIds = body.labelIds ?? [];
      if (labelIds.length > 0) {
        await tx.insert(entryLabels).values(
          labelIds.map((labelId: string) => ({ entryId: created!.id, labelId })),
        );
      }

      // Record audit
      const newProjectName = await resolveProjectName(body.projectId, tx);
      await recordAudit({
        entryId: created!.id,
        userId,
        actorId,
        action: 'created',
        changes: {
          description: { new: body.description ?? '' },
          project: { new: newProjectName },
          startedAt: { new: startedAt.toISOString() },
          stoppedAt: { new: stoppedAt.toISOString() },
          durationSeconds: { new: durationSeconds },
        },
        metadata: { source },
        tx,
      });

      return buildEntryResponse(created!.id, tx);
    });

    return result;
  });

  /** PATCH /api/entries/:id — update entry metadata */
  fastify.patch('/api/entries/:id', async (request, reply) => {
    const userId = request.auth.userId;
    const actorId = getActorId(request);
    const source = getAuditSource(request);
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

    const result = await db.transaction(async (tx) => {
      // Build update set (metadata only — no time fields)
      const updateSet: Record<string, unknown> = {};
      if (body.description !== undefined) updateSet.description = body.description;
      if (body.projectId !== undefined) updateSet.projectId = body.projectId;

      if (Object.keys(updateSet).length > 0) {
        await tx
          .update(timeEntries)
          .set(updateSet)
          .where(eq(timeEntries.id, id));
      }

      // Update labels if provided
      if (body.labelIds !== undefined) {
        await tx.delete(entryLabels).where(eq(entryLabels.entryId, id));
        if (body.labelIds.length > 0) {
          await tx.insert(entryLabels).values(
            body.labelIds.map((labelId: string) => ({ entryId: id, labelId })),
          );
        }
      }

      // Record audit — only changed fields
      const changes: Record<string, { old?: unknown; new?: unknown }> = {};
      if (body.description !== undefined && body.description !== existing.description) {
        changes.description = { old: existing.description, new: body.description };
      }
      if (body.projectId !== undefined && body.projectId !== existing.projectId) {
        const [oldName, newName] = await Promise.all([
          resolveProjectName(existing.projectId, tx),
          resolveProjectName(body.projectId, tx),
        ]);
        changes.project = { old: oldName, new: newName };
      }
      if (body.labelIds !== undefined) {
        const oldLabelRows = await tx
          .select({ id: labels.id })
          .from(entryLabels)
          .innerJoin(labels, eq(entryLabels.labelId, labels.id))
          .where(eq(entryLabels.entryId, id));
        const oldIds = oldLabelRows.map((r) => r.id).sort();
        const newIds = [...body.labelIds].sort();
        if (JSON.stringify(oldIds) !== JSON.stringify(newIds)) {
          changes.labelIds = { old: oldIds, new: newIds };
        }
      }

      if (Object.keys(changes).length > 0) {
        await recordAudit({
          entryId: id,
          userId: existing.userId,
          actorId,
          action: 'updated',
          changes,
          metadata: { source },
          tx,
        });
      }

      return buildEntryResponse(id, tx);
    });

    return result;
  });

  /** DELETE /api/entries/:id — delete an entry */
  fastify.delete('/api/entries/:id', async (request, reply) => {
    const userId = request.auth.userId;
    const actorId = getActorId(request);
    const source = getAuditSource(request);
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

    await db.transaction(async (tx) => {
      // Record audit before deletion
      const deletedProjectName = await resolveProjectName(existing.projectId, tx);
      await recordAudit({
        entryId: id,
        userId: existing.userId,
        actorId,
        action: 'deleted',
        changes: {
          description: { old: existing.description },
          project: { old: deletedProjectName },
        },
        metadata: { source },
        tx,
      });

      // Delete labels first (FK constraint), then entry (segments cascade via FK)
      await tx.delete(entryLabels).where(eq(entryLabels.entryId, id));
      await tx.delete(timeEntries).where(eq(timeEntries.id, id));
    });

    return { success: true };
  });

  /** POST /api/entries/:id/adjust — add a manual adjustment segment */
  fastify.post('/api/entries/:id/adjust', async (request, reply) => {
    const userId = request.auth.userId;
    const actorId = getActorId(request);
    const { id } = request.params as { id: string };
    const body = request.body as AdjustEntry;

    if (!body.note || body.note.trim().length === 0) {
      return reply.code(400).send({ error: 'Note is required for adjustments' });
    }

    // Verify ownership
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

    const result = await db.transaction(async (tx) => {
      // Insert manual segment
      await tx.insert(entrySegments).values({
        entryId: id,
        type: 'manual',
        durationSeconds: body.durationSeconds,
        note: body.note.trim(),
      });

      // Audit
      await recordAudit({
        entryId: id,
        userId: existing.userId,
        actorId,
        action: 'adjustment_added',
        changes: {
          durationSeconds: { new: body.durationSeconds },
          note: { new: body.note.trim() },
        },
        metadata: { source: 'api' },
        tx,
      });

      return buildEntryResponse(id, tx);
    });

    return result;
  });

  /** GET /api/entries/:id/audit — get audit trail for an entry */
  fastify.get('/api/entries/:id/audit', async (request, reply) => {
    const userId = request.auth.userId;
    const { id } = request.params as { id: string };

    // Verify ownership
    const [entry] = await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, id))
      .limit(1);

    if (!entry) {
      return reply.code(404).send({ error: 'Entry not found' });
    }
    if (entry.userId !== userId && request.auth.globalRole !== 'admin') {
      return reply.code(403).send({ error: 'Not your entry' });
    }

    const rows = await db
      .select({
        id: entryAuditLog.id,
        entryId: entryAuditLog.entryId,
        action: entryAuditLog.action,
        actorId: entryAuditLog.actorId,
        actorName: users.displayName,
        changes: entryAuditLog.changes,
        metadata: entryAuditLog.metadata,
        createdAt: entryAuditLog.createdAt,
      })
      .from(entryAuditLog)
      .innerJoin(users, eq(entryAuditLog.actorId, users.id))
      .where(eq(entryAuditLog.entryId, id))
      .orderBy(desc(entryAuditLog.createdAt));

    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    }));
  });
}
