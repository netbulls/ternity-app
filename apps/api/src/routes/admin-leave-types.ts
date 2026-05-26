import { FastifyInstance } from 'fastify';
import { eq, asc, sql, and, ne, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { GlobalRole } from '@ternity/shared';
import { db } from '../db/index.js';
import { leaveTypes, leaveTypeGroups } from '../db/schema.js';

/** Check that the REAL user (not impersonated) is admin */
function isRealAdmin(request: { auth: { globalRole: string; impersonating?: boolean } }) {
  if (request.auth.impersonating) return true;
  return request.auth.globalRole === GlobalRole.Admin;
}

// Request-body schemas — validated at the boundary so malformed input is a 400
// (via the global ZodError handler) instead of crashing with a 500.
const VisibilityEnum = z.enum(['all', 'contractor', 'employee']);
const CreateGroupSchema = z.object({
  name: z.string().trim().min(1),
  color: z.string().trim().min(1),
});
const UpdateGroupSchema = z.object({
  name: z.string().trim().min(1).optional(),
  color: z.string().trim().min(1).optional(),
  sortOrder: z.number().int().optional(),
});
const CreateLeaveTypeSchema = z.object({
  name: z.string().trim().min(1),
  daysPerYear: z.number().min(0),
  color: z.string().nullish(),
  deducted: z.boolean().optional(),
  groupId: z.string().uuid().nullish(),
  visibility: VisibilityEnum.optional(),
});
const UpdateLeaveTypeSchema = z.object({
  groupId: z.string().uuid().nullish(),
  active: z.boolean().optional(),
  visibility: VisibilityEnum.optional(),
  color: z.string().nullish(),
  name: z.string().trim().min(1).optional(),
  isContractorDefault: z.boolean().optional(),
});
const BulkLeaveTypesSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  groupId: z.string().uuid().nullish(),
  active: z.boolean().optional(),
  visibility: VisibilityEnum.optional(),
});

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

    const { name, color } = CreateGroupSchema.parse(request.body);

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
    const { name, color, sortOrder } = UpdateGroupSchema.parse(request.body);

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

    const { name, daysPerYear, color, deducted, groupId, visibility } =
      CreateLeaveTypeSchema.parse(request.body);

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
    const { groupId, active, visibility, color, name, isContractorDefault } =
      UpdateLeaveTypeSchema.parse(request.body);

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
    if (visibility !== undefined) updates.visibility = visibility;
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

    const { ids, groupId, active, visibility } = BulkLeaveTypesSchema.parse(request.body);

    // Protect contractor default from bulk deactivation or visibility change
    if (active === false || visibility === 'employee') {
      const [defaultInBatch] = await db
        .select({ id: leaveTypes.id })
        .from(leaveTypes)
        .where(and(inArray(leaveTypes.id, ids), eq(leaveTypes.isContractorDefault, true)));
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
    if (visibility !== undefined) updates.visibility = visibility;

    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({ error: 'No fields to update' });
    }

    const { rowCount } = await db
      .update(leaveTypes)
      .set(updates)
      .where(inArray(leaveTypes.id, ids));

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
