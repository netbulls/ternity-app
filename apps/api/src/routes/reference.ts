import { FastifyInstance } from 'fastify';
import { eq, asc, and } from 'drizzle-orm';
import { GlobalRole, CreateTagSchema, UpdateTagSchema } from '@ternity/shared';
import { db } from '../db/index.js';
import { projects, clients, tags, entryTags, users, projectMembers } from '../db/schema.js';

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

  /** GET /api/tags — tags for the authenticated user */
  fastify.get('/api/tags', async (request) => {
    const userId = request.auth.userId;
    const rows = await db
      .select({
        id: tags.id,
        name: tags.name,
        color: tags.color,
      })
      .from(tags)
      .where(eq(tags.userId, userId))
      .orderBy(asc(tags.name));

    return rows;
  });

  /** POST /api/tags — create a new tag for the authenticated user */
  fastify.post('/api/tags', async (request, reply) => {
    const userId = request.auth.userId;
    const parsed = CreateTagSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid tag data', details: parsed.error.flatten() });
    }

    const { name, color } = parsed.data;
    const [created] = await db
      .insert(tags)
      .values({ name, color: color ?? null, userId })
      .returning({ id: tags.id, name: tags.name, color: tags.color });

    return reply.code(201).send(created);
  });

  /** PATCH /api/tags/:id — update a tag (own tags only) */
  fastify.patch('/api/tags/:id', async (request, reply) => {
    const userId = request.auth.userId;
    const { id } = request.params as { id: string };
    const parsed = UpdateTagSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid tag data', details: parsed.error.flatten() });
    }

    // Verify ownership
    const [existing] = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.id, id), eq(tags.userId, userId)));

    if (!existing) {
      return reply.code(404).send({ error: 'Tag not found' });
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.color !== undefined) updates.color = parsed.data.color;

    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({ error: 'No fields to update' });
    }

    const [updated] = await db
      .update(tags)
      .set(updates)
      .where(eq(tags.id, id))
      .returning({ id: tags.id, name: tags.name, color: tags.color });

    return updated;
  });

  /** DELETE /api/tags/:id — delete a tag (own tags only, removes entry_tags associations) */
  fastify.delete('/api/tags/:id', async (request, reply) => {
    const userId = request.auth.userId;
    const { id } = request.params as { id: string };

    // Verify ownership
    const [existing] = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.id, id), eq(tags.userId, userId)));

    if (!existing) {
      return reply.code(404).send({ error: 'Tag not found' });
    }

    // Remove entry_tags associations first, then the tag
    await db.delete(entryTags).where(eq(entryTags.tagId, id));
    await db.delete(tags).where(eq(tags.id, id));

    return reply.code(204).send();
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
