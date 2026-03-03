import { FastifyInstance } from 'fastify';
import { eq, and, inArray, asc, sql } from 'drizzle-orm';
import {
  GlobalRole,
  SetProjectMemberSchema,
  BulkSetProjectMembersSchema,
  BulkRemoveProjectMembersSchema,
  UpdateMemberRoleSchema,
  SetUserProjectSchema,
} from '@ternity/shared';
import { db } from '../db/index.js';
import { projectMembers, users, projects, clients } from '../db/schema.js';

/** Check that the REAL user (not impersonated) is admin */
function isRealAdmin(request: { auth: { globalRole: string; impersonating?: boolean } }) {
  if (request.auth.impersonating) return true;
  return request.auth.globalRole === GlobalRole.Admin;
}

export async function adminProjectMembersRoutes(fastify: FastifyInstance) {
  // ── Project → Users (V5 Bulk Matrix) ──────────────────────────────

  /** GET /api/admin/projects/:projectId/members — all users with assignment status */
  fastify.get('/api/admin/projects/:projectId/members', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { projectId } = request.params as { projectId: string };

    // Get all active users with their membership status for this project
    const rows = await db
      .select({
        userId: users.id,
        displayName: users.displayName,
        email: users.email,
        avatarUrl: users.avatarUrl,
        globalRole: users.globalRole,
        active: users.active,
        role: projectMembers.role,
      })
      .from(users)
      .leftJoin(
        projectMembers,
        and(eq(projectMembers.userId, users.id), eq(projectMembers.projectId, projectId)),
      )
      .orderBy(asc(users.displayName));

    return rows.map((r) => ({
      userId: r.userId,
      displayName: r.displayName,
      email: r.email,
      avatarUrl: r.avatarUrl,
      globalRole: r.globalRole,
      active: r.active,
      role: r.role ?? 'user',
      assigned: r.role !== null,
    }));
  });

  /** POST /api/admin/projects/:projectId/members — assign a user */
  fastify.post('/api/admin/projects/:projectId/members', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { projectId } = request.params as { projectId: string };
    const parsed = SetProjectMemberSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const { userId, role } = parsed.data;

    await db
      .insert(projectMembers)
      .values({ userId, projectId, role })
      .onConflictDoUpdate({
        target: [projectMembers.userId, projectMembers.projectId],
        set: { role },
      });

    return { success: true };
  });

  /** PATCH /api/admin/projects/:projectId/members/:userId — update role */
  fastify.patch('/api/admin/projects/:projectId/members/:userId', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { projectId, userId } = request.params as { projectId: string; userId: string };
    const parsed = UpdateMemberRoleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const [updated] = await db
      .update(projectMembers)
      .set({ role: parsed.data.role })
      .where(and(eq(projectMembers.userId, userId), eq(projectMembers.projectId, projectId)))
      .returning();

    if (!updated) {
      return reply.code(404).send({ error: 'Membership not found' });
    }

    return { success: true };
  });

  /** DELETE /api/admin/projects/:projectId/members/:userId — remove a user */
  fastify.delete('/api/admin/projects/:projectId/members/:userId', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { projectId, userId } = request.params as { projectId: string; userId: string };

    await db
      .delete(projectMembers)
      .where(and(eq(projectMembers.userId, userId), eq(projectMembers.projectId, projectId)));

    return { success: true };
  });

  /** POST /api/admin/projects/:projectId/members/bulk-assign — bulk assign users */
  fastify.post('/api/admin/projects/:projectId/members/bulk-assign', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { projectId } = request.params as { projectId: string };
    const parsed = BulkSetProjectMembersSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const { userIds, role } = parsed.data;

    await db.transaction(async (tx) => {
      for (const userId of userIds) {
        await tx
          .insert(projectMembers)
          .values({ userId, projectId, role })
          .onConflictDoUpdate({
            target: [projectMembers.userId, projectMembers.projectId],
            set: { role },
          });
      }
    });

    return { success: true, count: userIds.length };
  });

  /** POST /api/admin/projects/:projectId/members/bulk-remove — bulk remove users */
  fastify.post('/api/admin/projects/:projectId/members/bulk-remove', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { projectId } = request.params as { projectId: string };
    const parsed = BulkRemoveProjectMembersSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const { userIds } = parsed.data;

    await db
      .delete(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), inArray(projectMembers.userId, userIds)));

    return { success: true, count: userIds.length };
  });

  // ── User → Projects (V4 Inline Table) ─────────────────────────────

  /** GET /api/admin/users/:userId/projects — all projects with assignment status */
  fastify.get('/api/admin/users/:userId/projects', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { userId } = request.params as { userId: string };

    const rows = await db
      .select({
        projectId: projects.id,
        projectName: projects.name,
        projectColor: projects.color,
        clientName: clients.name,
        isActive: projects.isActive,
        role: projectMembers.role,
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .leftJoin(
        projectMembers,
        and(eq(projectMembers.projectId, projects.id), eq(projectMembers.userId, userId)),
      )
      .orderBy(asc(projects.name));

    return rows.map((r) => ({
      projectId: r.projectId,
      projectName: r.projectName,
      projectColor: r.projectColor,
      clientName: r.clientName,
      isActive: r.isActive,
      role: r.role ?? 'user',
      assigned: r.role !== null,
    }));
  });

  /** POST /api/admin/users/:userId/projects — assign a project */
  fastify.post('/api/admin/users/:userId/projects', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { userId } = request.params as { userId: string };
    const parsed = SetUserProjectSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const { projectId, role } = parsed.data;

    await db
      .insert(projectMembers)
      .values({ userId, projectId, role })
      .onConflictDoUpdate({
        target: [projectMembers.userId, projectMembers.projectId],
        set: { role },
      });

    return { success: true };
  });

  /** DELETE /api/admin/users/:userId/projects/:projectId — remove a project */
  fastify.delete('/api/admin/users/:userId/projects/:projectId', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { userId, projectId } = request.params as { userId: string; projectId: string };

    await db
      .delete(projectMembers)
      .where(and(eq(projectMembers.userId, userId), eq(projectMembers.projectId, projectId)));

    return { success: true };
  });
}
