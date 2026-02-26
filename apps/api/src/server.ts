import Fastify from 'fastify';
import cors from '@fastify/cors';
import viewerModePlugin from './plugins/viewer-mode.js';
import authPlugin from './plugins/auth.js';
import { healthRoutes } from './routes/health.js';
import { meRoutes } from './routes/me.js';
import { timerRoutes } from './routes/timer.js';
import { entriesRoutes } from './routes/entries.js';
import { referenceRoutes } from './routes/reference.js';
import { statsRoutes } from './routes/stats.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { adminUsersRoutes } from './routes/admin-users.js';
import { adminProjectsRoutes } from './routes/admin-projects.js';
import { syncStatusRoutes } from './routes/sync-status.js';
import { downloadsRoutes } from './routes/downloads.js';
import { userPreferencesRoutes } from './routes/user-preferences.js';
import { jiraRoutes } from './routes/jira.js';

const fastify = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
    },
  },
});

// Plugins
await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
});
await fastify.register(viewerModePlugin);
await fastify.register(authPlugin);

// Global error handler — structured JSON for all unhandled errors
fastify.setErrorHandler((error: Error & { statusCode?: number; code?: string }, request, reply) => {
  request.log.error(error);
  const status = error.statusCode ?? 500;
  reply.code(status).send({
    error: error.message ?? 'Internal server error',
    code: error.code ?? 'INTERNAL_ERROR',
  });
});

// Error simulation (dev-only)
if (process.env.NODE_ENV !== 'production') {
  const { default: errorSimulation } = await import('./plugins/error-simulation.js');
  await fastify.register(errorSimulation);
}

// Routes
await fastify.register(healthRoutes);
await fastify.register(meRoutes);
await fastify.register(timerRoutes);
await fastify.register(entriesRoutes);
await fastify.register(referenceRoutes);
await fastify.register(statsRoutes);
await fastify.register(dashboardRoutes);
await fastify.register(adminUsersRoutes);
await fastify.register(adminProjectsRoutes);
await fastify.register(syncStatusRoutes);
await fastify.register(downloadsRoutes);
await fastify.register(userPreferencesRoutes);
await fastify.register(jiraRoutes);

// Start
const port = Number(process.env.PORT ?? 3010);
const host = process.env.HOST ?? '0.0.0.0';

try {
  await fastify.listen({ port, host });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
