import { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { eq } from 'drizzle-orm';
import type { AuthContext } from '@ternity/shared';
import { GlobalRole, OrgRole } from '@ternity/shared';
import { db } from '../db/index.js';
import { users, projectMembers } from '../db/schema.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext;
  }
}

/** Build orgRoles map from projectMembers table */
async function buildOrgRoles(userId: string): Promise<Record<string, OrgRole>> {
  const memberships = await db
    .select()
    .from(projectMembers)
    .where(eq(projectMembers.userId, userId));

  const orgRoles: Record<string, OrgRole> = {};
  for (const m of memberships) {
    orgRoles[m.projectId] = m.role as OrgRole;
  }
  return orgRoles;
}

/**
 * JIT (just-in-time) user provisioning from Logto JWT claims.
 * Creates user on first login, updates profile on subsequent logins.
 * Returns the local DB user.
 */
async function jitProvision(claims: {
  sub: string;
  name?: string;
  phone_number?: string;
  email?: string;
  picture?: string;
  roles?: string[];
}) {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.externalAuthId, claims.sub))
    .limit(1);

  const globalRole = claims.roles?.includes('admin') ? GlobalRole.Admin : GlobalRole.User;

  if (existing) {
    // Update profile fields from Logto
    const [updated] = await db
      .update(users)
      .set({
        displayName: claims.name ?? existing.displayName,
        email: claims.email ?? existing.email,
        phone: claims.phone_number ?? existing.phone,
        avatarUrl: claims.picture ?? existing.avatarUrl,
        globalRole,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();
    return updated;
  }

  // Create new user
  const [created] = await db
    .insert(users)
    .values({
      externalAuthId: claims.sub,
      displayName: claims.name ?? 'User',
      email: claims.email ?? null,
      phone: claims.phone_number ?? null,
      avatarUrl: claims.picture ?? null,
      globalRole,
    })
    .returning();
  return created;
}

async function authPlugin(fastify: FastifyInstance) {
  const authMode = process.env.AUTH_MODE ?? 'stub';

  fastify.decorateRequest('auth', null as unknown as AuthContext);

  if (authMode === 'stub') {
    fastify.addHook('onRequest', async (request: FastifyRequest) => {
      const devUserId = request.headers['x-dev-user-id'] as string | undefined;

      // Find the user — either by header or default to first user
      let user;
      if (devUserId) {
        [user] = await db.select().from(users).where(eq(users.id, devUserId)).limit(1);
      }
      if (!user) {
        [user] = await db.select().from(users).limit(1);
      }

      if (!user) {
        request.auth = {
          userId: 'unknown',
          displayName: 'Unknown User',
          email: null,
          phone: null,
          avatarUrl: null,
          globalRole: GlobalRole.User,
          orgRoles: {},
        };
        return;
      }

      const orgRoles = await buildOrgRoles(user.id);

      request.auth = {
        userId: user.id,
        displayName: user.displayName,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        globalRole: user.globalRole as GlobalRole,
        orgRoles,
      };
    });
  } else if (authMode === 'logto') {
    const endpoint = process.env.LOGTO_ENDPOINT;
    const appId = process.env.LOGTO_APP_ID;

    if (!endpoint) throw new Error('LOGTO_ENDPOINT is required when AUTH_MODE=logto');
    if (!appId) throw new Error('LOGTO_APP_ID is required when AUTH_MODE=logto');

    const issuer = new URL('/oidc', endpoint).toString();
    const jwksUrl = new URL('/oidc/jwks', endpoint);
    const jwks = createRemoteJWKSet(jwksUrl);

    fastify.addHook('onRequest', async (request, reply) => {
      // Skip auth for health endpoint
      if (request.url === '/health') return;

      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.code(401).send({ error: 'Missing or invalid Authorization header' });
      }

      const token = authHeader.slice(7);

      try {
        const { payload } = await jwtVerify(token, jwks, {
          issuer,
          audience: appId,
        });

        const claims = {
          sub: payload.sub!,
          name: payload.name as string | undefined,
          phone_number: payload.phone_number as string | undefined,
          email: payload.email as string | undefined,
          picture: payload.picture as string | undefined,
          roles: payload.roles as string[] | undefined,
        };

        const user = await jitProvision(claims);
        if (!user) {
          return reply.code(500).send({ error: 'Failed to provision user' });
        }

        const orgRoles = await buildOrgRoles(user.id);

        request.auth = {
          userId: user.id,
          displayName: user.displayName,
          email: user.email,
          phone: user.phone,
          avatarUrl: user.avatarUrl,
          globalRole: user.globalRole as GlobalRole,
          orgRoles,
        };
      } catch (err) {
        request.log.warn({ err }, 'JWT verification failed');
        return reply.code(401).send({ error: 'Invalid token' });
      }
    });
  } else {
    throw new Error(`Unknown AUTH_MODE: ${authMode}`);
  }
}

export default fp(authPlugin, { name: 'auth' });
