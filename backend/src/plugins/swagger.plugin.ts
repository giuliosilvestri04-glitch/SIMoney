import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';

/**
 * Documentazione OpenAPI generata dagli stessi schemi JSON che validano le
 * richieste: documentazione e comportamento non possono divergere.
 *
 * Requisito 34: il backend deve essere testabile senza frontend.
 * Swagger UI su  →  http://localhost:PORT/docs
 */
async function swaggerPlugin(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'API Prototipo — Intermediazione Mobiliare',
        version: env.prototype.version,
        description: [
          '**Backend del prototipo di app mobile.**',
          '',
          env.prototype.disclaimer,
          '',
          '### Come provare le API',
          '1. `POST /api/v1/auth/login` con una delle credenziali demo',
          '   (`GET /api/v1/auth/demo-accounts` le elenca tutte).',
          '2. Copiare `accessToken` e inserirlo con il pulsante **Authorize**.',
          '3. Le sezioni disponibili dipendono dal ruolo dell\'account usato.',
          '',
          '### Sorgente dati',
          'Il prototipo funziona interamente con dati **mock** locali.',
          'L\'integrazione Guardian è predisposta ma non attiva: verificare con',
          '`GET /api/v1/system/data-source`.',
        ].join('\n'),
        contact: { name: 'Prototipo dimostrativo' },
      },
      servers: [{ url: `http://localhost:${env.port}`, description: 'Ambiente demo locale' }],
      tags: [
        { name: 'Sistema', description: 'Stato del servizio e sorgente dati' },
        { name: 'Auth', description: 'Login, sessione, utente corrente' },
        { name: 'Cliente', description: 'Area cliente: patrimonio, storico, investimenti, proposte' },
        { name: 'Consulente', description: 'Area consulente: clienti assegnati e proposte' },
        { name: 'Boss', description: 'Area direzione: analytics aziendali e audit' },
        { name: 'Documenti', description: 'Documenti PDF fittizi' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true, persistAuthorization: true },
    staticCSP: false,
  });
}

export default fp(swaggerPlugin, { name: 'swagger-plugin' });
