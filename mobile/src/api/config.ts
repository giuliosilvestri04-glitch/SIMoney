import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

/**
 * Risoluzione dell'indirizzo del backend.
 *
 * Ordine di priorità:
 *  1. indirizzo salvato dall'utente nella schermata "Server" (utile in demo);
 *  2. variabile d'ambiente `EXPO_PUBLIC_API_URL` (usata nelle build APK/TestFlight);
 *  3. rilevamento automatico in sviluppo: si prende l'IP del computer che
 *     esegue Metro e si usa la porta 4000. Così l'app funziona su uno
 *     smartphone reale collegato alla stessa rete Wi-Fi senza configurare nulla.
 *  4. `http://localhost:4000` (emulatore iOS / web).
 */

const OVERRIDE_KEY = 'api.baseUrl.override';
const DEFAULT_PORT = 4000;

function hostFromExpo(): string | null {
  // `hostUri` è presente in sviluppo (Expo Go / dev build); nelle build di
  // produzione non esiste e si ricade sulla variabile d'ambiente.
  const legacyHost = (Constants as unknown as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } })
    .manifest2?.extra?.expoGo?.debuggerHost;
  const hostUri = Constants.expoConfig?.hostUri ?? legacyHost ?? null;
  if (!hostUri) return null;
  const host = hostUri.split(':')[0];
  return host && host.length > 0 ? host : null;
}

export function defaultBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  const host = hostFromExpo();
  if (host) return `http://${host}:${DEFAULT_PORT}`;

  return `http://localhost:${DEFAULT_PORT}`;
}

let cachedBaseUrl: string | null = null;

export function getBaseUrl(): string {
  if (!cachedBaseUrl) cachedBaseUrl = defaultBaseUrl();
  return cachedBaseUrl;
}

export function getApiUrl(): string {
  return `${getBaseUrl()}/api/v1`;
}

/** Caricato una volta all'avvio, prima di qualsiasi richiesta. */
export async function loadBaseUrlOverride(): Promise<void> {
  try {
    const stored = await SecureStore.getItemAsync(OVERRIDE_KEY);
    cachedBaseUrl = stored?.trim() ? stored.replace(/\/+$/, '') : defaultBaseUrl();
  } catch {
    cachedBaseUrl = defaultBaseUrl();
  }
}

export async function setBaseUrlOverride(value: string | null): Promise<void> {
  const normalized = value?.trim().replace(/\/+$/, '') ?? '';
  if (normalized) {
    await SecureStore.setItemAsync(OVERRIDE_KEY, normalized);
    cachedBaseUrl = normalized;
  } else {
    await SecureStore.deleteItemAsync(OVERRIDE_KEY);
    cachedBaseUrl = defaultBaseUrl();
  }
}

export function hasCustomBaseUrl(): boolean {
  return getBaseUrl() !== defaultBaseUrl();
}

/** Millisecondi oltre i quali una richiesta viene considerata non risposta. */
export const REQUEST_TIMEOUT_MS = 12_000;
