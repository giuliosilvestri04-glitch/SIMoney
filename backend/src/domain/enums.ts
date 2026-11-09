/**
 * Valori "enumerati" del dominio.
 * SQLite non supporta gli enum di Prisma: la fonte di verità è questo file,
 * usato sia dai servizi sia dagli schemi JSON delle rotte.
 */

export const ROLES = ['CLIENT', 'ADVISOR', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const RISK_PROFILES = ['PRUDENTE', 'BILANCIATO', 'DINAMICO', 'AGGRESSIVO'] as const;
export type RiskProfile = (typeof RISK_PROFILES)[number];

export const INSTRUMENT_TYPES = ['ETF', 'FUND', 'BOND', 'STOCK', 'CASH'] as const;
export type InstrumentType = (typeof INSTRUMENT_TYPES)[number];

export const TRANSACTION_TYPES = [
  'BUY',
  'SELL',
  'DIVIDEND',
  'COUPON',
  'FEE',
  'DEPOSIT',
  'WITHDRAWAL',
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const PROPOSAL_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

/** Etichette italiane pronte per la UI mobile: evita duplicazioni nel frontend. */
export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  PENDING: 'In attesa',
  ACCEPTED: 'Accettata',
  REJECTED: 'Rifiutata',
  EXPIRED: 'Scaduta',
};

export const PROPOSAL_ACTIONS = ['BUY', 'SELL', 'SWITCH'] as const;
export type ProposalAction = (typeof PROPOSAL_ACTIONS)[number];

export const DOCUMENT_CATEGORIES = ['PROPOSAL', 'REPORT', 'CONTRACT', 'STATEMENT'] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  PROPOSAL: 'Proposta',
  REPORT: 'Report',
  CONTRACT: 'Contratto',
  STATEMENT: 'Rendiconto',
};

export const HISTORY_RANGES = ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', 'MAX', 'CUSTOM'] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number];

/** Azioni tracciate nell'audit log. */
export const AUDIT_ACTIONS = {
  LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
  LOGIN_FAILED: 'AUTH_LOGIN_FAILED',
  LOGOUT: 'AUTH_LOGOUT',
  TOKEN_REFRESH: 'AUTH_TOKEN_REFRESH',
  PROPOSAL_CREATED: 'PROPOSAL_CREATED',
  PROPOSAL_VIEWED: 'PROPOSAL_VIEWED',
  PROPOSAL_ACCEPTED: 'PROPOSAL_ACCEPTED',
  PROPOSAL_REJECTED: 'PROPOSAL_REJECTED',
  DOCUMENT_VIEWED: 'DOCUMENT_VIEWED',
  CLIENT_VIEWED: 'CLIENT_VIEWED',
  ANALYTICS_VIEWED: 'ANALYTICS_VIEWED',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
