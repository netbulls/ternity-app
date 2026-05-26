import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

/**
 * Dev-only error simulation plugin.
 * When a request includes `X-Simulate-Error: true` header on a mutating method,
 * it throws an error before the route handler runs, simulating a DB failure.
 *
 * Wrapped with fastify-plugin so the onRequest hook propagates to the parent
 * scope — otherwise it would be encapsulated and never fire for sibling routes.
 */
async function errorSimulation(fastify: FastifyInstance) {
  fastify.addHook('onRequest', (request, _reply, done) => {
    if (
      request.headers['x-simulate-error'] &&
      ['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method)
    ) {
      done(new Error('Simulated error for testing'));
      return;
    }
    done();
  });
}

export default fp(errorSimulation);
