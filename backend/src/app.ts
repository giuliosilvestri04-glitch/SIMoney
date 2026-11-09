import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env.js';
import authPlugin from './plugins/auth.plugin.js';
import errorHandlerPlugin from './plugins/error-handler.plugin.js';
import swaggerPlugin from './plugins/swagger.plugin.js';
import systemRoutes from './modules/system.routes.js';
import authRoutes from './modules/auth.routes.js';
import clientRoutes from './modules/client.routes.js';
import advisorRoutes from './modules/advisor.routes.js';
import adminRoutes from './modules/admin.routes.js';
import documentRoutes from './modules/document.routes.js';

export const API_PREFIX = '/api/v1';

/**
 * Costruzione dell'applicazione.
 *
 * È una factory (non un server già avviato) per due motivi:
 *  - i test possono usare `app.inject()` senza aprire porte di rete;
 *  - il bootstrap HTTP resta separato dalla configurazione.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      env.logLevel === 'silent'
        ? false
        : {
            level: env.logLevel,
            transport:
              env.nodeEnv === 'development'
                ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
                : undefined,
          },
    trustProxy: true,
    bodyLimit: 1_048_576,
    ajv: { customOptions: { coerceTypes: true, useDefaults: true, removeAdditional: false } },
  });

  // --- Sicurezza di base ----------------------------------------------------

  await app.register(helmet, {
    // La UI Swagger ha bisogno di script inline: in un prototipo locale è accettabile.
    contentSecurityPolicy: false,
  });

  await app.register(cors, {
    origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(',').map((value) => value.trim()),
    credentials: true,
  });

  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    allowList: () => env.isTest,
  });

  // --- Infrastruttura -------------------------------------------------------

  await app.register(errorHandlerPlugin);
  await app.register(authPlugin);
  await app.register(swaggerPlugin);

  /** Marcatore esplicito: questa API è un prototipo dimostrativo. */
  app.addHook('onSend', async (_request, reply) => {
    reply.header('X-Prototype', 'true');
    reply.header('X-Data-Source', env.dataProvider);
  });

  // --- Rotte ----------------------------------------------------------------

  await app.register(
    async (api) => {
      await api.register(systemRoutes);
      await api.register(authRoutes);
      await api.register(clientRoutes);
      await api.register(advisorRoutes);
      await api.register(adminRoutes);
      await api.register(documentRoutes);
    },
    { prefix: API_PREFIX },
  );

  app.get('/', { schema: { hide: true } }, async (_request, reply) => reply.redirect('/docs'));

  return app;
}
