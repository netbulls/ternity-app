import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, truncateAll } from '../../test/db.js';
import { buildApp } from '../../test/app.js';
import { users } from '../db/schema.js';
import { userPreferencesRoutes } from './user-preferences.js';

// Integration tests for GET /api/user/preferences and PATCH /api/user/preferences

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp(userPreferencesRoutes);
});
afterAll(async () => {
  await app.close();
});
beforeEach(truncateAll);

async function makeUser(overrides: Partial<typeof users.$inferInsert> = {}) {
  const [u] = await db
    .insert(users)
    .values({
      displayName: 'Elena Marsh',
      email: `elena${Math.random()}@acme.io`,
      globalRole: 'admin',
      ...overrides,
    })
    .returning();
  return u!;
}

const getPrefs = async (userId: string) => {
  const res = await app.inject({
    method: 'GET',
    url: '/api/user/preferences',
    headers: { 'x-dev-user-id': userId },
  });
  return { status: res.statusCode, body: res.json() };
};

const patchPrefs = async (userId: string, payload: unknown) => {
  const res = await app.inject({
    method: 'PATCH',
    url: '/api/user/preferences',
    headers: { 'x-dev-user-id': userId },
    payload: payload as object,
  });
  return { status: res.statusCode, body: res.json() };
};

describe('GET /api/user/preferences', () => {
  it('returns the schema-defaulted preferences when none are stored', async () => {
    const u = await makeUser({ preferences: {} });
    const { status, body } = await getPrefs(u.id);

    expect(status).toBe(200);
    // UserPreferencesSchema provides defaults for all keys
    expect(body).toMatchObject({
      theme: 'ternity-dark',
      scale: 1.1,
      confirmTimerSwitch: true,
      defaultProjectId: null,
      tagsEnabled: false,
    });
  });

  it('returns stored preferences merged with schema defaults', async () => {
    const u = await makeUser({ preferences: { theme: 'light', scale: 0.9 } });
    const { status, body } = await getPrefs(u.id);

    expect(status).toBe(200);
    expect(body.theme).toBe('light');
    expect(body.scale).toBe(0.9);
    // Other keys still get their defaults
    expect(body.confirmTimerSwitch).toBe(true);
  });
});

describe('PATCH /api/user/preferences', () => {
  it('merges the patch into existing preferences and returns the full result', async () => {
    const u = await makeUser({ preferences: { theme: 'ternity-dark', scale: 1.1 } });

    const { status, body } = await patchPrefs(u.id, { theme: 'light' });
    expect(status).toBe(200);
    // Patched field updated
    expect(body.theme).toBe('light');
    // Other fields remain untouched
    expect(body.scale).toBe(1.1);
  });

  it('persists the patch to the DB', async () => {
    const u = await makeUser({ preferences: {} });
    await patchPrefs(u.id, { tagsEnabled: true });

    const [row] = await db.select({ preferences: users.preferences }).from(users).where(eq(users.id, u.id));
    expect((row!.preferences as Record<string, unknown>).tagsEnabled).toBe(true);
  });

  it('partial patch does not wipe unmentioned keys', async () => {
    const u = await makeUser({ preferences: { theme: 'ocean', scale: 1.2, tagsEnabled: true } });
    await patchPrefs(u.id, { scale: 0.9 });

    const { body } = await getPrefs(u.id);
    expect(body.theme).toBe('ocean');
    expect(body.scale).toBe(0.9);
    expect(body.tagsEnabled).toBe(true);
  });

  it('returns the full preference object (not just the patch keys)', async () => {
    const u = await makeUser({ preferences: {} });
    const { body } = await patchPrefs(u.id, { theme: 'midnight' });

    // All schema keys should be present in the response
    expect(Object.keys(body)).toEqual(
      expect.arrayContaining(['theme', 'scale', 'confirmTimerSwitch', 'defaultProjectId', 'tagsEnabled', 'entrySortOrder']),
    );
  });
});
