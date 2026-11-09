import 'dotenv/config';
import { resolve } from 'node:path';

/**
 * Configurazione applicativa tipizzata e validata all'avvio.
 * Se manca qualcosa di essenziale il processo si ferma subito con un messaggio
 * chiaro, invece di fallire più tardi durante una richiesta.
 */

type NodeEnv = 'development' | 'test' | 'production';
export type DataProviderName = 'mock' | 'guardian';

function str(key: string, fallback?: string): string {
  const value = process.env[key];
  if (value === undefined || value === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Variabile d'ambiente mancante: ${key}. Copiare .env.example in .env.`);
  }
  return value;
}

function int(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) throw new Error(`Variabile d'ambiente non numerica: ${key}`);
  return parsed;
}

const nodeEnv = str('NODE_ENV', 'development') as NodeEnv;
const dataProvider = str('DATA_PROVIDER', 'mock') as DataProviderName;

if (dataProvider !== 'mock' && dataProvider !== 'guardian') {
  throw new Error(`DATA_PROVIDER non valido: "${dataProvider}". Valori ammessi: mock | guardian.`);
}

const accessSecret = str('JWT_ACCESS_SECRET', nodeEnv === 'production' ? undefined : 'dev-access-secret-not-for-production');
const refreshSecret = str('JWT_REFRESH_SECRET', nodeEnv === 'production' ? undefined : 'dev-refresh-secret-not-for-production');

if (nodeEnv === 'production' && (accessSecret.includes('change-me') || refreshSecret.includes('change-me'))) {
  throw new Error('I segreti JWT di esempio non possono essere usati in produzione.');
}

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',

  port: int('PORT', 4000),
  host: str('HOST', '0.0.0.0'),
  corsOrigin: str('CORS_ORIGIN', '*'),
  logLevel: str('LOG_LEVEL', nodeEnv === 'test' ? 'silent' : 'info'),

  databaseUrl: str('DATABASE_URL', 'file:./dev.db'),

  auth: {
    accessSecret,
    refreshSecret,
    accessTtl: str('ACCESS_TOKEN_TTL', '30m'),
    refreshTtlDays: int('REFRESH_TOKEN_TTL_DAYS', 30),
    demoPassword: str('DEMO_PASSWORD', 'Demo1234!'),
  },

  /** Sorgente dati attiva. Default `mock`: il prototipo funziona senza Guardian. */
  dataProvider,

  /** Predisposizione per l'integrazione FUTURA. Vuoto = Guardian non configurato. */
  guardian: {
    baseUrl: process.env.GUARDIAN_BASE_URL ?? '',
    apiKey: process.env.GUARDIAN_API_KEY ?? '',
    timeoutMs: int('GUARDIAN_TIMEOUT_MS', 8000),
    get isConfigured(): boolean {
      return Boolean(process.env.GUARDIAN_BASE_URL && process.env.GUARDIAN_API_KEY);
    },
  },

  seed: {
    advisors: int('SEED_ADVISORS', 5),
    clients: int('SEED_CLIENTS', 20),
    historyDays: int('SEED_HISTORY_DAYS', 730),
    randomSeed: int('SEED_RANDOM_SEED', 20260911),
  },

  storageDir: resolve(process.cwd(), str('STORAGE_DIR', './storage')),

  /** Il prototipo non è production-ready: viene dichiarato esplicitamente. */
  prototype: {
    name: 'Prototipo App Mobile — Intermediazione Mobiliare',
    version: '1.0.0-prototype',
    disclaimer:
      'Prototipo dimostrativo con dati fittizi. Non production-ready, non collegato a sistemi reali, ' +
      'nessuna firma elettronica qualificata.',
  },
} as const;

export type Env = typeof env;
