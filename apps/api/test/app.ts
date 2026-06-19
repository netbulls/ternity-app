import Fastify, { type FastifyInstance, type FastifyPluginAsync } from 'fastify';
import authPlugin from '../src/plugins/auth.js';
import { registerErrorHandler } from '../src/lib/error-handler.js';

/**
 * Build a Fastify app for route integration tests: the auth plugin in stub mode
 * (acting user comes from the `x-dev-user-id` header, read from the live test DB)
 * plus whatever route plugins the test needs. Reusable across route test files.
 *
 * Registers the same global error handler as production (server.ts) so tests
 * exercise the real error behavior (e.g. ZodError → 400).
 */
export async function buildApp(...routes: FastifyPluginAsync[]): Promise<FastifyInstance> {
  process.env.AUTH_MODE = 'stub';
  const app = Fastify();
  await app.register(authPlugin);
  registerErrorHandler(app);
  for (const route of routes) await app.register(route);
  await app.ready();
  return app;
}
