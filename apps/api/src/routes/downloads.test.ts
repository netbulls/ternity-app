import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { db, truncateAll } from '../../test/db.js';
import { buildApp } from '../../test/app.js';
import { users } from '../db/schema.js';
import { downloadsRoutes } from './downloads.js';

// Integration tests for GET /api/downloads (PUBLIC route — auth skipped).
//
// This route requires three env vars (DRIVE_INTERNAL_URL, DRIVE_PUBLIC_URL,
// SIGNED_URL_SECRET) and calls an external Drive service to list artifacts.
//
// What we CAN test without a real Drive service:
//   - 503 when env vars are missing (config not set)
//   - 200 with empty products when the route is accessible without auth headers
//   - That the route is truly public (no x-dev-user-id needed)
//
// What we SKIP: full artifact listing, framework grouping, signed-URL generation,
// snapshot/release channel filtering — all require a live Drive service.

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp(downloadsRoutes);
});
afterAll(async () => {
  await app.close();
});
beforeEach(truncateAll);

describe('GET /api/downloads — missing env vars (no Drive configured)', () => {
  it('returns 503 without any auth header when DRIVE_INTERNAL_URL is not set', async () => {
    // The test harness does NOT set DRIVE_INTERNAL_URL / DRIVE_PUBLIC_URL / SIGNED_URL_SECRET.
    // The route should detect this and return 503 immediately, never hitting a real Drive.
    const res = await app.inject({ method: 'GET', url: '/api/downloads' });

    expect(res.statusCode).toBe(503);
    expect(res.json<{ error: string }>().error).toMatch(/not configured/i);
  });

  it('also returns 503 even when called with an authenticated user header', async () => {
    const [u] = await db
      .insert(users)
      .values({ displayName: 'Alex', email: 'alex@acme.io', globalRole: 'admin' })
      .returning();

    const res = await app.inject({
      method: 'GET',
      url: '/api/downloads',
      headers: { 'x-dev-user-id': u!.id },
    });

    // Regardless of auth, missing env → 503
    expect(res.statusCode).toBe(503);
  });
});

describe('GET /api/downloads — is a public route (no auth required)', () => {
  it('does not return 401/403 when no auth header is provided', async () => {
    // /api/downloads is listed as a public path in the auth plugin.
    // Even without env vars configured, the route itself should be reachable
    // (503 means the route handled the request, not that auth rejected it).
    const res = await app.inject({ method: 'GET', url: '/api/downloads' });
    expect(res.statusCode).not.toBe(401);
    expect(res.statusCode).not.toBe(403);
  });
});
