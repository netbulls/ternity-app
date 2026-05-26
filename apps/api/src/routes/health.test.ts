import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('reports version and uptime', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    const body = res.json<{ version: string; uptimeSeconds: number }>();
    expect(typeof body.version).toBe('string');
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });
});

describe('GET /health/ready', () => {
  it('returns 200 + ready when the database is reachable', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ status: string; checks: { database: { ok: boolean } } }>();
    expect(body.status).toBe('ready');
    expect(body.checks.database.ok).toBe(true);
  });

  it('is public — no auth header required', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(res.statusCode).toBe(200);
  });

  it('returns 503 + unavailable when the database check fails', async () => {
    // Force the SELECT 1 to fail, simulating a DB outage.
    const spy = vi.spyOn(db, 'execute').mockRejectedValueOnce(new Error('connection refused'));
    try {
      const res = await app.inject({ method: 'GET', url: '/health/ready' });
      expect(res.statusCode).toBe(503);
      const body = res.json<{ status: string; checks: { database: { ok: boolean; error?: string } } }>();
      expect(body.status).toBe('unavailable');
      expect(body.checks.database.ok).toBe(false);
      expect(body.checks.database.error).toMatch(/connection refused/);
    } finally {
      spy.mockRestore();
    }
  });
});
