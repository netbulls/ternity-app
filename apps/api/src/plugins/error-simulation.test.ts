import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import errorSimulation from './error-simulation.js';

// Characterization tests for the dev-only error-simulation plugin.
//
// BUG FOUND: The plugin is NOT wrapped with fastify-plugin (fp), so Fastify
// treats it as an encapsulated child scope. The onRequest hook is only visible
// to routes registered inside that child scope. Routes registered on the parent
// app AFTER app.register(errorSimulation) are in the parent scope and the hook
// does NOT fire for them.
//
// Consequence: the plugin silently has no effect in the typical usage pattern
// (register plugin → register routes on the same or parent app instance).
//
// To fix: wrap the plugin with fp(): `export default fp(errorSimulation)`.
//
// These tests pin ACTUAL behavior, including the bug.

// ─────────────────────────────────────────────────────────────────────────────
// Actual behavior: plugin registered, routes on the SAME app (parent scope)
// ─────────────────────────────────────────────────────────────────────────────

describe('error-simulation — typical usage (routes on parent app)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(errorSimulation);
    // Routes registered on the parent after register — outside the plugin scope
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

  // BUG: the hook lives in a child scope; these routes are in the parent scope.
  // X-Simulate-Error is ignored — all requests return 200.
  it('POST WITH X-Simulate-Error — 200 (BUG: hook does not apply to parent-scope routes)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/resource',
      headers: { 'x-simulate-error': 'true' },
    });
    expect(res.statusCode).toBe(200); // expected 500 if the plugin worked
  });

  it('PUT WITH X-Simulate-Error — 200 (BUG: hook scoping)', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/resource',
      headers: { 'x-simulate-error': 'true' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('DELETE WITH X-Simulate-Error — 200 (BUG: hook scoping)', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/resource',
      headers: { 'x-simulate-error': 'true' },
    });
    expect(res.statusCode).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Correct behavior: plugin wrapped with fp() so the hook applies globally
// ─────────────────────────────────────────────────────────────────────────────

describe('error-simulation — fp()-wrapped (correct wiring)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    // Wrap with fp so the hook propagates to the parent scope
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
