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
import { adminUsersRoutes } from './routes/admin-users.js';

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

// Routes
await fastify.register(healthRoutes);
await fastify.register(meRoutes);
await fastify.register(timerRoutes);
await fastify.register(entriesRoutes);
await fastify.register(referenceRoutes);
await fastify.register(statsRoutes);
await fastify.register(adminUsersRoutes);

// Start
const port = Number(process.env.PORT ?? 3010);
const host = process.env.HOST ?? '0.0.0.0';

try {
  await fastify.listen({ port, host });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
