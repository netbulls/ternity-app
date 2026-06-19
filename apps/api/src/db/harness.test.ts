import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, truncateAll } from '../../test/db.js';
import { users } from './schema.js';

// Verifies the test DB harness end-to-end: migrations applied (real schema),
// drizzle round-trips against a live Postgres, and truncateAll resets state.

describe('test DB harness', () => {
  beforeEach(truncateAll);

  it('applies migrations and round-trips a user with schema defaults', async () => {
    const [created] = await db.insert(users).values({ displayName: 'Elena Marsh' }).returning();
    expect(created).toBeDefined();
    expect(created!.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created!.globalRole).toBe('user');
    expect(created!.employmentType).toBe('contractor');
    expect(created!.active).toBe(true);
    expect(created!.preferences).toEqual({});

    const [found] = await db.select().from(users).where(eq(users.id, created!.id));
    expect(found!.displayName).toBe('Elena Marsh');
  });

  it('starts each test from an empty users table (truncateAll worked)', async () => {
    const rows = await db.select().from(users);
    expect(rows).toHaveLength(0);
  });
});
