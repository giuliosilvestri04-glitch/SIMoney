import fp from 'fastify-plugin';
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../lib/errors.js';
import { env } from '../config/env.js';

/**
 * Formato di errore unico per tutta l'API:
 *
 *   { "error": { "code": "NOT_FOUND", "message": "...", "details": ... } }
 *
 * Il frontend mobile reagisce al `code` (stabile) e mostra il `message`
 * (già in italiano, comprensibile all'utente finale): nessuna schermata vuota
 * quando qualcosa non funziona (requisito 41).
 */
async function errorHandlerPlugin(app: FastifyInstance) {
  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    reply.status(404).send({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: `Endpoint non disponibile: ${request.method} ${request.url}`,
      },
    });
  });

  app.setErrorHandler((error: FastifyError | AppError, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof AppError) {
      if (error.statusCode >= 500) request.log.error({ err: error }, error.message);
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details },
      });
    }

    const fastifyError = error as FastifyError;

    // Errori di validazione degli schemi JSON delle rotte.
    if (fastifyError.validation) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dati della richiesta non validi.',
          details: fastifyError.validation.map((issue) => ({
            field: issue.instancePath || issue.params?.missingProperty || '',
            rule: issue.keyword,
            message: issue.message,
          })),
        },
      });
    }

    if (fastifyError.statusCode === 429) {
      return reply.status(429).send({
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Troppe richieste in poco tempo. Riprovare tra qualche istante.',
        },
      });
    }

    if (fastifyError.statusCode && fastifyError.statusCode < 500) {
      return reply.status(fastifyError.statusCode).send({
        error: {
          code: fastifyError.code ?? 'REQUEST_ERROR',
          message: fastifyError.message,
        },
      });
    }

    request.log.error({ err: error }, 'Errore non gestito');

    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Errore interno del server. Riprovare più tardi.',
        details: env.isProduction ? undefined : { reason: error.message },
      },
    });
  });
}

export default fp(errorHandlerPlugin, { name: 'error-handler-plugin' });
