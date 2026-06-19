import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import errorSimulation from './error-simulation.js';

// Tests for the dev-only error-simulation plugin.
//
// The plugin is exported fp()-wrapped (fastify-plugin), so its onRequest hook
// propagates to the parent scope and fires for routes registered on the parent
// app — the typical usage pattern (register plugin → register routes). Before the
// fix it was encapsulated and silently had no effect; see git history.

// ─────────────────────────────────────────────────────────────────────────────
// Typical usage: plugin registered, routes on the SAME app (parent scope).
// Because the export is fp()-wrapped, the hook applies to these parent routes.
// ─────────────────────────────────────────────────────────────────────────────

describe('error-simulation — typical usage (routes on parent app)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(errorSimulation);
    // Routes registered on the parent after register — fp() makes the hook reach them
    app.get('/resource', async () => ({ ok: true }));
    app.post('/resource', async () => ({ ok: true }));
    app.put('/resource', async () => ({ ok: true }));
    app.patch('/resource', async () => ({ ok: true }));
    app.delete('/resource', async () => ({ ok: true }));
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET without header — 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/resource' });
    expect(res.statusCode).toBe(200);
  });

  it('POST without header — 200', async () => {
    const res = await app.inject({ method: 'POST', url: '/resource' });
    expect(res.statusCode).toBe(200);
  });

  it('POST WITH X-Simulate-Error — 500 (hook applies to parent-scope routes)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/resource',
      headers: { 'x-simulate-error': 'true' },
    });
    expect(res.statusCode).toBe(500);
  });

  it('PUT WITH X-Simulate-Error — 500', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/resource',
      headers: { 'x-simulate-error': 'true' },
    });
    expect(res.statusCode).toBe(500);
  });

  it('DELETE WITH X-Simulate-Error — 500', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/resource',
      headers: { 'x-simulate-error': 'true' },
    });
    expect(res.statusCode).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Explicit fp() wrap at the call site — same result (idempotent), confirms the
// hook applies globally regardless of how the already-fp-wrapped plugin is registered.
// ─────────────────────────────────────────────────────────────────────────────

describe('error-simulation — fp()-wrapped (correct wiring)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(fp(errorSimulation));
    app.get('/resource', async () => ({ ok: true }));
    app.post('/resource', async () => ({ ok: true }));
    app.put('/resource', async () => ({ ok: true }));
    app.patch('/resource', async () => ({ ok: true }));
    app.delete('/resource', async () => ({ ok: true }));
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET without header — 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/resource' });
    expect(res.statusCode).toBe(200);
  });

  it('POST without header — 200', async () => {
    const res = await app.inject({ method: 'POST', url: '/resource' });
    expect(res.statusCode).toBe(200);
  });

  it('GET WITH X-Simulate-Error — 200 (GET is not in the blocked list)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/resource',
      headers: { 'x-simulate-error': 'true' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('POST WITH X-Simulate-Error — 500 (hook fires correctly when fp-wrapped)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/resource',
      headers: { 'x-simulate-error': 'true' },
    });
    expect(res.statusCode).toBe(500);
  });

  it('PUT WITH X-Simulate-Error — 500', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/resource',
      headers: { 'x-simulate-error': 'true' },
    });
    expect(res.statusCode).toBe(500);
  });

  it('PATCH WITH X-Simulate-Error — 500', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/resource',
      headers: { 'x-simulate-error': 'true' },
    });
    expect(res.statusCode).toBe(500);
  });

  it('DELETE WITH X-Simulate-Error — 500', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/resource',
      headers: { 'x-simulate-error': 'true' },
    });
    expect(res.statusCode).toBe(500);
  });

  it('error body message mentions "Simulated error"', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/resource',
      headers: { 'x-simulate-error': 'true' },
    });
    const body = res.json<{ message: string }>();
    expect(body.message).toMatch(/simulated error/i);
  });
});
