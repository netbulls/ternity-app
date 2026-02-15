import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

async function viewerModePlugin(fastify: FastifyInstance) {
  const viewerMode = process.env.VIEWER_MODE === 'true';

  if (!viewerMode) return;

  fastify.log.info('Viewer mode enabled — mutations blocked');

  fastify.addHook('onRequest', async (request, reply) => {
    const method = request.method.toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return reply.code(403).send({
        error: 'Viewer mode is active. This data is synced from Toggl/Timetastic and cannot be modified.',
      });
    }
  });
}

export default fp(viewerModePlugin, { name: 'viewer-mode' });
