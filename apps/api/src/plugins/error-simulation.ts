import { FastifyInstance } from 'fastify';

/**
 * Dev-only error simulation plugin.
 * When a request includes `X-Simulate-Error: true` header on a mutating method,
 * it throws an error before the route handler runs, simulating a DB failure.
 */
export default async function errorSimulation(fastify: FastifyInstance) {
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
