import { FastifyInstance } from 'fastify';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { timeEntries, entryLabels, projects, clients, labels } from '../db/schema.js';
import type { StartTimer } from '@ternity/shared';

/** Build a full entry response with project + labels joined */
async function buildEntryResponse(entryId: string) {
  const [entry] = await db
    .select()
    .from(timeEntries)
    .where(eq(timeEntries.id, entryId))
    .limit(1);

  if (!entry) return null;

  // Get project + client
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

  // Get labels
  const entryLabelRows = await db
    .select({
      id: labels.id,
      name: labels.name,
      color: labels.color,
    })
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

export async function timerRoutes(fastify: FastifyInstance) {
  /** GET /api/timer — get current running entry */
  fastify.get('/api/timer', async (request) => {
    const userId = request.auth.userId;

    const [running] = await db
      .select()
      .from(timeEntries)
      .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.stoppedAt)))
      .limit(1);

    if (!running) {
      return { running: false, entry: null };
    }

    const entry = await buildEntryResponse(running.id);
    return { running: true, entry };
  });

  /** POST /api/timer/start — start a new timer (stops any running one first) */
  fastify.post('/api/timer/start', async (request) => {
    const userId = request.auth.userId;
    const body = (request.body ?? {}) as StartTimer;
    const description = body.description ?? '';
    const projectId = body.projectId ?? null;
    const labelIds = body.labelIds ?? [];

    // Stop any running entry first
    const now = new Date();
    const [running] = await db
      .select()
      .from(timeEntries)
      .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.stoppedAt)))
      .limit(1);

    if (running) {
      const duration = Math.round(
        (now.getTime() - running.startedAt.getTime()) / 1000,
      );
      await db
        .update(timeEntries)
        .set({ stoppedAt: now, durationSeconds: duration })
        .where(eq(timeEntries.id, running.id));
    }

    // Create new running entry
    const [created] = await db
      .insert(timeEntries)
      .values({
        userId,
        description,
        projectId,
        startedAt: now,
      })
      .returning();

    // Attach labels
    if (created && labelIds.length > 0) {
      await db.insert(entryLabels).values(
        labelIds.map((labelId: string) => ({ entryId: created.id, labelId })),
      );
    }

    const entry = await buildEntryResponse(created!.id);
    return { running: true, entry };
  });

  /** POST /api/timer/stop — stop the running timer */
  fastify.post('/api/timer/stop', async (request, reply) => {
    const userId = request.auth.userId;

    const [running] = await db
      .select()
      .from(timeEntries)
      .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.stoppedAt)))
      .limit(1);

    if (!running) {
      return reply.code(404).send({ error: 'No running timer' });
    }

    const now = new Date();
    const duration = Math.round(
      (now.getTime() - running.startedAt.getTime()) / 1000,
    );

    await db
      .update(timeEntries)
      .set({ stoppedAt: now, durationSeconds: duration })
      .where(eq(timeEntries.id, running.id));

    const entry = await buildEntryResponse(running.id);
    return { running: false, entry };
  });
}
