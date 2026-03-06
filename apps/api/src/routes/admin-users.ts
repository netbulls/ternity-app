import { FastifyInstance } from 'fastify';
import { eq, sql, asc, ilike, or, and, inArray } from 'drizzle-orm';
import { GlobalRole } from '@ternity/shared';
import { db } from '../db/index.js';
import { users, timeEntries, projects, clients } from '../db/schema.js';

/** Check that the REAL user (not impersonated) is admin */
function isRealAdmin(request: { auth: { globalRole: string; impersonating?: boolean } }) {
  if (request.auth.impersonating) {
    // If impersonating, the real user was already verified as admin by the auth plugin
    return true;
  }
  return request.auth.globalRole === GlobalRole.Admin;
}

export async function adminUsersRoutes(fastify: FastifyInstance) {
  /** GET /api/admin/users — list all users with activity stats */
  fastify.get('/api/admin/users', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { status, search } = request.query as {
      status?: string;
      search?: string;
    };

    const conditions = [];

    // Filter by active status
    if (status === 'active') {
      conditions.push(eq(users.active, true));
    } else if (status === 'inactive') {
      conditions.push(eq(users.active, false));
    }

    // Filter by search term
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push(or(ilike(users.displayName, term), ilike(users.email, term))!);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        email: users.email,
        avatarUrl: users.avatarUrl,
        globalRole: users.globalRole,
        employmentType: users.employmentType,
        active: users.active,
        teamId: users.defaultProjectId,
        teamName: projects.name,
        teamColor: projects.color,
        teamClientName: clients.name,
        entryCount: sql<number>`cast(count(${timeEntries.id}) as int)`,
        lastEntryAt: sql<string | null>`max(${timeEntries.createdAt})`,
      })
      .from(users)
      .leftJoin(timeEntries, eq(timeEntries.userId, users.id))
      .leftJoin(projects, eq(users.defaultProjectId, projects.id))
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(where)
      .groupBy(users.id, projects.id, clients.id)
      .orderBy(asc(users.displayName));

    return rows;
  });

  /** PATCH /api/admin/users/:id/team */
  fastify.patch('/api/admin/users/:id/team', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { id } = request.params as { id: string };
    const { projectId } = request.body as { projectId: string | null };

    // Validate project exists if setting (not clearing)
    if (projectId) {
      const [project] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, projectId));

      if (!project) {
        return reply.code(400).send({ error: 'Project not found' });
      }
    }

    const [updated] = await db
      .update(users)
      .set({ defaultProjectId: projectId ?? null, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning({ id: users.id });

    if (!updated) {
      return reply.code(404).send({ error: 'User not found' });
    }

    return { success: true };
  });

  /** PATCH /api/admin/users/:id/employment-type */
  fastify.patch('/api/admin/users/:id/employment-type', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { id } = request.params as { id: string };
    const { employmentType } = request.body as { employmentType: string };

    if (!employmentType || !['contractor', 'employee'].includes(employmentType)) {
      return reply.code(400).send({ error: 'employmentType must be "contractor" or "employee"' });
    }

    const [updated] = await db
      .update(users)
      .set({ employmentType, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning({ id: users.id });

    if (!updated) {
      return reply.code(404).send({ error: 'User not found' });
    }

    return { success: true };
  });

  /** PATCH /api/admin/users/:id/activate */
  fastify.patch('/api/admin/users/:id/activate', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { id } = request.params as { id: string };

    const [updated] = await db.transaction(async (tx) => {
      return tx
        .update(users)
        .set({ active: true, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning({ id: users.id });
    });

    if (!updated) {
      return reply.code(404).send({ error: 'User not found' });
    }

    return { success: true };
  });

  /** PATCH /api/admin/users/:id/deactivate */
  fastify.patch('/api/admin/users/:id/deactivate', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { id } = request.params as { id: string };

    const [updated] = await db.transaction(async (tx) => {
      return tx
        .update(users)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning({ id: users.id });
    });

    if (!updated) {
      return reply.code(404).send({ error: 'User not found' });
    }

    return { success: true };
  });

  /** POST /api/admin/users/bulk-activate */
  fastify.post('/api/admin/users/bulk-activate', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { userIds } = request.body as { userIds: string[] };

    if (!userIds?.length) {
      return reply.code(400).send({ error: 'userIds is required' });
    }

    const updated = await db.transaction(async (tx) => {
      return tx
        .update(users)
        .set({ active: true, updatedAt: new Date() })
        .where(inArray(users.id, userIds))
        .returning({ id: users.id });
    });

    return { success: true, count: updated.length };
  });

  /** POST /api/admin/users/bulk-deactivate */
  fastify.post('/api/admin/users/bulk-deactivate', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { userIds } = request.body as { userIds: string[] };

    if (!userIds?.length) {
      return reply.code(400).send({ error: 'userIds is required' });
    }

    const updated = await db.transaction(async (tx) => {
      return tx
        .update(users)
        .set({ active: false, updatedAt: new Date() })
        .where(inArray(users.id, userIds))
        .returning({ id: users.id });
    });

    return { success: true, count: updated.length };
  });
}
