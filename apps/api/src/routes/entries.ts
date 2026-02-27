import { FastifyInstance } from 'fastify';
import { eq, and, gte, lte, desc, inArray, isNull, or, like, sql } from 'drizzle-orm';
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
  jiraConnections,
} from '../db/schema.js';
import { recordAudit, resolveProjectName } from '../lib/audit.js';
import { buildEntryResponse } from './timer.js';
import type {
  CreateEntry,
  UpdateEntry,
  AdjustEntry,
  MoveBlock,
  SplitEntry,
  DayGroup,
  Entry,
} from '@ternity/shared';

/** Format seconds into h:mm or h:mm:ss */
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Get the actor ID — the real user behind the action (handles impersonation) */
function getActorId(request: { auth: { realUserId?: string; userId: string } }): string {
  return request.auth.realUserId ?? request.auth.userId;
}

/** Get audit source from X-Audit-Source header, defaulting to 'api' */
function getAuditSource(request: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  return (request.headers['x-audit-source'] as string) ?? 'api';
}

/** Extract base name: "name (3)" → "name", "name" → "name" */
function baseName(description: string): string {
  const match = description.match(/^(.*?)\s*\(\d+\)$/);
  return match ? match[1]! : description;
}

/** Escape SQL LIKE special characters */
function escapeLike(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

/** Find the next available copy number by querying existing entries */
async function nextCopyName(
  description: string,
  userId: string,
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
): Promise<string> {
  const base = baseName(description);
  const prefix = base ? `${base} (` : '(';

  // Only fetch the base name + its "(N)" variants — not all user entries
  const siblings = await tx
    .select({ description: timeEntries.description })
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.userId, userId),
        eq(timeEntries.isActive, true),
        or(
          eq(timeEntries.description, base),
          like(timeEntries.description, `${escapeLike(base)} (%)`),
        ),
      ),
    );

  let maxN = 0;
  for (const s of siblings) {
    if (s.description === base) {
      maxN = Math.max(maxN, 0);
    }
    if (s.description.startsWith(prefix) && s.description.endsWith(')')) {
      const numStr = s.description.slice(prefix.length, -1);
      const n = parseInt(numStr, 10);
      if (!isNaN(n)) maxN = Math.max(maxN, n);
    }
  }

  return `${base} (${maxN + 1})`.trimStart();
}

