import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { UserPreferencesSchema, UserPreferencesPatchSchema } from '@ternity/shared';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';

export async function userPreferencesRoutes(fastify: FastifyInstance) {
  fastify.get('/api/user/preferences', async (request) => {
    const userId = request.auth.realUserId ?? request.auth.userId;

    const [row] = await db
      .select({ preferences: users.preferences })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const raw = (row?.preferences ?? {}) as Record<string, unknown>;
    return UserPreferencesSchema.parse(raw);
  });

  fastify.patch('/api/user/preferences', async (request) => {
    const userId = request.auth.realUserId ?? request.auth.userId;
    const patch = UserPreferencesPatchSchema.parse(request.body);

    // Read current preferences
    const [row] = await db
      .select({ preferences: users.preferences })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const current = (row?.preferences ?? {}) as Record<string, unknown>;
    const merged = { ...current, ...patch };

    // Write back
    await db
      .update(users)
      .set({ preferences: merged, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return UserPreferencesSchema.parse(merged);
  });
}
