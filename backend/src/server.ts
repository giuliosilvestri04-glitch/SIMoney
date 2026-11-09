import { buildApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { getProviderSelection } from './providers/index.js';

/**
 * Avvio del server del prototipo.
 *
 * All'avvio NON viene contattato alcun sistema esterno: il backend è
 * autosufficiente e utilizza il proprio database con dati mock.
 */
async function main() {
  const app = await buildApp();

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    app.log.error(
      'Database non raggiungibile. Eseguire "npm run setup" per creare e popolare il database demo.',
    );
    process.exit(1);
  }

  const clients = await prisma.client.count();
  if (clients === 0) {
    app.log.warn('Database vuoto: eseguire "npm run db:seed" per caricare i dati dimostrativi.');
  }

  await app.listen({ port: env.port, host: env.host });

  const selection = getProviderSelection();
  const base = `http://localhost:${env.port}`;

  app.log.info(`${env.prototype.name} v${env.prototype.version}`);
  app.log.info(`API           ${base}/api/v1`);
  app.log.info(`Documentazione ${base}/docs`);
  app.log.info(`Sorgente dati  ${selection.active}${selection.fallbackApplied ? ' (fallback)' : ''}`);
  if (selection.fallbackApplied) app.log.warn(selection.reason);
  app.log.info(`Clienti demo   ${clients}`);

  const shutdown = async (signal: string) => {
    app.log.info(`Ricevuto ${signal}: arresto in corso...`);
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('Avvio non riuscito:', error);
  process.exit(1);
});
