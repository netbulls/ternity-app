import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import viewerModePlugin from './viewer-mode.js';

// Characterization tests for the viewer-mode plugin.
// The plugin is driven entirely by the VIEWER_MODE env var and blocks mutating
// HTTP methods (POST, PUT, PATCH, DELETE) with 403 when active.
// No database access needed — driven via Fastify's inject().

let app: FastifyInstance;

async function buildApp(viewerMode: boolean): Promise<FastifyInstance> {
  if (viewerMode) {
    process.env.VIEWER_MODE = 'true';
  } else {
    delete process.env.VIEWER_MODE;
  }
  const instance = Fastify({ logger: false });
  await instance.register(viewerModePlugin);

  // Echo endpoints for each HTTP method so we can probe them
  instance.get('/data', async () => ({ ok: true }));
  instance.post('/data', async () => ({ ok: true }));
  instance.put('/data', async () => ({ ok: true }));
  instance.patch('/data', async () => ({ ok: true }));
  instance.delete('/data', async () => ({ ok: true }));

  await instance.ready();
  return instance;
}

describe('viewer-mode plugin — mode DISABLED (VIEWER_MODE unset)', () => {
  beforeAll(async () => {
    app = await buildApp(false);
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows GET requests', async () => {
    const res = await app.inject({ method: 'GET', url: '/data' });
    expect(res.statusCode).toBe(200);
  });

  it('allows POST requests', async () => {
    const res = await app.inject({ method: 'POST', url: '/data' });
    expect(res.statusCode).toBe(200);
  });

  it('allows PUT requests', async () => {
    const res = await app.inject({ method: 'PUT', url: '/data' });
    expect(res.statusCode).toBe(200);
  });

  it('allows PATCH requests', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/data' });
    expect(res.statusCode).toBe(200);
  });

  it('allows DELETE requests', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/data' });
    expect(res.statusCode).toBe(200);
  });
});

describe('viewer-mode plugin — mode ENABLED (VIEWER_MODE=true)', () => {
  beforeAll(async () => {
    app = await buildApp(true);
  });

  afterAll(async () => {
    await app.close();
    delete process.env.VIEWER_MODE;
  });

  it('allows GET requests — reads are never blocked', async () => {
    const res = await app.inject({ method: 'GET', url: '/data' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('blocks POST with 403 and the viewer-mode error message', async () => {
    const res = await app.inject({ method: 'POST', url: '/data' });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({
      error: expect.stringContaining('Viewer mode'),
    });
  });

  it('blocks PUT with 403', async () => {
    const res = await app.inject({ method: 'PUT', url: '/data' });
    expect(res.statusCode).toBe(403);
  });

  it('blocks PATCH with 403', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/data' });
    expect(res.statusCode).toBe(403);
  });

  it('blocks DELETE with 403', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/data' });
    expect(res.statusCode).toBe(403);
  });

  it('error body mentions Toggl/Timetastic as the read-only data source', async () => {
    const res = await app.inject({ method: 'POST', url: '/data' });
    const body = res.json<{ error: string }>();
    expect(body.error).toContain('Toggl');
    expect(body.error).toContain('Timetastic');
  });
});
