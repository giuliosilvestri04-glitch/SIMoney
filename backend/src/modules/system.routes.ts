import type { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { getProviderStatus } from '../providers/index.js';
import { ok } from '../http/schemas.js';

/**
 * Rotte di sistema: servono alla demo e alla diagnostica.
 * `GET /system/data-source` è la dimostrazione pratica che l'app funziona
 * senza Guardian.
 */
export default async function systemRoutes(app: FastifyInstance) {
  app.get(
    '/health',
    {
      schema: {
        tags: ['Sistema'],
        summary: 'Stato del servizio',
        description: 'Verifica rapida che backend e database del prototipo siano operativi.',
        response: ok('Servizio attivo'),
      },
    },
    async () => {
      let database = 'ok';
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch {
        database = 'unavailable';
      }

      return {
        data: {
          status: database === 'ok' ? 'ok' : 'degraded',
          service: env.prototype.name,
          version: env.prototype.version,
          environment: env.nodeEnv,
          database,
          uptimeSeconds: Math.round(process.uptime()),
          timestamp: new Date().toISOString(),
        },
      };
    },
  );

  app.get(
    '/system/data-source',
    {
      schema: {
        tags: ['Sistema'],
        summary: 'Sorgente dati attiva (mock / Guardian)',
        description:
          'Mostra quale provider sta alimentando i dati di patrimonio. ' +
          'Nel prototipo è sempre `mock`: nessuna dipendenza da Guardian.',
        response: ok('Stato della sorgente dati'),
      },
    },
    async () => {
      const status = await getProviderStatus();
      return {
        data: {
          ...status,
          guardian: {
            configured: env.guardian.isConfigured,
            integrationReady: true,
            note:
              'Architettura predisposta: attivando DATA_PROVIDER=guardian con URL e credenziali, ' +
              'il resto del backend e l\'app mobile non richiedono modifiche.',
          },
          disclaimer: env.prototype.disclaimer,
        },
      };
    },
  );

  app.get(
    '/meta/asset-classes',
    {
      schema: {
        tags: ['Sistema'],
        summary: 'Categorie di asset allocation configurate',
        description:
          'Le categorie NON sono fisse nel codice: sono dati configurabili. ' +
          'Il frontend usa questa lista per etichette, ordine e colori dei grafici.',
        response: ok('Elenco delle asset class'),
      },
    },
    async () => {
      const assetClasses = await prisma.assetClass.findMany({ orderBy: { orderIndex: 'asc' } });
      return {
        data: assetClasses.map((assetClass) => ({
          key: assetClass.key,
          label: assetClass.label,
          colorHex: assetClass.colorHex,
          orderIndex: assetClass.orderIndex,
          riskLevel: assetClass.riskLevel,
          description: assetClass.description,
        })),
      };
    },
  );
}
