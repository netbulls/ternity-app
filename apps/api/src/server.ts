import Fastify from 'fastify';
import cors from '@fastify/cors';
import authPlugin from './plugins/auth.js';
import { healthRoutes } from './routes/health.js';
import { meRoutes } from './routes/me.js';

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
await fastify.register(authPlugin);

// Routes
await fastify.register(healthRoutes);
await fastify.register(meRoutes);

// Start
const port = Number(process.env.PORT ?? 3010);
const host = process.env.HOST ?? '0.0.0.0';

try {
  await fastify.listen({ port, host });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
