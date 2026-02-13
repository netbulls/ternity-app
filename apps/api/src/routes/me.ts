import { FastifyInstance } from 'fastify';

export async function meRoutes(fastify: FastifyInstance) {
  fastify.get('/api/me', async (request) => {
    return request.auth;
  });
}
