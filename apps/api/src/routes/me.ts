import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { getManagementToken } from '../plugins/auth.js';

export async function meRoutes(fastify: FastifyInstance) {
  fastify.get('/api/me', async (request) => {
    // Refresh avatar from Logto on login (when AUTH_MODE=logto)
    const logtoEndpoint = process.env.LOGTO_ENDPOINT;
    if (process.env.AUTH_MODE === 'logto' && logtoEndpoint) {
      try {
        const [user] = await db
          .select({
            id: users.id,
            externalAuthId: users.externalAuthId,
            avatarUrl: users.avatarUrl,
            phone: users.phone,
          })
          .from(users)
          .where(eq(users.id, request.auth.userId))
          .limit(1);

        if (user?.externalAuthId) {
          const mgmtToken = await getManagementToken(logtoEndpoint);
          if (mgmtToken) {
            const url = new URL(`/api/users/${user.externalAuthId}`, logtoEndpoint).toString();
            const res = await fetch(url, {
              headers: { Authorization: `Bearer ${mgmtToken}` },
            });
            if (res.ok) {
              const logtoUser = (await res.json()) as {
                avatar?: string;
                primaryPhone?: string;
                identities?: Record<string, { details?: { avatar?: string } }>;
              };
              // Top-level avatar is only set at sign-up. Fall back to social identity avatar.
              const newAvatar =
                logtoUser.avatar ??
                Object.values(logtoUser.identities ?? {}).find((id) => id.details?.avatar)?.details
                  ?.avatar ??
                null;

              const rawPhone = logtoUser.primaryPhone?.trim() ?? null;
              const newPhone = rawPhone
                ? rawPhone.startsWith('+')
                  ? rawPhone
                  : `+${rawPhone}`
                : null;

              const updates: Partial<typeof users.$inferInsert> = {};
              if (newAvatar !== user.avatarUrl) updates.avatarUrl = newAvatar;
              if (newPhone !== user.phone) updates.phone = newPhone;

              if (Object.keys(updates).length > 0) {
                await db
                  .update(users)
                  .set({ ...updates, updatedAt: new Date() })
                  .where(eq(users.id, user.id));
                request.auth.avatarUrl = newAvatar;
                request.auth.phone = newPhone;
                request.log.info(`Profile refreshed for user ${user.id}`);
              }
            } else {
              request.log.warn(`Logto user fetch failed: ${res.status} ${await res.text()}`);
            }
          } else {
            request.log.warn('No management token available for avatar refresh');
          }
        }
      } catch (err) {
        request.log.warn({ err }, 'Avatar refresh failed');
      }
    }

    return request.auth;
  });
}
