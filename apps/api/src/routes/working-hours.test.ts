import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { DEFAULT_WEEKLY_WORKING_HOURS } from '@ternity/shared';
import { db, truncateAll } from '../../test/db.js';
import { buildApp } from '../../test/app.js';
import { users, workingSchedules } from '../db/schema.js';
import { workingHoursRoutes } from './working-hours.js';

// Integration tests for GET /api/working-hours and PUT /api/working-hours.

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp(workingHoursRoutes);
});
afterAll(async () => {
  await app.close();
});
beforeEach(truncateAll);

async function makeUser(role: 'admin' | 'user' = 'admin') {
  const [u] = await db
    .insert(users)
    .values({ displayName: `U-${Math.random()}`, email: `u${Math.random()}@acme.io`, globalRole: role })
    .returning();
  return u!;
}

const getHours = async (userId: string) => {
  const res = await app.inject({
    method: 'GET',
    url: '/api/working-hours',
    headers: { 'x-dev-user-id': userId },
  });
  return { status: res.statusCode, body: res.json() };
};

const putHours = async (userId: string, payload: unknown) => {
  const res = await app.inject({
    method: 'PUT',
    url: '/api/working-hours',
    headers: { 'x-dev-user-id': userId },
    payload: payload as object,
  });
  return { status: res.statusCode, body: res.statusCode < 400 ? res.json() : res.json() };
};

describe('GET /api/working-hours', () => {
  it('returns the DEFAULT schedule when no row exists yet', async () => {
    const u = await makeUser();
    const { status, body } = await getHours(u.id);

    expect(status).toBe(200);
    expect(body).toEqual(DEFAULT_WEEKLY_WORKING_HOURS);
  });

  it('returns the saved schedule when one exists', async () => {
    const u = await makeUser();
    const custom = {
      ...DEFAULT_WEEKLY_WORKING_HOURS,
      mon: { enabled: false, start: '09:00', end: '17:00' },
    };
    await db.insert(workingSchedules).values({ userId: u.id, schedule: custom });

    const { status, body } = await getHours(u.id);
    expect(status).toBe(200);
    expect(body.mon).toMatchObject({ enabled: false, start: '09:00', end: '17:00' });
  });
});

describe('PUT /api/working-hours', () => {
  it('creates a new schedule row on first save and returns it', async () => {
    const u = await makeUser();
    const schedule = DEFAULT_WEEKLY_WORKING_HOURS;

    const { status, body } = await putHours(u.id, schedule);
    expect(status).toBe(200);
    expect(body).toEqual(schedule);

    const [row] = await db
      .select()
      .from(workingSchedules)
      .where(eq(workingSchedules.userId, u.id));
    expect(row).toBeDefined();
    expect(row!.schedule).toMatchObject(schedule);
  });

  it('upserts (overwrites) an existing schedule row', async () => {
    const u = await makeUser();
    await db.insert(workingSchedules).values({
      userId: u.id,
      schedule: DEFAULT_WEEKLY_WORKING_HOURS,
    });

    const updated = {
      ...DEFAULT_WEEKLY_WORKING_HOURS,
      fri: { enabled: false, start: '08:30', end: '16:30' },
    };

    const { status, body } = await putHours(u.id, updated);
    expect(status).toBe(200);
    expect(body.fri.enabled).toBe(false);

    // Only one row should exist after upsert
    const rows = await db
      .select()
      .from(workingSchedules)
      .where(eq(workingSchedules.userId, u.id));
    expect(rows).toHaveLength(1);
  });

  it('returns 400 for invalid data (start >= end)', async () => {
    const u = await makeUser();
    const badSchedule = {
      ...DEFAULT_WEEKLY_WORKING_HOURS,
      mon: { enabled: true, start: '17:00', end: '08:00' }, // start after end
    };

    const { status } = await putHours(u.id, badSchedule);
    expect(status).toBe(400);
  });

  it('returns 400 for completely malformed payload', async () => {
    const u = await makeUser();
    const { status } = await putHours(u.id, { nonsense: true });
    expect(status).toBe(400);
  });
});
