import { FastifyInstance } from 'fastify';
import { eq, asc, sql, and, ne } from 'drizzle-orm';
import { GlobalRole } from '@ternity/shared';
import { db } from '../db/index.js';
import { leaveTypes, leaveTypeGroups } from '../db/schema.js';

/** Check that the REAL user (not impersonated) is admin */
function isRealAdmin(request: { auth: { globalRole: string; impersonating?: boolean } }) {
  if (request.auth.impersonating) return true;
  return request.auth.globalRole === GlobalRole.Admin;
}

export async function adminLeaveTypesRoutes(fastify: FastifyInstance) {
  // ── Groups ─────────────────────────────────────────────────────────────

  /** GET /api/admin/leave-type-groups — list all groups with type counts */
  fastify.get('/api/admin/leave-type-groups', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const groups = await db
      .select({
        id: leaveTypeGroups.id,
        name: leaveTypeGroups.name,
        color: leaveTypeGroups.color,
        sortOrder: leaveTypeGroups.sortOrder,
        createdAt: leaveTypeGroups.createdAt,
        typeCount: sql<number>`CAST(COUNT(${leaveTypes.id}) AS int)`,
        activeTypeCount: sql<number>`CAST(COUNT(${leaveTypes.id}) FILTER (WHERE ${leaveTypes.active} = true) AS int)`,
      })
      .from(leaveTypeGroups)
      .leftJoin(leaveTypes, eq(leaveTypes.groupId, leaveTypeGroups.id))
      .groupBy(leaveTypeGroups.id)
      .orderBy(asc(leaveTypeGroups.sortOrder), asc(leaveTypeGroups.name));

    return groups;
  });

  /** POST /api/admin/leave-type-groups — create a group */
  fastify.post('/api/admin/leave-type-groups', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { name, color } = request.body as { name: string; color: string };
    if (!name?.trim() || !color?.trim()) {
      return reply.code(400).send({ error: 'Name and color are required' });
    }

    // Auto-assign sort order as max + 1
    const maxOrder = await db
      .select({ max: sql<number>`COALESCE(MAX(${leaveTypeGroups.sortOrder}), -1)` })
      .from(leaveTypeGroups);
    const sortOrder = (maxOrder[0]?.max ?? -1) + 1;

    const [group] = await db
      .insert(leaveTypeGroups)
      .values({ name: name.trim(), color: color.trim(), sortOrder })
      .returning();

    return group;
  });

  /** PATCH /api/admin/leave-type-groups/:id — update a group */
  fastify.patch('/api/admin/leave-type-groups/:id', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { id } = request.params as { id: string };
    const { name, color, sortOrder } = request.body as {
      name?: string;
      color?: string;
      sortOrder?: number;
    };

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (color !== undefined) updates.color = color.trim();
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;

    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({ error: 'No fields to update' });
    }

    const [updated] = await db
      .update(leaveTypeGroups)
      .set(updates)
      .where(eq(leaveTypeGroups.id, id))
      .returning();

    if (!updated) {
      return reply.code(404).send({ error: 'Group not found' });
    }

    return updated;
  });

  /** DELETE /api/admin/leave-type-groups/:id — delete a group (unassigns types) */
  fastify.delete('/api/admin/leave-type-groups/:id', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { id } = request.params as { id: string };

    // Unassign any leave types in this group first
    await db.update(leaveTypes).set({ groupId: null }).where(eq(leaveTypes.groupId, id));

    const [deleted] = await db
      .delete(leaveTypeGroups)
      .where(eq(leaveTypeGroups.id, id))
      .returning();

    if (!deleted) {
      return reply.code(404).send({ error: 'Group not found' });
    }

    return { ok: true };
  });

  // ── Leave Types (admin management) ─────────────────────────────────────

  /** GET /api/admin/leave-types — list all leave types with group info (admin view, no filtering) */
  fastify.get('/api/admin/leave-types', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const types = await db
      .select({
        id: leaveTypes.id,
        name: leaveTypes.name,
        daysPerYear: leaveTypes.daysPerYear,
        color: leaveTypes.color,
        deducted: leaveTypes.deducted,
        groupId: leaveTypes.groupId,
        active: leaveTypes.active,
        visibility: leaveTypes.visibility,
        isContractorDefault: leaveTypes.isContractorDefault,
      })
      .from(leaveTypes)
      .orderBy(sql`${leaveTypes.isContractorDefault} DESC`, asc(leaveTypes.name));

    return types;
  });

  /** POST /api/admin/leave-types — create a new leave type */
  fastify.post('/api/admin/leave-types', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { name, daysPerYear, color, deducted, groupId, visibility } = request.body as {
      name: string;
      daysPerYear: number;
      color?: string | null;
      deducted?: boolean;
      groupId?: string | null;
      visibility?: string;
    };

    if (!name?.trim()) {
      return reply.code(400).send({ error: 'Name is required' });
    }
    if (daysPerYear == null || daysPerYear < 0) {
      return reply.code(400).send({ error: 'Days per year must be 0 or greater' });
    }
    if (visibility && !['all', 'contractor', 'employee'].includes(visibility)) {
      return reply.code(400).send({ error: 'Invalid visibility value' });
    }

    const [created] = await db
      .insert(leaveTypes)
      .values({
        name: name.trim(),
        daysPerYear,
        color: color ?? null,
        deducted: deducted ?? true,
        groupId: groupId ?? null,
        visibility: visibility ?? 'all',
      })
      .returning();

    return created;
  });

  /** PATCH /api/admin/leave-types/:id — update a leave type's admin fields */
  fastify.patch('/api/admin/leave-types/:id', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { id } = request.params as { id: string };
    const { groupId, active, visibility, color, name, isContractorDefault } = request.body as {
      groupId?: string | null;
      active?: boolean;
      visibility?: string;
      color?: string | null;
      name?: string;
      isContractorDefault?: boolean;
    };

    // Check if this type is currently the contractor default (for protection rules)
    const [existing] = await db
      .select({ isContractorDefault: leaveTypes.isContractorDefault })
      .from(leaveTypes)
      .where(eq(leaveTypes.id, id));

    if (!existing) {
      return reply.code(404).send({ error: 'Leave type not found' });
    }

    // Protect the contractor default from being deactivated
    if (existing.isContractorDefault && active === false) {
      return reply.code(400).send({ error: 'Cannot deactivate the contractor default leave type' });
    }

    // Protect the contractor default from having visibility set to employee-only
    if (existing.isContractorDefault && visibility === 'employee') {
      return reply
        .code(400)
        .send({ error: 'Contractor default leave type must be visible to contractors' });
    }

    const updates: Record<string, unknown> = {};
    if (groupId !== undefined) updates.groupId = groupId;
    if (active !== undefined) updates.active = active;
    if (visibility !== undefined) {
      if (!['all', 'contractor', 'employee'].includes(visibility)) {
        return reply.code(400).send({ error: 'Invalid visibility value' });
      }
      updates.visibility = visibility;
    }
    if (color !== undefined) updates.color = color;
    if (name !== undefined) updates.name = name.trim();

    // Handle contractor default toggle (radio-style: only one can be true)
    if (isContractorDefault === true) {
      // Clear the flag from any other leave type first
      await db
        .update(leaveTypes)
        .set({ isContractorDefault: false })
        .where(and(eq(leaveTypes.isContractorDefault, true), ne(leaveTypes.id, id)));
      updates.isContractorDefault = true;
      // Ensure the type is active and visible to contractors
      updates.active = true;
      if (visibility === 'employee') {
        return reply
          .code(400)
          .send({ error: 'Contractor default leave type must be visible to contractors' });
      }
    } else if (isContractorDefault === false) {
      // Cannot unset the contractor default — must set another type instead
      if (existing.isContractorDefault) {
        return reply
          .code(400)
          .send({ error: 'Cannot unset contractor default — set another type as default instead' });
      }
    }

    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({ error: 'No fields to update' });
    }

    const [updated] = await db
      .update(leaveTypes)
      .set(updates)
      .where(eq(leaveTypes.id, id))
      .returning();

    if (!updated) {
      return reply.code(404).send({ error: 'Leave type not found' });
    }

    return updated;
  });

  /** PATCH /api/admin/leave-types/bulk — bulk update leave types (e.g., assign group) */
  fastify.patch('/api/admin/leave-types/bulk', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { ids, groupId, active, visibility } = request.body as {
      ids: string[];
      groupId?: string | null;
      active?: boolean;
      visibility?: string;
    };

    if (!ids?.length) {
      return reply.code(400).send({ error: 'ids array is required' });
    }

    // Protect contractor default from bulk deactivation or visibility change
    if (active === false || visibility === 'employee') {
      const [defaultInBatch] = await db
        .select({ id: leaveTypes.id })
        .from(leaveTypes)
        .where(sql`${leaveTypes.id} = ANY(${ids}) AND ${leaveTypes.isContractorDefault} = true`);
      if (defaultInBatch) {
        const msg =
          active === false
            ? 'Cannot deactivate the contractor default leave type'
            : 'Contractor default leave type must be visible to contractors';
        return reply.code(400).send({ error: msg });
      }
    }

    const updates: Record<string, unknown> = {};
    if (groupId !== undefined) updates.groupId = groupId;
    if (active !== undefined) updates.active = active;
    if (visibility !== undefined) {
      if (!['all', 'contractor', 'employee'].includes(visibility)) {
        return reply.code(400).send({ error: 'Invalid visibility value' });
      }
      updates.visibility = visibility;
    }

    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({ error: 'No fields to update' });
    }

    const { rowCount } = await db
      .update(leaveTypes)
      .set(updates)
      .where(sql`${leaveTypes.id} = ANY(${ids})`);

    return { updated: rowCount };
  });

  /** DELETE /api/admin/leave-types/:id — delete a leave type (contractor default is protected) */
  fastify.delete('/api/admin/leave-types/:id', async (request, reply) => {
    if (!isRealAdmin(request)) {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const { id } = request.params as { id: string };

    // Check if this is the contractor default
    const [existing] = await db
      .select({ isContractorDefault: leaveTypes.isContractorDefault })
      .from(leaveTypes)
      .where(eq(leaveTypes.id, id));

    if (!existing) {
      return reply.code(404).send({ error: 'Leave type not found' });
    }

    if (existing.isContractorDefault) {
      return reply.code(400).send({ error: 'Cannot delete the contractor default leave type' });
    }

    await db.delete(leaveTypes).where(eq(leaveTypes.id, id));

    return { ok: true };
  });
}
