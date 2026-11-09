import { HISTORY_RANGES, PROPOSAL_STATUSES, RISK_PROFILES } from '../domain/enums.js';

/**
 * Schemi JSON riutilizzabili.
 *
 * Ogni schema svolge DUE funzioni contemporaneamente:
 *  - valida la richiesta in ingresso (Fastify/Ajv);
 *  - genera la documentazione OpenAPI.
 * Non possono quindi divergere dal comportamento reale dell'API.
 */

export const errorResponseSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Codice stabile, usabile dal client mobile.' },
        message: { type: 'string' },
        details: {},
      },
      required: ['code', 'message'],
    },
  },
} as const;

/** Risposte di errore comuni a tutte le rotte autenticate. */
export const commonErrors = {
  400: { description: 'Richiesta non valida', ...errorResponseSchema },
  401: { description: 'Non autenticato', ...errorResponseSchema },
  403: { description: 'Non autorizzato per il ruolo', ...errorResponseSchema },
  404: { description: 'Risorsa non trovata o fuori dal perimetro consentito', ...errorResponseSchema },
} as const;

/** Risposta 200 documentata ma non restrittiva (non filtra i campi in uscita). */
export function ok(description: string) {
  return { 200: { description, type: 'object', additionalProperties: true } } as const;
}

export function okWithErrors(description: string) {
  return { ...ok(description), ...commonErrors } as const;
}

// ---------------------------------------------------------------------------
// Parametri ricorrenti
// ---------------------------------------------------------------------------

export const historyQuerySchema = {
  type: 'object',
  properties: {
    range: {
      type: 'string',
      enum: [...HISTORY_RANGES],
      default: '1Y',
      description: 'Periodo predefinito del grafico. Ignorato se si passa "from".',
    },
    from: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Periodo personalizzato (inizio).' },
    to: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Periodo personalizzato (fine).' },
    maxPoints: {
      type: 'integer',
      minimum: 2,
      maximum: 400,
      default: 120,
      description: 'Punti massimi restituiti: mantiene leggero il grafico su smartphone.',
    },
  },
  additionalProperties: false,
} as const;

export const dateQuerySchema = {
  type: 'object',
  properties: {
    date: {
      type: 'string',
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      description: 'Data selezionata dal calendario (YYYY-MM-DD).',
    },
  },
  additionalProperties: false,
} as const;

export const requiredDateQuerySchema = {
  type: 'object',
  required: ['date'],
  properties: dateQuerySchema.properties,
  additionalProperties: false,
} as const;

export const idParamSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1 } },
} as const;

export const clientIdParamSchema = {
  type: 'object',
  required: ['clientId'],
  properties: { clientId: { type: 'string', minLength: 1 } },
} as const;

export const pageQueryProps = {
  page: { type: 'integer', minimum: 1, default: 1 },
  pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
} as const;

export const proposalStatusEnum = [...PROPOSAL_STATUSES];
export const riskProfileEnum = [...RISK_PROFILES];

// ---------------------------------------------------------------------------
// Corpo richieste
// ---------------------------------------------------------------------------

export const loginBodySchema = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: { type: 'string', format: 'email', description: 'Email dell\'account demo.' },
    password: { type: 'string', minLength: 4 },
  },
  additionalProperties: false,
} as const;

export const refreshBodySchema = {
  type: 'object',
  required: ['refreshToken'],
  properties: { refreshToken: { type: 'string', minLength: 16 } },
  additionalProperties: false,
} as const;

export const proposalResponseBodySchema = {
  type: 'object',
  properties: {
    note: {
      type: 'string',
      maxLength: 500,
      description: 'Nota facoltativa del cliente (motivazione del rifiuto, commento).',
    },
  },
  additionalProperties: false,
} as const;

export const createProposalBodySchema = {
  type: 'object',
  required: ['clientId', 'title', 'description', 'amount', 'items'],
  properties: {
    clientId: { type: 'string', minLength: 1, description: 'Deve essere un cliente assegnato al consulente.' },
    title: { type: 'string', minLength: 3, maxLength: 120 },
    description: { type: 'string', minLength: 10, maxLength: 2000 },
    rationale: { type: 'string', maxLength: 2000, description: 'Motivazione tecnica facoltativa.' },
    amount: { type: 'number', exclusiveMinimum: 0 },
    expiresInDays: { type: 'integer', minimum: 1, maximum: 90, default: 14 },
    items: {
      type: 'array',
      minItems: 1,
      maxItems: 20,
      items: {
        type: 'object',
        required: ['action', 'amount'],
        properties: {
          instrumentId: { type: 'string', description: 'Strumento dal catalogo. Alternativo a instrumentName.' },
          instrumentName: { type: 'string', maxLength: 120 },
          assetClassKey: { type: 'string', description: 'Chiave asset class (se lo strumento non è a catalogo).' },
          action: { type: 'string', enum: ['BUY', 'SELL', 'SWITCH'] },
          amount: { type: 'number', exclusiveMinimum: 0 },
          note: { type: 'string', maxLength: 300 },
        },
        additionalProperties: false,
      },
    },
    proposedAllocation: {
      type: 'array',
      maxItems: 20,
      description: 'Allocazione proposta per asset class. La somma deve essere 100 (±0,5).',
      items: {
        type: 'object',
        required: ['assetClassKey', 'proposedPct'],
        properties: {
          assetClassKey: { type: 'string' },
          proposedPct: { type: 'number', minimum: 0, maximum: 100 },
        },
        additionalProperties: false,
      },
    },
    attachDocument: {
      type: 'boolean',
      default: true,
      description: 'Genera automaticamente la scheda proposta in PDF (documento fittizio).',
    },
  },
  additionalProperties: false,
} as const;
