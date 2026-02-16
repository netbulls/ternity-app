import { FastifyInstance } from 'fastify';
import { eq, asc, and } from 'drizzle-orm';
import { GlobalRole } from '@ternity/shared';
import { db } from '../db/index.js';
import { projects, clients, labels, users, projectMembers } from '../db/schema.js';

export async function referenceRoutes(fastify: FastifyInstance) {
  /** GET /api/projects — active projects with active clients (for pickers) */
  fastify.get('/api/projects', async (request) => {
    const rows = await db
      .select({
        id: projects.id,
        name: projects.name,
        color: projects.color,
        clientName: clients.name,
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(and(eq(projects.isActive, true), eq(clients.isActive, true)))
      .orderBy(asc(projects.name));

    return rows;
  });

  /** GET /api/labels — all labels */
  fastify.get('/api/labels', async () => {
    const rows = await db
      .select({
        id: labels.id,
        name: labels.name,
        color: labels.color,
      })
      .from(labels)
      .orderBy(asc(labels.name));

    return rows;
  });

  /** GET /api/users — all users (admin only, for impersonation picker) */
  fastify.get('/api/users', async (request, reply) => {
    // Allow for both real admins and impersonating admins
    const isAdmin =
      request.auth.globalRole === GlobalRole.Admin ||
      (request.auth.impersonating && request.auth.realUserId);

    // Actually, only the real admin role matters for user listing
    // If impersonating a non-admin, the realUserId check lets them still list
    // But simpler: check if the REAL user is admin
    const realRole = request.auth.impersonating
      ? GlobalRole.Admin // if impersonating, the real user was already verified as admin
      : request.auth.globalRole;

    if (realRole !== GlobalRole.Admin) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const rows = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        email: users.email,
        avatarUrl: users.avatarUrl,
        globalRole: users.globalRole,
        active: users.active,
      })
      .from(users)
      .orderBy(asc(users.displayName));

    return rows;
  });
}
