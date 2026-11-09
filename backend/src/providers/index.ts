import { env } from '../config/env.js';
import { MockDataProvider } from './mock/mock.provider.js';
import { GuardianDataProvider } from './guardian/guardian.provider.js';
import type { DataProviderName, PortfolioDataProvider, ProviderStatus } from './types.js';

/**
 * Factory della sorgente dati.
 *
 *   DATA_PROVIDER=mock      → MockDataProvider      (default, demo autosufficiente)
 *   DATA_PROVIDER=guardian  → GuardianDataProvider  (integrazione futura)
 *
 * Regola di sicurezza della demo: se viene richiesto Guardian ma la
 * configurazione è assente, NON si interrompe l'avvio. Si registra un avviso e
 * si continua con i dati mock, così la presentazione all'azienda non può mai
 * fallire per una variabile d'ambiente.
 */

export interface ProviderSelection {
  requested: DataProviderName;
  active: DataProviderName;
  fallbackApplied: boolean;
  reason?: string;
}

let selection: ProviderSelection = {
  requested: env.dataProvider,
  active: env.dataProvider,
  fallbackApplied: false,
};

let instance: PortfolioDataProvider | null = null;

export function getDataProvider(): PortfolioDataProvider {
  if (instance) return instance;

  if (env.dataProvider === 'guardian') {
    if (env.guardian.isConfigured) {
      instance = new GuardianDataProvider();
      selection = { requested: 'guardian', active: 'guardian', fallbackApplied: false };
    } else {
      instance = new MockDataProvider();
      selection = {
        requested: 'guardian',
        active: 'mock',
        fallbackApplied: true,
        reason:
          'GUARDIAN_BASE_URL / GUARDIAN_API_KEY non configurati: il prototipo prosegue con i dati mock.',
      };
    }
  } else {
    instance = new MockDataProvider();
    selection = { requested: 'mock', active: 'mock', fallbackApplied: false };
  }

  return instance;
}

export function getProviderSelection(): ProviderSelection {
  getDataProvider();
  return selection;
}

/** Stato leggibile esposto da `GET /api/v1/system/data-source`. */
export async function getProviderStatus(): Promise<ProviderStatus & { selection: ProviderSelection }> {
  const provider = getDataProvider();
  const status = await provider.status();
  return { ...status, selection: getProviderSelection() };
}

/** Usato dai test per ripartire da uno stato pulito. */
export function resetDataProvider(): void {
  instance = null;
}

export type { PortfolioDataProvider } from './types.js';
