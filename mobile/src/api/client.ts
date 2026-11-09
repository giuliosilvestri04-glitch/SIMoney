import { getApiUrl, REQUEST_TIMEOUT_MS } from './config';
import { clearSession, getAccessToken, getRefreshToken, updateTokens } from './session';
import type { Envelope } from './types';

/**
 * Client HTTP dell'app.
 *
 * Responsabilità:
 *  - allega il token di accesso;
 *  - impone un timeout (una richiesta che non risponde deve fallire, non
 *    lasciare l'utente su uno spinner infinito);
 *  - traduce QUALSIASI problema in un `ApiError` con un messaggio in italiano
 *    mostrabile all'utente: nessuna schermata vuota (requisito 41);
 *  - rinnova l'access token scaduto una sola volta e in modo condiviso
 *    (single-flight), ripetendo poi la richiesta originale.
 */

export type ApiErrorKind = 'network' | 'timeout' | 'auth' | 'client' | 'server' | 'unknown';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly kind: ApiErrorKind;
  readonly details?: unknown;

  constructor(params: {
    status: number;
    code: string;
    message: string;
    kind: ApiErrorKind;
    details?: unknown;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.status = params.status;
    this.code = params.code;
    this.kind = params.kind;
    this.details = params.details;
  }

  /** L'utente può risolvere riprovando? Guida la UI degli stati di errore. */
  get isRetryable(): boolean {
    return this.kind === 'network' || this.kind === 'timeout' || this.kind === 'server';
  }
}

const NETWORK_MESSAGE =
  'Impossibile raggiungere il server. Controlla la connessione e che il backend del prototipo sia avviato.';

/** Invocato quando la sessione non è più valida: l'app torna al login. */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

// --- Rinnovo del token (condiviso fra richieste parallele) -------------------

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${getApiUrl()}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return false;

    const body = (await response.json()) as Envelope<{ accessToken: string; refreshToken: string }>;
    await updateTokens(body.data.accessToken, body.data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

function refreshOnce(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// --- Richiesta ---------------------------------------------------------------

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Richiesta pubblica (login, health): non allega il token. */
  anonymous?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
}

async function rawRequest(path: string, options: RequestOptions): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);

  // Propaga l'annullamento richiesto dal chiamante (es. schermata smontata).
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener('abort', abortFromCaller);

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  if (!options.anonymous) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  try {
    return await fetch(`${getApiUrl()}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}

async function parseError(response: Response): Promise<ApiError> {
  let code = 'HTTP_ERROR';
  let message = `Errore del server (${response.status}).`;
  let details: unknown;

  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string; details?: unknown } };
    if (body?.error) {
      code = body.error.code ?? code;
      message = body.error.message ?? message;
      details = body.error.details;
    }
  } catch {
    // Risposta non JSON: si tiene il messaggio generico.
  }

  const kind: ApiErrorKind =
    response.status === 401 || response.status === 403
      ? 'auth'
      : response.status >= 500
        ? 'server'
        : 'client';

  if (kind === 'server') {
    message = 'Il servizio ha riscontrato un problema. Riprova tra qualche istante.';
  }

  return new ApiError({ status: response.status, code, message, kind, details });
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;

  try {
    response = await rawRequest(path, options);
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    throw new ApiError({
      status: 0,
      code: aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
      kind: aborted ? 'timeout' : 'network',
      message: aborted
        ? 'Il server non ha risposto in tempo. Riprova.'
        : NETWORK_MESSAGE,
    });
  }

  // Access token scaduto: si tenta un rinnovo trasparente, una sola volta.
  if (response.status === 401 && !options.anonymous) {
    const refreshed = await refreshOnce();

    if (refreshed) {
      try {
        response = await rawRequest(path, options);
      } catch {
        throw new ApiError({ status: 0, code: 'NETWORK_ERROR', kind: 'network', message: NETWORK_MESSAGE });
      }
    }

    if (response.status === 401) {
      await clearSession();
      onSessionExpired?.();
      throw new ApiError({
        status: 401,
        code: 'SESSION_EXPIRED',
        kind: 'auth',
        message: 'Sessione scaduta. Accedi di nuovo.',
      });
    }
  }

  if (!response.ok) throw await parseError(response);

  if (response.status === 204) return undefined as T;

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError({
      status: response.status,
      code: 'INVALID_RESPONSE',
      kind: 'unknown',
      message: 'Risposta del server non leggibile.',
    });
  }
}

/** Scorciatoia per gli endpoint che rispondono con `{ data: ... }`. */
export async function getData<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const body = await request<Envelope<T>>(path, options);
  return body.data;
}

/** Variante che conserva anche `meta` (paginazione) e `totals`. */
export async function getEnvelope<T>(path: string, options: RequestOptions = {}): Promise<Envelope<T>> {
  return request<Envelope<T>>(path, options);
}

/** Costruisce una query string ignorando i valori non impostati. */
export function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  );
  if (entries.length === 0) return '';
  return `?${entries.map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`).join('&')}`;
}
