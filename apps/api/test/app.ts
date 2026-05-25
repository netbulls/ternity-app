import Fastify, { type FastifyInstance, type FastifyPluginAsync } from 'fastify';
import authPlugin from '../src/plugins/auth.js';

/**
 * Build a Fastify app for route integration tests: the auth plugin in stub mode
 * (acting user comes from the `x-dev-user-id` header, read from the live test DB)
 * plus whatever route plugins the test needs. Reusable across route test files.
 */
export async function buildApp(...routes: FastifyPluginAsync[]): Promise<FastifyInstance> {
  process.env.AUTH_MODE = 'stub';
  const app = Fastify();
  await app.register(authPlugin);
  for (const route of routes) await app.register(route);
  await app.ready();
  return app;
}
