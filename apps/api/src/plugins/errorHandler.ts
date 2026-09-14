import fp from 'fastify-plugin';
import type { FastifyError, FastifyInstance, FastifyReply } from 'fastify';
import { AppError } from '../util/errors.js';

async function handler(app: FastifyInstance): Promise<void> {
  app.setErrorHandler((err: FastifyError | AppError, _req, reply: FastifyReply) => {
    if (err instanceof AppError) {
      reply.status(err.statusCode).send({ error: err.code, message: err.message });
      return;
    }
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    if (status >= 500) {
      app.log.error(err);
      reply.status(500).send({ error: 'INTERNAL', message: 'Internal server error' });
      return;
    }
    const validation = 'validation' in err ? (err as { validation?: unknown }).validation : undefined;
    reply.status(status).send({
      error: 'BAD_REQUEST',
      message: err.message,
      ...(validation ? { validation } : {}),
    });
  });
}

// fastify-plugin: register at root scope so the handler applies to ALL routes
export const errorHandlerPlugin = fp(handler, { name: 'error-handler' });
