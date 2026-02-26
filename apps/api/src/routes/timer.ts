import { FastifyInstance } from 'fastify';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { db, type Database } from '../db/index.js';
import { timeEntries, entryLabels, entrySegments, projects, clients, labels } from '../db/schema.js';
import { recordAudit, resolveProjectName } from '../lib/audit.js';
import type { StartTimer, Entry } from '@ternity/shared';

/** Build a full entry response with segments, project + labels joined */
export async function buildEntryResponse(entryId: string, tx?: Database): Promise<Entry | null> {
  const conn = tx ?? db;

  const [entry] = await conn
    .select()
    .from(timeEntries)
    .where(eq(timeEntries.id, entryId))
    .limit(1);

  if (!entry) return null;

  // Get segments
  const segments = await conn
    .select()
    .from(entrySegments)
    .where(eq(entrySegments.entryId, entryId))
    .orderBy(entrySegments.createdAt);

  // Get project + client
  let projectName: string | null = null;
  let projectColor: string | null = null;
  let clientName: string | null = null;
  if (entry.projectId) {
    const [proj] = await conn
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

  // Get labels
  const entryLabelRows = await conn
    .select({
      id: labels.id,
      name: labels.name,
      color: labels.color,
    })
    .from(entryLabels)
    .innerJoin(labels, eq(entryLabels.labelId, labels.id))
    .where(eq(entryLabels.entryId, entryId));

  // Compute totals
  const totalDurationSeconds = segments.reduce(
    (sum, s) => sum + (s.durationSeconds ?? 0),
    0,
  );
  const isRunning = segments.some(
    (s) => s.type === 'clocked' && s.stoppedAt === null,
  );

  return {
    id: entry.id,
    description: entry.description,
    projectId: entry.projectId,
    projectName,
    projectColor,
    clientName,
    labels: entryLabelRows,
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
    isActive: entry.isActive,
    createdAt: entry.createdAt.toISOString(),
    userId: entry.userId,
  };
}

/** Get the actor ID — the real user behind the action (handles impersonation) */
function getActorId(request: { auth: { realUserId?: string; userId: string } }): string {
  return request.auth.realUserId ?? request.auth.userId;
}

/** Stop a running segment (if any) for a given user. Returns the entry ID that was stopped, or null. */
async function stopRunningSegment(
  tx: Database,
  userId: string,
  actorId: string,
  reason: string,
): Promise<string | null> {
  // Find running clocked segment via join
  const [runningRow] = await tx
    .select({
      segmentId: entrySegments.id,
      segmentStartedAt: entrySegments.startedAt,
      entryId: entrySegments.entryId,
      entryUserId: timeEntries.userId,
    })
    .from(entrySegments)
    .innerJoin(timeEntries, eq(entrySegments.entryId, timeEntries.id))
    .where(
      and(
        eq(timeEntries.userId, userId),
        eq(entrySegments.type, 'clocked'),
        isNull(entrySegments.stoppedAt),
      ),
    )
    .limit(1);

  if (!runningRow) return null;

  const now = new Date();
  const duration = Math.round(
    (now.getTime() - (runningRow.segmentStartedAt?.getTime() ?? now.getTime())) / 1000,
  );

  await tx
    .update(entrySegments)
    .set({ stoppedAt: now, durationSeconds: duration })
    .where(eq(entrySegments.id, runningRow.segmentId));

  await recordAudit({
    entryId: runningRow.entryId,
    userId: runningRow.entryUserId,
    actorId,
    action: 'timer_stopped',
    changes: {
      stoppedAt: { old: null, new: now.toISOString() },
      durationSeconds: { old: null, new: duration },
    },
    metadata: { source: 'timer_bar', reason },
    tx,
  });

  return runningRow.entryId;
}

export async function timerRoutes(fastify: FastifyInstance) {
  /** GET /api/timer — get current running entry */
  fastify.get('/api/timer', async (request) => {
    const userId = request.auth.userId;

    // Find entry with a running clocked segment (active entries only)
    const [runningRow] = await db
      .select({ entryId: entrySegments.entryId })
      .from(entrySegments)
      .innerJoin(timeEntries, eq(entrySegments.entryId, timeEntries.id))
      .where(
        and(
          eq(timeEntries.userId, userId),
          eq(timeEntries.isActive, true),
          eq(entrySegments.type, 'clocked'),
          isNull(entrySegments.stoppedAt),
        ),
      )
      .limit(1);

    if (!runningRow) {
      return { running: false, entry: null };
    }

    const entry = await buildEntryResponse(runningRow.entryId);
    return { running: true, entry };
  });

  /** POST /api/timer/start — start a new timer (stops any running one first) */
  fastify.post('/api/timer/start', async (request) => {
    const userId = request.auth.userId;
    const actorId = getActorId(request);
    const body = (request.body ?? {}) as StartTimer;
    const description = body.description ?? '';
    const projectId = body.projectId ?? null;
    const labelIds = body.labelIds ?? [];

    const result = await db.transaction(async (tx) => {
      // Stop any running segment first
      await stopRunningSegment(tx, userId, actorId, 'auto_stop_on_new_start');

      const now = new Date();

      // Create new entry (metadata only)
      const [created] = await tx
        .insert(timeEntries)
        .values({ userId, description, projectId })
        .returning();

      // Create first clocked segment
      await tx.insert(entrySegments).values({
        entryId: created!.id,
        type: 'clocked',
        startedAt: now,
      });

      // Attach labels
      if (labelIds.length > 0) {
        await tx.insert(entryLabels).values(
          labelIds.map((labelId: string) => ({ entryId: created!.id, labelId })),
        );
      }

      // Audit: timer started
      const startedProjectName = await resolveProjectName(projectId, tx);
      await recordAudit({
        entryId: created!.id,
        userId,
        actorId,
        action: 'timer_started',
        changes: {
          description: { new: description },
          project: { new: startedProjectName },
          startedAt: { new: now.toISOString() },
        },
        metadata: { source: 'timer_bar' },
        tx,
      });

      return buildEntryResponse(created!.id, tx);
    });

    return { running: true, entry: result };
  });

  /** POST /api/timer/resume/:id — resume an existing stopped entry */
  fastify.post('/api/timer/resume/:id', async (request, reply) => {
    const userId = request.auth.userId;
    const actorId = getActorId(request);
    const { id } = request.params as { id: string };

    // Verify ownership
    const [target] = await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, id))
      .limit(1);

    if (!target || !target.isActive) {
      return reply.code(404).send({ error: 'Entry not found' });
    }
    if (target.userId !== userId) {
      return reply.code(403).send({ error: 'Not your entry' });
    }

    // Check if already running (has clocked segment with stoppedAt=null)
    const [runningSegment] = await db
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
      // Already running — just return it
      const entry = await buildEntryResponse(id);
      return { running: true, entry };
    }

    const result = await db.transaction(async (tx) => {
      // Stop any currently running segment on another entry
      await stopRunningSegment(tx, userId, actorId, 'auto_stop_on_resume');

      const now = new Date();

      // Insert NEW clocked segment on this entry
      await tx.insert(entrySegments).values({
        entryId: id,
        type: 'clocked',
        startedAt: now,
      });

      // Audit: timer resumed
      await recordAudit({
        entryId: id,
        userId: target.userId,
        actorId,
        action: 'timer_resumed',
        changes: {
          startedAt: { new: now.toISOString() },
        },
        metadata: { source: 'timer_bar' },
        tx,
      });

      return buildEntryResponse(id, tx);
    });

    return { running: true, entry: result };
  });

  /** POST /api/timer/stop — stop the running timer */
  fastify.post('/api/timer/stop', async (request, reply) => {
    const userId = request.auth.userId;
    const actorId = getActorId(request);

    // Find running segment via join
    const [runningRow] = await db
      .select({
        segmentId: entrySegments.id,
        segmentStartedAt: entrySegments.startedAt,
        entryId: entrySegments.entryId,
      })
      .from(entrySegments)
      .innerJoin(timeEntries, eq(entrySegments.entryId, timeEntries.id))
      .where(
        and(
          eq(timeEntries.userId, userId),
          eq(entrySegments.type, 'clocked'),
          isNull(entrySegments.stoppedAt),
        ),
      )
      .limit(1);

    if (!runningRow) {
      return reply.code(404).send({ error: 'No running timer' });
    }

    const result = await db.transaction(async (tx) => {
      const now = new Date();
      const duration = Math.round(
        (now.getTime() - (runningRow.segmentStartedAt?.getTime() ?? now.getTime())) / 1000,
      );

      await tx
        .update(entrySegments)
        .set({ stoppedAt: now, durationSeconds: duration })
        .where(eq(entrySegments.id, runningRow.segmentId));

      // Audit: timer stopped
      await recordAudit({
        entryId: runningRow.entryId,
        userId,
        actorId,
        action: 'timer_stopped',
        changes: {
          stoppedAt: { old: null, new: now.toISOString() },
          durationSeconds: { old: null, new: duration },
        },
        metadata: { source: 'timer_bar' },
        tx,
      });

      return buildEntryResponse(runningRow.entryId, tx);
    });

    return { running: false, entry: result };
  });
}
