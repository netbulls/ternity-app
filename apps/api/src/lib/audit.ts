import { eq } from 'drizzle-orm';
import { db, type Database } from '../db/index.js';
import { entryAuditLog, projects } from '../db/schema.js';

type AuditAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'timer_started'
  | 'timer_stopped'
  | 'timer_resumed'
  | 'adjustment_added';

interface RecordAuditParams {
  entryId: string;
  userId: string;
  actorId: string;
  action: AuditAction;
  changes?: Record<string, { old?: unknown; new?: unknown }>;
  metadata?: Record<string, unknown>;
  tx?: Database;
}

/** Resolve a project UUID to its name. Returns null for null/missing projects. */
export async function resolveProjectName(projectId: string | null | undefined, tx?: Database): Promise<string | null> {
  if (!projectId) return null;
  const conn = tx ?? db;
  const [row] = await conn
    .select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return row?.name ?? null;
}

export async function recordAudit(params: RecordAuditParams): Promise<void> {
  try {
    const conn = params.tx ?? db;
    await conn.insert(entryAuditLog).values({
      entryId: params.entryId,
      userId: params.userId,
      actorId: params.actorId,
      action: params.action,
      changes: params.changes ?? null,
      metadata: params.metadata ?? null,
    });
  } catch (err) {
    // Audit failures must never break the main operation
    console.error('Failed to record audit event:', err);
  }
}
