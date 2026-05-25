import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { DEFAULT_NOTIFICATION_SETTINGS } from '@ternity/shared';
import { db, truncateAll } from '../../test/db.js';
import { buildApp } from '../../test/app.js';
import { users, notificationSettings } from '../db/schema.js';
import { notificationSettingsRoutes } from './notification-settings.js';

// Integration tests for:
//   GET  /api/notification-settings
//   PUT  /api/notification-settings
//
// POST /api/notification-settings/test-email and test-sms are SKIPPED because
// they require external services (email delivery via Resend/Postmark, Twilio SMS).
// We test only what we can without hitting real APIs.

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp(notificationSettingsRoutes);
});
afterAll(async () => {
  await app.close();
});
beforeEach(truncateAll);

async function makeUser(overrides: Partial<typeof users.$inferInsert> = {}) {
  const [u] = await db
    .insert(users)
    .values({
      displayName: 'Alex Morgan',
      email: `alex${Math.random()}@acme.io`,
      globalRole: 'admin',
      ...overrides,
    })
    .returning();
  return u!;
}

const getSettings = async (userId: string) => {
  const res = await app.inject({
    method: 'GET',
    url: '/api/notification-settings',
    headers: { 'x-dev-user-id': userId },
  });
  return { status: res.statusCode, body: res.json() };
};

const putSettings = async (userId: string, payload: unknown) => {
  const res = await app.inject({
    method: 'PUT',
    url: '/api/notification-settings',
    headers: { 'x-dev-user-id': userId },
    payload: payload as object,
  });
  return { status: res.statusCode, body: res.json() };
};

describe('GET /api/notification-settings', () => {
  it('returns DEFAULT_NOTIFICATION_SETTINGS when no row exists', async () => {
    const u = await makeUser();
    const { status, body } = await getSettings(u.id);

    expect(status).toBe(200);
    expect(body).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
  });

  it('returns the saved settings when a row exists', async () => {
    const u = await makeUser();
    const custom = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      phoneOverride: '+48123456789',
      timer: {
        ...DEFAULT_NOTIFICATION_SETTINGS.timer,
        enabled: false,
      },
    };
    await db.insert(notificationSettings).values({ userId: u.id, settings: custom });

    const { status, body } = await getSettings(u.id);
    expect(status).toBe(200);
    expect(body.phoneOverride).toBe('+48123456789');
    expect(body.timer.enabled).toBe(false);
  });
});

describe('PUT /api/notification-settings', () => {
  it('creates a new settings row on first save and returns it', async () => {
    const u = await makeUser();

    const { status, body } = await putSettings(u.id, DEFAULT_NOTIFICATION_SETTINGS);
    expect(status).toBe(200);
    expect(body).toEqual(DEFAULT_NOTIFICATION_SETTINGS);

    const [row] = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, u.id));
    expect(row).toBeDefined();
  });

  it('upserts (overwrites) an existing settings row', async () => {
    const u = await makeUser();
    await db
      .insert(notificationSettings)
      .values({ userId: u.id, settings: DEFAULT_NOTIFICATION_SETTINGS });

    const updated = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      emailThemeMode: 'dark' as const,
    };

    const { status, body } = await putSettings(u.id, updated);
    expect(status).toBe(200);
    expect(body.emailThemeMode).toBe('dark');

    // Only one row should exist after upsert
    const rows = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, u.id));
    expect(rows).toHaveLength(1);
  });

  it('returns 400 for invalid notification settings payload', async () => {
    const u = await makeUser();
    const { status } = await putSettings(u.id, { nonsense: true });
    expect(status).toBe(400);
  });

  it('persists the full settings object to the DB', async () => {
    const u = await makeUser();
    const payload = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      phoneOverride: '+1234567890',
    };

    await putSettings(u.id, payload);

    const [row] = await db
      .select({ settings: notificationSettings.settings })
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, u.id));
    expect((row!.settings as Record<string, unknown>).phoneOverride).toBe('+1234567890');
  });
});

describe('POST /api/notification-settings/test-email (external service — skipped)', () => {
  it('returns 400 when the user has no email configured', async () => {
    // User without an email address — route should reject before hitting the mail service.
    const u = await makeUser({ email: null });

    const res = await app.inject({
      method: 'POST',
      url: '/api/notification-settings/test-email',
      headers: { 'x-dev-user-id': u.id },
      payload: { type: 'forgotToStart' },
    });

    // FINDING: the route checks request.auth.email and returns 400 when absent.
    // We can validate this without sending a real email.
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toMatch(/email/i);
  });
});

describe('POST /api/notification-settings/test-sms (external service — skipped)', () => {
  it('returns 400 when the user has no phone and no phoneOverride', async () => {
    // User without phone; no saved settings with phoneOverride either.
    const u = await makeUser({ phone: null });

    const res = await app.inject({
      method: 'POST',
      url: '/api/notification-settings/test-sms',
      headers: { 'x-dev-user-id': u.id },
      payload: { type: 'forgotToStart' },
    });

    // Route resolves: no phone found → 400 before Twilio is called.
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toMatch(/phone/i);
  });
});
