import type { FastifyInstance } from 'fastify';

/**
 * Shared global error handler — used by both the real server (server.ts) and the
 * test app (test/app.ts) so tests exercise the same error behavior as production.
 *
 * Zod validation errors are mapped to 400 (they used to fall through to 500 because
 * a ZodError carries no `statusCode`). Detection is by `name` rather than instanceof
 * to stay robust if zod resolves to more than one module instance in the monorepo.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (error: Error & { statusCode?: number; code?: string; issues?: unknown }, request, reply) => {
      if (error.name === 'ZodError') {
        request.log.warn({ issues: error.issues }, 'Request validation failed');
        return reply.code(400).send({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          issues: error.issues,
        });
      }

      request.log.error(error);
      const status = error.statusCode ?? 500;
      return reply.code(status).send({
        error: error.message ?? 'Internal server error',
        code: error.code ?? 'INTERNAL_ERROR',
      });
    },
  );
}
