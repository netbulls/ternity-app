import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { db, truncateAll } from '../../test/db.js';
import { buildApp } from '../../test/app.js';
import { users } from '../db/schema.js';
import { healthRoutes } from './health.js';

// Integration tests for GET /health — trivial public route (auth skipped by the plugin)

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp(healthRoutes);
});
afterAll(async () => {
  await app.close();
});
beforeEach(truncateAll);

describe('GET /health', () => {
  it('returns status ok without any auth header', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ status: string; timestamp: string }>();
    expect(body.status).toBe('ok');
    // timestamp is a valid ISO string
    expect(() => new Date(body.timestamp)).not.toThrow();
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it('also works with an authenticated user header', async () => {
    const [u] = await db
      .insert(users)
      .values({ displayName: 'Alice', email: 'alice@acme.io', globalRole: 'admin' })
      .returning();
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-dev-user-id': u!.id },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ status: string }>().status).toBe('ok');
  });
});