export async function entriesRoutes(fastify: FastifyInstance) {
  /** GET /api/entries — list entries grouped by day (batch-loaded) */
  fastify.get('/api/entries', async (request) => {
    const userId = request.auth.userId;
    const query = request.query as { from?: string; to?: string; deleted?: string };

    // Default: last 7 days
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - 6);
    const fromDate = query.from ?? defaultFrom.toISOString().slice(0, 10);
    const toDate = query.to ?? now.toISOString().slice(0, 10);

    const fromTimestamp = new Date(`${fromDate}T00:00:00.000Z`);
    const toTimestamp = new Date(`${toDate}T23:59:59.999Z`);

    // deleted=true shows soft-deleted entries, default shows active only
    const showDeleted = query.deleted === 'true';

    // 1. Find entry IDs that have segments overlapping the date range,
    //    OR entries created in the range (fallback for entries without segments).
    //    For each entry, compute lastSegmentAt = most recent segment start time.
    const entryHits = await db
      .select({
        entryId: timeEntries.id,
        lastSegmentAt: sql<Date>`COALESCE(
          MAX(${entrySegments.startedAt}),
          MAX(${entrySegments.createdAt}),
          ${timeEntries.createdAt}
        )`.as('last_segment_at'),
      })
      .from(timeEntries)
      .leftJoin(entrySegments, eq(entrySegments.entryId, timeEntries.id))
      .where(
        and(
          eq(timeEntries.userId, userId),
          eq(timeEntries.isActive, !showDeleted),
          // Entry qualifies if any segment falls in range OR entry created in range
          or(
            and(
              gte(
                sql`COALESCE(${entrySegments.startedAt}, ${entrySegments.createdAt})`,
                fromTimestamp,
              ),
              lte(
                sql`COALESCE(${entrySegments.startedAt}, ${entrySegments.createdAt})`,
                toTimestamp,
              ),
            ),
            // Also catch entries with a currently running segment (no stoppedAt)
            // whose startedAt is before the range end
            and(
              isNull(entrySegments.stoppedAt),
              eq(entrySegments.type, 'clocked'),
              lte(sql`${entrySegments.startedAt}`, toTimestamp),
            ),
            // Fallback: entries created in range with no segments
            and(
              isNull(entrySegments.id),
              gte(timeEntries.createdAt, fromTimestamp),
              lte(timeEntries.createdAt, toTimestamp),
            ),
          ),
        ),
      )
      .groupBy(timeEntries.id)
      .orderBy(desc(sql`last_segment_at`));

    if (entryHits.length === 0) return [];

    const entryIds = entryHits.map((r) => r.entryId);
    const lastSegmentAtMap = new Map<string, Date>();
    for (const hit of entryHits) {
      lastSegmentAtMap.set(hit.entryId, hit.lastSegmentAt);
    }

    // 2. Fetch full entry rows
    const rows = await db.select().from(timeEntries).where(inArray(timeEntries.id, entryIds));

    // Index rows by id for lookup
    const rowMap = new Map(rows.map((r) => [r.id, r]));

    // 3. Batch-load segments, labels, projects, and jira connections in parallel
    const [allSegments, allLabelRows, allProjectRows, allJiraConnRows] = await Promise.all([
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
      (() => {
        const jiraConnIds = [
          ...new Set(rows.map((r) => r.jiraConnectionId).filter(Boolean)),
        ] as string[];
        if (jiraConnIds.length === 0) return Promise.resolve([]);
        return db
          .select({ id: jiraConnections.id, siteUrl: jiraConnections.siteUrl })
          .from(jiraConnections)
          .where(inArray(jiraConnections.id, jiraConnIds));
      })(),
    ]);

    // 4. Index by entryId / projectId for O(1) lookup
    const segmentsByEntry = new Map<string, typeof allSegments>();
    for (const seg of allSegments) {
      let arr = segmentsByEntry.get(seg.entryId);
      if (!arr) {
        arr = [];
        segmentsByEntry.set(seg.entryId, arr);
      }
      arr.push(seg);
    }

    const labelsByEntry = new Map<string, { id: string; name: string; color: string | null }[]>();
    for (const row of allLabelRows) {
      let arr = labelsByEntry.get(row.entryId);
      if (!arr) {
        arr = [];
        labelsByEntry.set(row.entryId, arr);
      }
      arr.push({ id: row.id, name: row.name, color: row.color });
    }

    const projectMap = new Map<
      string,
      { name: string; color: string | null; clientName: string | null }
    >();
    for (const p of allProjectRows) {
      projectMap.set(p.id, { name: p.name, color: p.color, clientName: p.clientName });
    }

    const jiraConnMap = new Map<string, string>();
    for (const jc of allJiraConnRows) {
      jiraConnMap.set(jc.id, jc.siteUrl);
    }

    // 5. Assemble entries in lastSegmentAt DESC order (preserved from entryHits)
    const entries: Entry[] = entryHits.map((hit) => {
      const row = rowMap.get(hit.entryId)!;
      const segments = segmentsByEntry.get(row.id) ?? [];
      const proj = row.projectId ? (projectMap.get(row.projectId) ?? null) : null;

      const totalDurationSeconds = segments.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0);
      const isRunning = segments.some((s) => s.type === 'clocked' && s.stoppedAt === null);

      return {
        id: row.id,
        description: row.description,
        projectId: row.projectId,
        projectName: proj?.name ?? null,
        projectColor: proj?.color ?? null,
        clientName: proj?.clientName ?? null,
        jiraIssue:
          row.jiraIssueKey && row.jiraConnectionId
            ? {
                key: row.jiraIssueKey,
                summary: row.jiraIssueSummary ?? '',
                connectionId: row.jiraConnectionId,
                siteUrl: jiraConnMap.get(row.jiraConnectionId) ?? '',
              }
            : null,
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
        isActive: row.isActive,
        createdAt: row.createdAt.toISOString(),
        lastSegmentAt:
          hit.lastSegmentAt instanceof Date
            ? hit.lastSegmentAt.toISOString()
            : String(hit.lastSegmentAt),
        userId: row.userId,
      };
    });

    // 6. Group by lastSegmentAt date (entries appear in the day of their most recent segment)
    const groups = new Map<string, { totalSeconds: number; entries: Entry[] }>();
    for (const entry of entries) {
      const date = entry.lastSegmentAt.slice(0, 10);
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

  /** GET /api/entries/recent — recent unique entries for command palette */
  fastify.get('/api/entries/recent', async (request) => {
    const userId = request.auth.userId;
    const limit = Math.min(Number((request.query as any).limit) || 10, 20);

    // Get the most recent entries, deduplicated by description (keep latest)
    const rows = await db.execute(sql`
      WITH ranked AS (
        SELECT DISTINCT ON (te.description)
          te.id,
          te.description,
          te.project_id,
          p.name AS project_name,
          p.color AS project_color,
          c.name AS client_name,
          te.jira_issue_key,
          te.jira_issue_summary,
          te.jira_connection_id,
          te.created_at,
          COALESCE(
            (SELECT SUM(EXTRACT(EPOCH FROM COALESCE(es.stopped_at, NOW()) - es.started_at))
             FROM entry_segments es
             WHERE es.entry_id = te.id AND es.started_at IS NOT NULL),
            0
          )::int AS total_duration_seconds,
          COALESCE(
            (SELECT MAX(es.started_at) FROM entry_segments es WHERE es.entry_id = te.id),
            te.created_at
          ) AS last_segment_at,
          EXISTS(
            SELECT 1 FROM entry_segments es
            WHERE es.entry_id = te.id AND es.type = 'clocked' AND es.stopped_at IS NULL
          ) AS is_running
        FROM time_entries te
        LEFT JOIN projects p ON p.id = te.project_id
        LEFT JOIN clients c ON c.id = p.client_id
        WHERE te.user_id = ${userId}
          AND te.is_active = true
          AND te.description != ''
        ORDER BY te.description, te.created_at DESC
      )
      SELECT * FROM ranked
      ORDER BY last_segment_at DESC
      LIMIT ${limit}
    `);

    return rows.rows.map((row: any) => ({
      id: row.id,
      description: row.description,
      projectId: row.project_id,
      projectName: row.project_name,
      projectColor: row.project_color,
      clientName: row.client_name,
      jiraIssueKey: row.jira_issue_key,
      jiraIssueSummary: row.jira_issue_summary,
      jiraConnectionId: row.jira_connection_id,
      totalDurationSeconds: Number(row.total_duration_seconds),
      lastSegmentAt:
        typeof row.last_segment_at === 'string'
          ? row.last_segment_at
          : (row.last_segment_at?.toISOString?.() ?? new Date().toISOString()),
      isRunning: row.is_running === true,
    }));
  });

  /** GET /api/entries/search — fuzzy search entries for command palette */
  fastify.get('/api/entries/search', async (request) => {
    const userId = request.auth.userId;
    const query = ((request.query as any).q ?? '').trim();
    const limit = Math.min(Number((request.query as any).limit) || 10, 20);

    if (query.length < 2) return [];

    // Search by description (fuzzy + ILIKE) and jira_issue_key (ILIKE)
    // Deduplicate by description, keeping the most recent entry per unique description
    const rows = await db.execute(sql`
      WITH ranked AS (
        SELECT DISTINCT ON (te.description)
          te.id,
          te.description,
          te.project_id,
          p.name AS project_name,
          p.color AS project_color,
          c.name AS client_name,
          te.jira_issue_key,
          te.jira_issue_summary,
          te.jira_connection_id,
          te.created_at,
          COALESCE(
            (SELECT SUM(EXTRACT(EPOCH FROM COALESCE(es.stopped_at, NOW()) - es.started_at))
             FROM entry_segments es
             WHERE es.entry_id = te.id AND es.started_at IS NOT NULL),
            0
          )::int AS total_duration_seconds,
          COALESCE(
            (SELECT MAX(es.started_at) FROM entry_segments es WHERE es.entry_id = te.id),
            te.created_at
          ) AS last_segment_at,
          EXISTS(
            SELECT 1 FROM entry_segments es
            WHERE es.entry_id = te.id AND es.type = 'clocked' AND es.stopped_at IS NULL
          ) AS is_running,
          GREATEST(
            similarity(te.description, ${query}),
            CASE WHEN te.jira_issue_key ILIKE ${'%' + query + '%'} THEN 0.8 ELSE 0 END
          ) AS sim
        FROM time_entries te
        LEFT JOIN projects p ON p.id = te.project_id
        LEFT JOIN clients c ON c.id = p.client_id
        WHERE te.user_id = ${userId}
          AND te.is_active = true
          AND te.description != ''
          AND (
            te.description % ${query}
            OR te.description ILIKE ${'%' + query + '%'}
            OR te.jira_issue_key ILIKE ${'%' + query + '%'}
          )
        ORDER BY te.description, te.created_at DESC
      )
      SELECT * FROM ranked
      ORDER BY sim DESC, last_segment_at DESC
      LIMIT ${limit}
    `);

    return rows.rows.map((row: any) => ({
      id: row.id,
      description: row.description,
      projectId: row.project_id,
      projectName: row.project_name,
      projectColor: row.project_color,
      clientName: row.client_name,
      jiraIssueKey: row.jira_issue_key,
      jiraIssueSummary: row.jira_issue_summary,
      jiraConnectionId: row.jira_connection_id,
      totalDurationSeconds: Number(row.total_duration_seconds),
      lastSegmentAt:
        typeof row.last_segment_at === 'string'
          ? row.last_segment_at
          : (row.last_segment_at?.toISOString?.() ?? new Date().toISOString()),
      isRunning: row.is_running === true,
    }));
  });

  /** POST /api/entries — create a manual entry */
  fastify.post('/api/entries', async (request) => {
    const userId = request.auth.userId;
    const actorId = getActorId(request);
    const source = getAuditSource(request);
    const body = request.body as CreateEntry;

    const startedAt = new Date(body.startedAt);
    const stoppedAt = new Date(body.stoppedAt);
    const durationSeconds = Math.round((stoppedAt.getTime() - startedAt.getTime()) / 1000);

    const result = await db.transaction(async (tx) => {
      // Insert entry (metadata only)
      const [created] = await tx
        .insert(timeEntries)
        .values({
          userId,
          description: body.description ?? '',
          projectId: body.projectId ?? null,
          jiraIssueKey: body.jiraIssueKey ?? null,
          jiraIssueSummary: body.jiraIssueSummary ?? null,
          jiraConnectionId: body.jiraConnectionId ?? null,
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
        await tx
          .insert(entryLabels)
          .values(labelIds.map((labelId: string) => ({ entryId: created!.id, labelId })));
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
    const [existing] = await db.select().from(timeEntries).where(eq(timeEntries.id, id)).limit(1);

    if (!existing || !existing.isActive) {
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
      if (body.jiraIssueKey !== undefined) updateSet.jiraIssueKey = body.jiraIssueKey;
      if (body.jiraIssueSummary !== undefined) updateSet.jiraIssueSummary = body.jiraIssueSummary;
      if (body.jiraConnectionId !== undefined) updateSet.jiraConnectionId = body.jiraConnectionId;

      if (Object.keys(updateSet).length > 0) {
        await tx.update(timeEntries).set(updateSet).where(eq(timeEntries.id, id));
      }

      // Snapshot old labels BEFORE deleting (needed for audit)
      let oldLabelIds: string[] = [];
      if (body.labelIds !== undefined) {
        const oldLabelRows = await tx
          .select({ id: labels.id })
          .from(entryLabels)
          .innerJoin(labels, eq(entryLabels.labelId, labels.id))
          .where(eq(entryLabels.entryId, id));
        oldLabelIds = oldLabelRows.map((r) => r.id).sort();

        await tx.delete(entryLabels).where(eq(entryLabels.entryId, id));
        if (body.labelIds.length > 0) {
          await tx
            .insert(entryLabels)
            .values(body.labelIds.map((labelId: string) => ({ entryId: id, labelId })));
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
        const newIds = [...body.labelIds].sort();
        if (JSON.stringify(oldLabelIds) !== JSON.stringify(newIds)) {
          changes.labelIds = { old: oldLabelIds, new: newIds };
        }
      }
      if (body.jiraIssueKey !== undefined && body.jiraIssueKey !== existing.jiraIssueKey) {
        changes.jiraIssueKey = { old: existing.jiraIssueKey, new: body.jiraIssueKey };
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

  /** DELETE /api/entries/:id — soft-delete an entry */
  fastify.delete('/api/entries/:id', async (request, reply) => {
    const userId = request.auth.userId;
    const actorId = getActorId(request);
    const source = getAuditSource(request);
    const { id } = request.params as { id: string };

    const [existing] = await db.select().from(timeEntries).where(eq(timeEntries.id, id)).limit(1);

    if (!existing) {
      return reply.code(404).send({ error: 'Entry not found' });
    }
    if (existing.userId !== userId) {
      return reply.code(403).send({ error: 'Not your entry' });
    }
    if (!existing.isActive) {
      return reply.code(400).send({ error: 'Entry already deleted' });
    }

    await db.transaction(async (tx) => {
      // Stop any running timer segment on this entry
      const [runningSegment] = await tx
        .select()
        .from(entrySegments)
        .where(
          and(
            eq(entrySegments.entryId, id),
            eq(entrySegments.type, 'clocked'),
            isNull(entrySegments.stoppedAt),
          ),
        )
        .limit(1);

      if (runningSegment) {
        const now = new Date();
        const duration = Math.round(
          (now.getTime() - (runningSegment.startedAt?.getTime() ?? now.getTime())) / 1000,
        );
        await tx
          .update(entrySegments)
          .set({ stoppedAt: now, durationSeconds: duration })
          .where(eq(entrySegments.id, runningSegment.id));
      }

      // Soft-delete
      await tx.update(timeEntries).set({ isActive: false }).where(eq(timeEntries.id, id));

      // Record audit
      const deletedProjectName = await resolveProjectName(existing.projectId, tx);
      await recordAudit({
        entryId: id,
        userId: existing.userId,
        actorId,
        action: 'deleted',
        changes: {
          description: { old: existing.description },
          project: { old: deletedProjectName },
          isActive: { old: true, new: false },
        },
        metadata: { source },
        tx,
      });
    });

    return { success: true };
  });

  /** POST /api/entries/:id/restore — restore a soft-deleted entry */
  fastify.post('/api/entries/:id/restore', async (request, reply) => {
    const userId = request.auth.userId;
    const actorId = getActorId(request);
    const { id } = request.params as { id: string };

    const [existing] = await db.select().from(timeEntries).where(eq(timeEntries.id, id)).limit(1);

    if (!existing) {
      return reply.code(404).send({ error: 'Entry not found' });
    }
    if (existing.userId !== userId) {
      return reply.code(403).send({ error: 'Not your entry' });
    }
    if (existing.isActive) {
      return reply.code(400).send({ error: 'Entry is not deleted' });
    }

    const result = await db.transaction(async (tx) => {
      await tx.update(timeEntries).set({ isActive: true }).where(eq(timeEntries.id, id));

      await recordAudit({
        entryId: id,
        userId: existing.userId,
        actorId,
        action: 'updated',
        changes: {
          isActive: { old: false, new: true },
        },
        metadata: { source: 'restore' },
        tx,
      });

      return buildEntryResponse(id, tx);
    });

    return result;
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
    const [existing] = await db.select().from(timeEntries).where(eq(timeEntries.id, id)).limit(1);

    if (!existing || !existing.isActive) {
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

  /** POST /api/entries/:id/move-block — move a time block to a new entry */
  fastify.post('/api/entries/:id/move-block', async (request, reply) => {
    const userId = request.auth.userId;
    const actorId = getActorId(request);
    const { id } = request.params as { id: string };
    const body = request.body as MoveBlock;

    // Verify ownership + active
    const [existing] = await db.select().from(timeEntries).where(eq(timeEntries.id, id)).limit(1);

    if (!existing || !existing.isActive) {
      return reply.code(404).send({ error: 'Entry not found' });
    }
    if (existing.userId !== userId) {
      return reply.code(403).send({ error: 'Not your entry' });
    }

    // Verify segment belongs to this entry and is completed
    const [segment] = await db
      .select()
      .from(entrySegments)
      .where(and(eq(entrySegments.id, body.segmentId), eq(entrySegments.entryId, id)))
      .limit(1);

    if (!segment) {
      return reply.code(400).send({ error: 'Time block not found on this entry' });
    }

    const isRunningSegment = !segment.stoppedAt;

    // Completed segments must have a duration
    if (!isRunningSegment && !segment.durationSeconds) {
      return reply.code(400).send({ error: 'Time block has no duration' });
    }

    const result = await db.transaction(async (tx) => {
      // Auto-generate description: copy original with next available "(N)" suffix
      const newDescription =
        body.description ?? (await nextCopyName(existing.description, userId, tx));
      const now = new Date();

      // For running segments: stop the original first
      let blockDuration: number;
      if (isRunningSegment) {
        blockDuration = Math.max(
          0,
          Math.round((now.getTime() - new Date(segment.startedAt!).getTime()) / 1000),
        );
        await tx
          .update(entrySegments)
          .set({ stoppedAt: now, durationSeconds: blockDuration })
          .where(eq(entrySegments.id, segment.id));
      } else {
        blockDuration = segment.durationSeconds!;
      }

      // 1. Create new entry (clone createdAt + project from original)
      const [newEntry] = await tx
        .insert(timeEntries)
        .values({
          userId,
          description: newDescription,
          projectId: body.projectId ?? existing.projectId,
          createdAt: existing.createdAt,
        })
        .returning();

      // 1b. Clone labels from original entry
      const originalLabels = await tx
        .select({ labelId: entryLabels.labelId })
        .from(entryLabels)
        .where(eq(entryLabels.entryId, id));
      if (originalLabels.length > 0) {
        await tx
          .insert(entryLabels)
          .values(originalLabels.map((l) => ({ entryId: newEntry!.id, labelId: l.labelId })));
      }

      // 2. Create segment on new entry
      if (isRunningSegment) {
        // Running: create a new clocked segment that continues running from the original startedAt
        await tx.insert(entrySegments).values({
          entryId: newEntry!.id,
          type: 'clocked',
          startedAt: segment.startedAt,
          stoppedAt: null,
          durationSeconds: null,
          note: null,
        });
      } else {
        // Completed: create a manual segment with the moved block's time range and duration
        await tx.insert(entrySegments).values({
          entryId: newEntry!.id,
          type: 'manual',
          startedAt: segment.startedAt,
          stoppedAt: segment.stoppedAt,
          durationSeconds: blockDuration,
          note: 'Moved from another entry',
        });
      }

      // 3. Add negative adjustment on original entry (tagged with source segment ID)
      await tx.insert(entrySegments).values({
        entryId: id,
        type: 'manual',
        durationSeconds: -blockDuration,
        note: `moved:${body.segmentId}:${newDescription}`,
      });

      // 4. Audit original entry
      await recordAudit({
        entryId: id,
        userId: existing.userId,
        actorId,
        action: 'block_moved',
        changes: {
          segmentId: { old: body.segmentId },
          durationSeconds: { old: blockDuration },
          movedToEntryId: { new: newEntry!.id },
        },
        metadata: { source: 'move_block', wasRunning: isRunningSegment },
        tx,
      });

      // 5. Audit new entry
      const newProjectName = await resolveProjectName(body.projectId ?? existing.projectId, tx);
      await recordAudit({
        entryId: newEntry!.id,
        userId,
        actorId,
        action: 'created',
        changes: {
          description: { new: newDescription },
          project: { new: newProjectName },
          durationSeconds: { new: isRunningSegment ? null : blockDuration },
        },
        metadata: { source: 'move_block', movedFromEntryId: id, wasRunning: isRunningSegment },
        tx,
      });

      return buildEntryResponse(newEntry!.id, tx);
    });

    return result;
  });

  /** POST /api/entries/:id/split — split off time from an entry into a new entry */
  fastify.post('/api/entries/:id/split', async (request, reply) => {
    const userId = request.auth.userId;
    const actorId = getActorId(request);
    const { id } = request.params as { id: string };
    const body = request.body as SplitEntry;

    // Verify entry exists and belongs to user
    const [existing] = await db.select().from(timeEntries).where(eq(timeEntries.id, id)).limit(1);

    if (!existing || !existing.isActive) {
      return reply.code(404).send({ error: 'Entry not found' });
    }
    if (existing.userId !== userId) {
      return reply.code(403).send({ error: 'Not your entry' });
    }

    // Get all segments for this entry to calculate total duration and end time
    const segments = await db
      .select()
      .from(entrySegments)
      .where(eq(entrySegments.entryId, id))
      .orderBy(entrySegments.startedAt);

    if (segments.length === 0) {
      return reply.code(400).send({ error: 'Entry has no time segments' });
    }

    // Reject split on running entries — must be stopped first
    const runningSegment = segments.find((s) => s.type === 'clocked' && !s.stoppedAt);
    if (runningSegment) {
      return reply.code(400).send({ error: 'Cannot split a running entry. Stop the timer first.' });
    }

    // Calculate total duration from segments
    const totalDuration = segments.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0);

    // Find end time from last stopped segment
    const lastStopped = [...segments].reverse().find((s) => s.stoppedAt);
    if (!lastStopped?.stoppedAt) {
      return reply.code(400).send({ error: 'Could not determine entry end time' });
    }
    const endTime = lastStopped.stoppedAt;

    // Validate split duration
    if (body.durationSeconds >= totalDuration) {
      return reply.code(400).send({
        error: `Cannot split ${formatDuration(body.durationSeconds)} — entry total is ${formatDuration(totalDuration)}`,
      });
    }

    const result = await db.transaction(async (tx) => {
      // 1. Calculate new entry's start time (end time - split duration)
      const newEntryStart = new Date(endTime.getTime() - body.durationSeconds * 1000);

      // 2. Create new entry (use provided description/project or clone from original)
      const newDescription =
        body.description !== undefined ? body.description : existing.description;
      const newProjectId = body.projectId !== undefined ? body.projectId : existing.projectId;
      const [newEntry] = await tx
        .insert(timeEntries)
        .values({
          userId,
          description: newDescription,
          projectId: newProjectId,
          jiraIssueKey: existing.jiraIssueKey,
          jiraIssueSummary: existing.jiraIssueSummary,
          jiraConnectionId: existing.jiraConnectionId,
          createdAt: newEntryStart,
        })
        .returning();

      // 2b. Clone labels from original entry
      const originalLabels = await tx
        .select({ labelId: entryLabels.labelId })
        .from(entryLabels)
        .where(eq(entryLabels.entryId, id));
      if (originalLabels.length > 0) {
        await tx
          .insert(entryLabels)
          .values(originalLabels.map((l) => ({ entryId: newEntry!.id, labelId: l.labelId })));
      }

      // 3. Create a manual segment on the new entry with the split duration
      await tx.insert(entrySegments).values({
        entryId: newEntry!.id,
        type: 'manual',
        startedAt: newEntryStart,
        stoppedAt: endTime,
        durationSeconds: body.durationSeconds,
        note: body.note ?? 'Split from another entry',
      });

      // 4. Add negative adjustment on original entry
      await tx.insert(entrySegments).values({
        entryId: id,
        type: 'manual',
        durationSeconds: -body.durationSeconds,
        note: `split:${newEntry!.id}:${body.note ?? ''}`,
      });

      // 5. Audit original entry
      await recordAudit({
        entryId: id,
        userId: existing.userId,
        actorId,
        action: 'entry_split',
        changes: {
          durationSeconds: { old: totalDuration, new: totalDuration - body.durationSeconds },
          splitToEntryId: { new: newEntry!.id },
        },
        metadata: { source: 'entry_split', splitDuration: body.durationSeconds },
        tx,
      });

      // 6. Audit new entry
      const newProjectName = await resolveProjectName(newProjectId, tx);
      await recordAudit({
        entryId: newEntry!.id,
        userId,
        actorId,
        action: 'created',
        changes: {
          description: { new: newDescription },
          project: { new: newProjectName },
          durationSeconds: { new: body.durationSeconds },
        },
        metadata: { source: 'entry_split', splitFromEntryId: id },
        tx,
      });

      return buildEntryResponse(newEntry!.id, tx);
    });

    return result;
  });

  /** GET /api/entries/:id/audit — get audit trail for an entry */
  fastify.get('/api/entries/:id/audit', async (request, reply) => {
    const userId = request.auth.userId;
    const { id } = request.params as { id: string };

    // Verify ownership
    const [entry] = await db.select().from(timeEntries).where(eq(timeEntries.id, id)).limit(1);

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
