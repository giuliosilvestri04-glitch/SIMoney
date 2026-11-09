/**
 * Runner dei test.
 *
 * Prepara un database SQLite DEDICATO ai test (prisma/test.db), lo popola con
 * un seed ridotto e lancia la suite. Il database di sviluppo e i dati della
 * demo non vengono mai toccati.
 */
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const env = {
  ...process.env,
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'file:./test.db',
  STORAGE_DIR: './storage-test',
  JWT_ACCESS_SECRET: 'test-access-secret-0123456789',
  JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789',
  DEMO_PASSWORD: 'Demo1234!',
  DATA_PROVIDER: 'mock',
  // Seed ridotto: la suite resta veloce mantenendo dati realistici.
  SEED_ADVISORS: '3',
  SEED_CLIENTS: '6',
  SEED_HISTORY_DAYS: '400',
};

function run(command, args, label) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    console.error(`\n✖ ${label} non riuscito.`);
    process.exit(result.status ?? 1);
  }
}

// Database di test pulito a ogni esecuzione.
for (const file of ['prisma/test.db', 'prisma/test.db-journal']) {
  rmSync(resolve(root, file), { force: true });
}
rmSync(resolve(root, 'storage-test'), { force: true, recursive: true });

console.log('› preparazione database di test');
run('npx', ['prisma', 'db', 'push', '--skip-generate'], 'Creazione schema');

console.log('› seed dati di test');
run('npx', ['tsx', 'prisma/seed.ts'], 'Seed');

console.log('› esecuzione test\n');
run('node', ['--import', 'tsx', '--test', 'src/tests/*.test.ts'], 'Test');

console.log('\n✔ Suite completata.');
