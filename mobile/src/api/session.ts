import * as SecureStore from 'expo-secure-store';
import type { SessionUser } from './types';

/**
 * Custodia dei token di sessione.
 *
 * I token stanno in `expo-secure-store` (Keychain su iOS, EncryptedSharedPreferences
 * su Android): non in AsyncStorage, non nel codice, mai in chiaro.
 * Sono mantenuti anche in memoria per non pagare una lettura cifrata a ogni
 * richiesta HTTP.
 *
 * Volutamente NON è un componente React: il client HTTP deve poter leggere e
 * rinnovare i token anche fuori dall'albero dei componenti.
 */

const KEYS = {
  access: 'session.accessToken',
  refresh: 'session.refreshToken',
  user: 'session.user',
} as const;

interface SessionState {
  accessToken: string | null;
  refreshToken: string | null;
  user: SessionUser | null;
}

let state: SessionState = { accessToken: null, refreshToken: null, user: null };

type Listener = (state: SessionState) => void;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener(state);
}

export function subscribeToSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAccessToken(): string | null {
  return state.accessToken;
}

export function getRefreshToken(): string | null {
  return state.refreshToken;
}

export function getSessionUser(): SessionUser | null {
  return state.user;
}

/** Ripristina la sessione all'avvio dell'app. */
export async function restoreSession(): Promise<SessionState> {
  try {
    const [accessToken, refreshToken, rawUser] = await Promise.all([
      SecureStore.getItemAsync(KEYS.access),
      SecureStore.getItemAsync(KEYS.refresh),
      SecureStore.getItemAsync(KEYS.user),
    ]);

    state = {
      accessToken: accessToken ?? null,
      refreshToken: refreshToken ?? null,
      user: rawUser ? (JSON.parse(rawUser) as SessionUser) : null,
    };
  } catch {
    state = { accessToken: null, refreshToken: null, user: null };
  }
  notify();
  return state;
}

export async function saveSession(params: {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}): Promise<void> {
  state = { accessToken: params.accessToken, refreshToken: params.refreshToken, user: params.user };
  notify();
  await Promise.all([
    SecureStore.setItemAsync(KEYS.access, params.accessToken),
    SecureStore.setItemAsync(KEYS.refresh, params.refreshToken),
    SecureStore.setItemAsync(KEYS.user, JSON.stringify(params.user)),
  ]);
}

/** Aggiorna i soli token dopo un rinnovo, lasciando invariato l'utente. */
export async function updateTokens(accessToken: string, refreshToken: string): Promise<void> {
  state = { ...state, accessToken, refreshToken };
  notify();
  await Promise.all([
    SecureStore.setItemAsync(KEYS.access, accessToken),
    SecureStore.setItemAsync(KEYS.refresh, refreshToken),
  ]);
}

export async function clearSession(): Promise<void> {
  state = { accessToken: null, refreshToken: null, user: null };
  notify();
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.access),
    SecureStore.deleteItemAsync(KEYS.refresh),
    SecureStore.deleteItemAsync(KEYS.user),
  ]).catch(() => undefined);
}
