/**
 * Errori applicativi con codice stabile.
 * Il frontend mobile può reagire al `code` senza interpretare i messaggi.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, details);

export const unauthorized = (message = 'Autenticazione richiesta.', code = 'UNAUTHORIZED') =>
  new AppError(401, code, message);

export const invalidCredentials = () =>
  new AppError(401, 'INVALID_CREDENTIALS', 'Email o password non corretti.');

export const forbidden = (message = 'Accesso non consentito.') =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (message = 'Risorsa non trovata.') =>
  new AppError(404, 'NOT_FOUND', message);

export const conflict = (message: string, code = 'CONFLICT') => new AppError(409, code, message);

export const unprocessable = (message: string, details?: unknown) =>
  new AppError(422, 'UNPROCESSABLE', message, details);

/**
 * Funzionalità prevista dall'architettura ma non disponibile nel prototipo
 * (tipicamente: provider Guardian non configurato).
 */
export const notImplemented = (message: string) =>
  new AppError(501, 'NOT_IMPLEMENTED', message);

export const serviceUnavailable = (message: string, code = 'SERVICE_UNAVAILABLE') =>
  new AppError(503, code, message);
