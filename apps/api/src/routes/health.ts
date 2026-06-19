import { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';

export async function healthRoutes(fastify: FastifyInstance) {
  // Liveness: is the process up and serving? Deliberately cheap — no dependency
  // checks, so a transient DB blip can't trigger a restart loop on this probe.
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      version: process.env.APP_VERSION ?? 'dev',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  });

  // Readiness: can the app actually serve traffic? Checks the dependencies it needs —
  // currently the database. Returns 503 when a dependency is down so a load balancer
  // / orchestrator stops routing to this instance until it recovers.
  fastify.get('/health/ready', async (_request, reply) => {
    const checks: Record<string, { ok: boolean; error?: string }> = {};

    try {
      await db.execute(sql`SELECT 1`);
      checks.database = { ok: true };
    } catch (err) {
      checks.database = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }

    const ok = Object.values(checks).every((c) => c.ok);
    return reply.code(ok ? 200 : 503).send({
      status: ok ? 'ready' : 'unavailable',
      checks,
      timestamp: new Date().toISOString(),
    });
  });
}
