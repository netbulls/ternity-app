import { FastifyInstance } from 'fastify';
import { eq, sql, asc, and, inArray } from 'drizzle-orm';
import {
  GlobalRole,
  CreateProjectSchema,
  UpdateProjectSchema,
  CreateClientSchema,
  UpdateClientSchema,
} from '@ternity/shared';
import { db } from '../db/index.js';
import { projects, clients, timeEntries } from '../db/schema.js';

/** Check that the REAL user (not impersonated) is admin */
function isRealAdmin(request: { auth: { globalRole: string; impersonating?: boolean } }) {
  if (request.auth.impersonating) {
    return true;
  }
  return request.auth.globalRole === GlobalRole.Admin;
}

export async function adminProjectsRoutes(fastify: FastifyInstance) {
  // ── Projects ────────────────────────────────────────────────────────

  /** GET /api/admin/projects — all projects with client info and entry counts */
  fastify.get('/api/admin/projects', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const rows = await db
      .select({
        id: projects.id,
        name: projects.name,
        color: projects.color,
        description: projects.description,
        isActive: projects.isActive,
        clientId: projects.clientId,
        clientName: clients.name,
        clientIsActive: clients.isActive,
        entryCount: sql<number>`cast(count(${timeEntries.id}) as int)`,
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .leftJoin(timeEntries, eq(timeEntries.projectId, projects.id))
      .groupBy(projects.id, clients.name, clients.isActive)
      .orderBy(asc(projects.name));

    return rows;
  });

  /** POST /api/admin/projects — create project */
  fastify.post('/api/admin/projects', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const parsed = CreateProjectSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const { name, clientId, color, description } = parsed.data;

    const [created] = await db
      .insert(projects)
      .values({
        name,
        clientId,
        ...(color && { color }),
        ...(description && { description }),
      })
      .returning();

    return reply.code(201).send(created);
  });

  /** PATCH /api/admin/projects/:id — update project */
  fastify.patch('/api/admin/projects/:id', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { id } = request.params as { id: string };
    const parsed = UpdateProjectSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.clientId !== undefined) updates.clientId = parsed.data.clientId;
    if (parsed.data.color !== undefined) updates.color = parsed.data.color;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;

    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({ error: 'No fields to update' });
    }

    const [updated] = await db
      .update(projects)
      .set(updates)
      .where(eq(projects.id, id))
      .returning();

    if (!updated) {
      return reply.code(404).send({ error: 'Project not found' });
    }

    return updated;
  });

  /** PATCH /api/admin/projects/:id/activate */
  fastify.patch('/api/admin/projects/:id/activate', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { id } = request.params as { id: string };
    const [updated] = await db
      .update(projects)
      .set({ isActive: true })
      .where(eq(projects.id, id))
      .returning({ id: projects.id });

    if (!updated) {
      return reply.code(404).send({ error: 'Project not found' });
    }

    return { success: true };
  });

  /** PATCH /api/admin/projects/:id/deactivate */
  fastify.patch('/api/admin/projects/:id/deactivate', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { id } = request.params as { id: string };
    const [updated] = await db
      .update(projects)
      .set({ isActive: false })
      .where(eq(projects.id, id))
      .returning({ id: projects.id });

    if (!updated) {
      return reply.code(404).send({ error: 'Project not found' });
    }

    return { success: true };
  });

  /** POST /api/admin/projects/bulk-activate */
  fastify.post('/api/admin/projects/bulk-activate', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { projectIds } = request.body as { projectIds: string[] };
    if (!projectIds?.length) {
      return reply.code(400).send({ error: 'projectIds is required' });
    }

    const updated = await db
      .update(projects)
      .set({ isActive: true })
      .where(inArray(projects.id, projectIds))
      .returning({ id: projects.id });

    return { success: true, count: updated.length };
  });

  /** POST /api/admin/projects/bulk-deactivate */
  fastify.post('/api/admin/projects/bulk-deactivate', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { projectIds } = request.body as { projectIds: string[] };
    if (!projectIds?.length) {
      return reply.code(400).send({ error: 'projectIds is required' });
    }

    const updated = await db
      .update(projects)
      .set({ isActive: false })
      .where(inArray(projects.id, projectIds))
      .returning({ id: projects.id });

    return { success: true, count: updated.length };
  });

  // ── Clients ─────────────────────────────────────────────────────────

  /** GET /api/admin/clients — all clients with project and entry counts */
  fastify.get('/api/admin/clients', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const rows = await db
      .select({
        id: clients.id,
        name: clients.name,
        isActive: clients.isActive,
        projectCount: sql<number>`cast(count(distinct ${projects.id}) as int)`,
        activeProjectCount: sql<number>`cast(count(distinct case when ${projects.isActive} = true then ${projects.id} end) as int)`,
        entryCount: sql<number>`cast(count(distinct ${timeEntries.id}) as int)`,
      })
      .from(clients)
      .leftJoin(projects, eq(projects.clientId, clients.id))
      .leftJoin(timeEntries, eq(timeEntries.projectId, projects.id))
      .groupBy(clients.id)
      .orderBy(asc(clients.name));

    return rows;
  });

  /** POST /api/admin/clients — create client */
  fastify.post('/api/admin/clients', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const parsed = CreateClientSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const [created] = await db
      .insert(clients)
      .values({ name: parsed.data.name })
      .returning();

    return reply.code(201).send(created);
  });

  /** PATCH /api/admin/clients/:id — update (rename) client */
  fastify.patch('/api/admin/clients/:id', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { id } = request.params as { id: string };
    const parsed = UpdateClientSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const [updated] = await db
      .update(clients)
      .set({ name: parsed.data.name })
      .where(eq(clients.id, id))
      .returning();

    if (!updated) {
      return reply.code(404).send({ error: 'Client not found' });
    }

    return updated;
  });

  /** PATCH /api/admin/clients/:id/activate */
  fastify.patch('/api/admin/clients/:id/activate', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { id } = request.params as { id: string };
    const [updated] = await db
      .update(clients)
      .set({ isActive: true })
      .where(eq(clients.id, id))
      .returning({ id: clients.id });

    if (!updated) {
      return reply.code(404).send({ error: 'Client not found' });
    }

    return { success: true };
  });

  /** PATCH /api/admin/clients/:id/deactivate */
  fastify.patch('/api/admin/clients/:id/deactivate', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { id } = request.params as { id: string };
    const [updated] = await db
      .update(clients)
      .set({ isActive: false })
      .where(eq(clients.id, id))
      .returning({ id: clients.id });

    if (!updated) {
      return reply.code(404).send({ error: 'Client not found' });
    }

    return { success: true };
  });

  /** POST /api/admin/clients/bulk-activate */
  fastify.post('/api/admin/clients/bulk-activate', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { clientIds } = request.body as { clientIds: string[] };
    if (!clientIds?.length) {
      return reply.code(400).send({ error: 'clientIds is required' });
    }

    const updated = await db
      .update(clients)
      .set({ isActive: true })
      .where(inArray(clients.id, clientIds))
      .returning({ id: clients.id });

    return { success: true, count: updated.length };
  });

  /** POST /api/admin/clients/bulk-deactivate */
  fastify.post('/api/admin/clients/bulk-deactivate', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { clientIds } = request.body as { clientIds: string[] };
    if (!clientIds?.length) {
      return reply.code(400).send({ error: 'clientIds is required' });
    }

    const updated = await db
      .update(clients)
      .set({ isActive: false })
      .where(inArray(clients.id, clientIds))
      .returning({ id: clients.id });

    return { success: true, count: updated.length };
  });
}
