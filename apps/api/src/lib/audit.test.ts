import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, truncateAll } from '../../test/db.js';
import { clients, entryAuditLog, projects, timeEntries, users } from '../db/schema.js';
import { recordAudit, resolveProjectName } from './audit.js';

// Characterization tests for apps/api/src/lib/audit.ts.
// recordAudit and resolveProjectName both hit the DB — run against the live
// Testcontainers Postgres provided by the test harness (test/db.ts).

beforeEach(truncateAll);

// ─── helpers ──────────────────────────────────────────────────────────────────

async function makeUser(displayName = 'Elena Marsh') {
  const [u] = await db.insert(users).values({ displayName }).returning();
  return u!;
}

async function makeClient(name = 'Acme') {
  const [c] = await db.insert(clients).values({ name }).returning();
  return c!;
}

async function makeProject(clientId: string, name = 'Alpha') {
  const [p] = await db.insert(projects).values({ clientId, name }).returning();
  return p!;
}

async function makeEntry(userId: string, projectId?: string) {
  const [e] = await db
    .insert(timeEntries)
    .values({ userId, description: 'Work', ...(projectId ? { projectId } : {}) })
    .returning();
  return e!;
}

const auditFor = (entryId: string) =>
  db.select().from(entryAuditLog).where(eq(entryAuditLog.entryId, entryId));

// ─── resolveProjectName ───────────────────────────────────────────────────────

describe('resolveProjectName', () => {
  it('returns null for null input', async () => {
    expect(await resolveProjectName(null)).toBeNull();
  });

  it('returns null for undefined input', async () => {
    expect(await resolveProjectName(undefined)).toBeNull();
  });

  it('returns null for an empty string', async () => {
    // Empty string is falsy — same code path as null.
    expect(await resolveProjectName('')).toBeNull();
  });

  it('returns null when the project UUID does not exist in the DB', async () => {
    const result = await resolveProjectName('00000000-0000-0000-0000-000000000000');
    expect(result).toBeNull();
  });

  it('returns the project name when the UUID exists', async () => {
    const c = await makeClient();
    const p = await makeProject(c.id, 'Gamma Project');
    expect(await resolveProjectName(p.id)).toBe('Gamma Project');
  });

  it('distinguishes between two different projects', async () => {
    const c = await makeClient();
    const p1 = await makeProject(c.id, 'Project One');
    const p2 = await makeProject(c.id, 'Project Two');

    expect(await resolveProjectName(p1.id)).toBe('Project One');
    expect(await resolveProjectName(p2.id)).toBe('Project Two');
  });

  it('accepts a Drizzle transaction (tx parameter) and uses it', async () => {
    const c = await makeClient();
    const p = await makeProject(c.id, 'Tx Project');

    const nameInTx = await db.transaction(async (tx) => resolveProjectName(p.id, tx));
    expect(nameInTx).toBe('Tx Project');
  });
});

// ─── recordAudit ──────────────────────────────────────────────────────────────

