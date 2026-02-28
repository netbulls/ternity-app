import { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { eq, and, asc, isNull } from 'drizzle-orm';
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

/** Obtain a Management API access token from the Logto M2M app. */
let mgmtTokenCache: { token: string; expiresAt: number } | null = null;

export async function getManagementToken(logtoEndpoint: string): Promise<string | null> {
  // Return cached token if still valid (with 60s margin)
  if (mgmtTokenCache && Date.now() < mgmtTokenCache.expiresAt - 60_000) {
    return mgmtTokenCache.token;
  }

  const clientId = process.env.LOGTO_M2M_APP_ID;
  const clientSecret = process.env.LOGTO_M2M_APP_SECRET;
  if (!clientId || !clientSecret) {
    console.warn('JIT: LOGTO_M2M_APP_ID/SECRET not set — email auto-match disabled');
    return null;
  }

  const tokenUrl = new URL('/oidc/token', logtoEndpoint).toString();
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      resource: 'https://default.logto.app/api',
      scope: 'all',
    }),
  });

  if (!res.ok) {
    console.warn('JIT: Failed to get Management API token:', res.status, await res.text());
    return null;
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  mgmtTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

/**
 * JIT (just-in-time) user provisioning from Logto JWT claims.
 * Access tokens only carry sub + roles/scopes (no profile fields).
 *
 * Auto-match flow: if no user row has this `sub` yet, fetch the user's
 * email from the Logto Management API and look for an unlinked synced
 * profile with a matching email. This prevents duplicate rows when
 * synced users (Toggl/Timetastic) sign in via Logto for the first time.
 */
async function jitProvision(claims: { sub: string; roles?: string[]; logtoEndpoint: string }) {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.externalAuthId, claims.sub))
    .limit(1);

  const globalRole = claims.roles?.includes('admin') ? GlobalRole.Admin : GlobalRole.User;

  if (existing) {
    // Update global role from token claims (avatar refreshed via /api/me)
    const [updated] = await db
      .update(users)
      .set({
        globalRole,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();
    return updated;
  }

  // --- Email auto-match: try to link to an existing synced profile ---
  try {
    const mgmtToken = await getManagementToken(claims.logtoEndpoint);
    if (mgmtToken) {
      const userUrl = new URL(`/api/users/${claims.sub}`, claims.logtoEndpoint).toString();
      const res = await fetch(userUrl, {
        headers: { Authorization: `Bearer ${mgmtToken}` },
      });

      if (res.ok) {
        const logtoUser = (await res.json()) as {
          primaryEmail?: string;
          primaryPhone?: string;
          name?: string;
          avatar?: string;
          identities?: Record<string, { details?: { avatar?: string; name?: string } }>;
        };

        // Top-level avatar/name only set at sign-up. Fall back to social identity.
        const socialIdentity = Object.values(logtoUser.identities ?? {}).find(
          (id) => id.details?.avatar,
        );
        const resolvedAvatar = logtoUser.avatar ?? socialIdentity?.details?.avatar ?? null;
        const resolvedName = logtoUser.name ?? socialIdentity?.details?.name ?? null;

        if (logtoUser.primaryEmail) {
          // Find unlinked user rows with this email
          const candidates = await db
            .select()
            .from(users)
            .where(and(eq(users.email, logtoUser.primaryEmail), isNull(users.externalAuthId)));

          const match = candidates.find((c) => c.togglId != null) ?? candidates[0];

          if (match) {
            const [linked] = await db
              .update(users)
              .set({
                externalAuthId: claims.sub,
                globalRole,
                avatarUrl: resolvedAvatar || match.avatarUrl,
                updatedAt: new Date(),
              })
              .where(eq(users.id, match.id))
              .returning();

            console.log(
              `JIT: Auto-linked user ${claims.sub} to existing profile ${match.id} via email ${logtoUser.primaryEmail}`,
            );
            return linked;
          }

          // No match — create new row but store the email
          const [created] = await db
            .insert(users)
            .values({
              externalAuthId: claims.sub,
              displayName: resolvedName || 'New User',
              email: logtoUser.primaryEmail,
              phone: logtoUser.primaryPhone ?? null,
              avatarUrl: resolvedAvatar,
              globalRole,
            })
            .returning();
          return created;
        } else {
          console.warn('JIT: Logto user has no primaryEmail for', claims.sub);
        }
      }
    }
  } catch (err) {
    // Non-fatal — fall through to create a new row without email
    console.warn('JIT: Failed to fetch user from Management API:', err);
  }

  // Fallback: new user — minimal record
  const [created] = await db
    .insert(users)
    .values({
      externalAuthId: claims.sub,
      displayName: 'New User',
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

      // Find the user — header override → explicit ID for role → first by role
      let user;
      if (devUserId) {
        [user] = await db.select().from(users).where(eq(users.id, devUserId)).limit(1);
      }
      if (!user) {
        const devRole = (process.env.DEV_USER_ROLE ?? 'admin') as 'admin' | 'user';
        // Explicit user IDs per role (set in .env.local)
        const explicitId = devRole === 'admin' ? process.env.DEV_ADMIN_ID : process.env.DEV_USER_ID;
        if (explicitId) {
          [user] = await db.select().from(users).where(eq(users.id, explicitId)).limit(1);
        }
        if (!user) {
          [user] = await db
            .select()
            .from(users)
            .where(eq(users.globalRole, devRole))
            .orderBy(asc(users.createdAt))
            .limit(1);
        }
        // Fallback to first user if no match for the role
        if (!user) {
          [user] = await db.select().from(users).orderBy(asc(users.createdAt)).limit(1);
        }
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
    const apiResource = process.env.LOGTO_API_RESOURCE ?? 'https://api.ternity.xyz';

    if (!endpoint) throw new Error('LOGTO_ENDPOINT is required when AUTH_MODE=logto');

    const issuer = new URL('/oidc', endpoint).toString();
    const jwksUrl = new URL('/oidc/jwks', endpoint);
    const jwks = createRemoteJWKSet(jwksUrl);

    fastify.addHook('onRequest', async (request, reply) => {
      // Skip auth for public endpoints
      if (request.url === '/health' || request.url === '/api/downloads') return;

      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.code(401).send({ error: 'Missing or invalid Authorization header' });
      }

      const token = authHeader.slice(7);

      try {
        // Validate JWT access token scoped to the Ternity API resource
        const { payload } = await jwtVerify(token, jwks, {
          issuer,
          audience: apiResource,
        });

        // Access token has: sub, scope, roles (if urn:logto:scope:roles requested)
        // Profile fields (name, email, phone) are NOT in access tokens —
        // they come from the DB (populated during previous logins or sync).
        const scopes = ((payload.scope as string) ?? '').split(' ').filter(Boolean);
        const roles = (payload.roles as string[]) ?? [];

        // Determine global role from token scopes/roles
        const isAdmin = scopes.includes('admin') || roles.includes('admin');
        const globalRole = isAdmin ? GlobalRole.Admin : GlobalRole.User;

        // Look up or create user by Logto sub (with email auto-match)
        const user = await jitProvision({
          sub: payload.sub!,
          roles: isAdmin ? ['admin'] : [],
          logtoEndpoint: endpoint,
        });
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

  // ── Impersonation hook (runs after auth resolves the real user) ──
  fastify.addHook('onRequest', async (request, reply) => {
    if (request.url === '/health') return;
    if (!request.auth || request.auth.userId === 'unknown') return;

    const targetUserId = request.headers['x-impersonate-user-id'] as string | undefined;
    if (!targetUserId) return;

    // Only admins may impersonate
    if (request.auth.globalRole !== GlobalRole.Admin) {
      return reply.code(403).send({ error: 'Only admins can impersonate users' });
    }

    // Cannot impersonate yourself
    if (targetUserId === request.auth.userId) return;

    const [target] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);

    if (!target) {
      return reply.code(404).send({ error: 'Impersonation target not found' });
    }

    const realUserId = request.auth.userId;
    const orgRoles = await buildOrgRoles(target.id);

    request.auth = {
      userId: target.id,
      displayName: target.displayName,
      email: target.email,
      phone: target.phone,
      avatarUrl: target.avatarUrl,
      globalRole: target.globalRole as GlobalRole,
      orgRoles,
      impersonating: true,
      realUserId,
    };
  });
}

export default fp(authPlugin, { name: 'auth' });
