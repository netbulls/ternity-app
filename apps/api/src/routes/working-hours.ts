import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { DEFAULT_WEEKLY_WORKING_HOURS, WeeklyWorkingHoursSchema } from '@ternity/shared';
import { db } from '../db/index.js';
import { workingSchedules } from '../db/schema.js';

export async function workingHoursRoutes(fastify: FastifyInstance) {
  fastify.get('/api/working-hours', async (request) => {
    const userId = request.auth.realUserId ?? request.auth.userId;

    const [row] = await db
      .select({ schedule: workingSchedules.schedule })
      .from(workingSchedules)
      .where(eq(workingSchedules.userId, userId))
      .limit(1);

    if (!row) {
      return DEFAULT_WEEKLY_WORKING_HOURS;
    }

    return WeeklyWorkingHoursSchema.parse(row.schedule);
  });

  fastify.put('/api/working-hours', async (request, reply) => {
    const userId = request.auth.realUserId ?? request.auth.userId;
    const parsed = WeeklyWorkingHoursSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Invalid working hours data',
        details: parsed.error.flatten(),
      });
    }

    const [saved] = await db
      .insert(workingSchedules)
      .values({
        userId,
        schedule: parsed.data,
      })
      .onConflictDoUpdate({
        target: workingSchedules.userId,
        set: {
          schedule: parsed.data,
          updatedAt: new Date(),
        },
      })
      .returning({ schedule: workingSchedules.schedule });

    return WeeklyWorkingHoursSchema.parse(saved!.schedule);
  });
}