describe('recordAudit', () => {
  it('inserts an audit row with the minimal required fields', async () => {
    const u = await makeUser();
    const e = await makeEntry(u.id);

    await recordAudit({
      entryId: e.id,
      userId: u.id,
      actorId: u.id,
      action: 'created',
    });

    const rows = await auditFor(e.id);
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.entryId).toBe(e.id);
    expect(row.userId).toBe(u.id);
    expect(row.actorId).toBe(u.id);
    expect(row.action).toBe('created');
    // omitted optional fields default to null
    expect(row.changes).toBeNull();
    expect(row.metadata).toBeNull();
    // createdAt is auto-set by the DB
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it('stores changes jsonb exactly as provided', async () => {
    const u = await makeUser();
    const e = await makeEntry(u.id);

    const changes = {
      description: { old: 'Task A', new: 'Task B' },
      projectId: { old: null, new: '11111111-1111-1111-1111-111111111111' },
    };

    await recordAudit({
      entryId: e.id,
      userId: u.id,
      actorId: u.id,
      action: 'updated',
      changes,
    });

    const [row] = await auditFor(e.id);
    expect(row!.changes).toEqual(changes);
  });

  it('stores metadata jsonb exactly as provided', async () => {
    const u = await makeUser();
    const e = await makeEntry(u.id);

    const metadata = { source: 'timer', clientVersion: '1.2.3', extra: { nested: true } };

    await recordAudit({
      entryId: e.id,
      userId: u.id,
      actorId: u.id,
      action: 'timer_started',
      metadata,
    });

    const [row] = await auditFor(e.id);
    expect(row!.metadata).toEqual(metadata);
  });

  it('supports actor different from entry owner (impersonation scenario)', async () => {
    const owner = await makeUser('James Oakley');
    const actor = await makeUser('Admin Actor');
    const e = await makeEntry(owner.id);

    await recordAudit({
      entryId: e.id,
      userId: owner.id,
      actorId: actor.id,
      action: 'updated',
    });

    const [row] = await auditFor(e.id);
    expect(row!.userId).toBe(owner.id);
    expect(row!.actorId).toBe(actor.id);
  });

  it('records multiple audit events for the same entry in insertion order', async () => {
    const u = await makeUser();
    const e = await makeEntry(u.id);

    await recordAudit({ entryId: e.id, userId: u.id, actorId: u.id, action: 'timer_started' });
    await recordAudit({ entryId: e.id, userId: u.id, actorId: u.id, action: 'timer_stopped' });
    await recordAudit({ entryId: e.id, userId: u.id, actorId: u.id, action: 'updated' });

    const rows = await db
      .select()
      .from(entryAuditLog)
      .where(eq(entryAuditLog.entryId, e.id))
      .orderBy(entryAuditLog.createdAt);

    expect(rows).toHaveLength(3);
    expect(rows[0]!.action).toBe('timer_started');
    expect(rows[1]!.action).toBe('timer_stopped');
    expect(rows[2]!.action).toBe('updated');
  });

  it('supports every defined AuditAction value', async () => {
    const u = await makeUser();
    const actions = [
      'created',
      'updated',
      'deleted',
      'timer_started',
      'timer_stopped',
      'timer_resumed',
      'adjustment_added',
      'block_moved',
      'entry_split',
    ] as const;

    for (const action of actions) {
      const e = await makeEntry(u.id);
      await recordAudit({ entryId: e.id, userId: u.id, actorId: u.id, action });
      const rows = await auditFor(e.id);
      expect(rows[0]!.action).toBe(action);
    }
  });

  it('silently swallows errors — does NOT throw when the insert fails', async () => {
    // Pass a non-existent entryId (FK violation) — recordAudit must not throw,
    // because audit failures must never break the main operation (per the comment
    // in audit.ts). This pins the "silent swallow" contract.
    const u = await makeUser();
    const bogusEntryId = '00000000-0000-0000-0000-000000000000';

    await expect(
      recordAudit({
        entryId: bogusEntryId,
        userId: u.id,
        actorId: u.id,
        action: 'created',
      }),
    ).resolves.toBeUndefined();

    // Nothing was inserted
    const rows = await auditFor(bogusEntryId);
    expect(rows).toHaveLength(0);
  });

  it('accepts a Drizzle transaction (tx parameter) and writes within it', async () => {
    const u = await makeUser();
    const e = await makeEntry(u.id);

    await db.transaction(async (tx) => {
      await recordAudit({ entryId: e.id, userId: u.id, actorId: u.id, action: 'created', tx });
    });

    const rows = await auditFor(e.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.action).toBe('created');
  });

  it('does not write the audit row when the transaction rolls back', async () => {
    const u = await makeUser();
    const e = await makeEntry(u.id);

    try {
      await db.transaction(async (tx) => {
        await recordAudit({ entryId: e.id, userId: u.id, actorId: u.id, action: 'created', tx });
        // Force rollback
        throw new Error('intentional rollback');
      });
    } catch {
      // expected
    }

    // NOTE: this test intentionally verifies the tx-scoping contract.
    // The row is NOT written when the surrounding transaction rolls back.
    const rows = await auditFor(e.id);
    expect(rows).toHaveLength(0);
  });
});
