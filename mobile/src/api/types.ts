/**
 * Tipi delle risposte del backend del prototipo.
 *
 * Rispecchiano i DTO definiti in `backend/src/providers/types.ts` e nei service.
 * L'app conosce SOLO questo contratto: non sa (e non deve sapere) se i dati
 * arrivino dal database mock o, in futuro, da Guardian.
 */

export type Role = 'CLIENT' | 'ADVISOR' | 'ADMIN';
export type ProposalStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
export type RiskProfile = 'PRUDENTE' | 'BILANCIATO' | 'DINAMICO' | 'AGGRESSIVO';
export type HistoryRange = '1D' | '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'MAX' | 'CUSTOM';
export type TransactionType =
  | 'BUY' | 'SELL' | 'DIVIDEND' | 'COUPON' | 'FEE' | 'DEPOSIT' | 'WITHDRAWAL';
export type DocumentCategory = 'PROPOSAL' | 'REPORT' | 'CONTRACT' | 'STATEMENT';

export interface Envelope<T> {
  data: T;
  meta?: PageMeta;
  totals?: Record<string, number | string>;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

// --- Auth -------------------------------------------------------------------

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  fullName: string;
  avatarColor: string;
  phone: string | null;
}

export interface LoginResponse {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: string;
  refreshExpiresAt: string;
}

export interface AdvisorContact {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  officeCity: string;
}

export type CurrentUser = SessionUser & {
  lastLoginAt: string | null;
  profile:
    | {
        type: 'CLIENT';
        clientId: string;
        clientCode: string;
        riskProfile: RiskProfile;
        city: string;
        onboardedAt: string;
        ibanMasked: string;
        advisor: AdvisorContact;
      }
    | {
        type: 'ADVISOR';
        advisorId: string;
        code: string;
        officeCity: string;
        bio: string | null;
        clientsCount: number;
      }
    | { type: 'ADMIN' };
};

export interface DemoAccount {
  email: string;
  password: string;
  role: Role;
  name: string;
  detail: string;
}

export interface DemoAccounts {
  note: string;
  password: string;
  accounts: DemoAccount[];
}

// --- Patrimonio -------------------------------------------------------------

export interface AssetClassRef {
  key: string;
  label: string;
  colorHex: string;
  orderIndex: number;
}

export interface AllocationSlice extends AssetClassRef {
  value: number;
  weightPct: number;
}

export interface PerformanceChange {
  absolute: number;
  percent: number;
}

export interface PortfolioSummary {
  portfolioId: string;
  clientId: string;
  currency: string;
  asOf: string;
  totalValue: number;
  investedValue: number;
  cashValue: number;
  pnlAbs: number;
  pnlPct: number;
  changes: {
    day: PerformanceChange;
    week: PerformanceChange;
    month: PerformanceChange;
    year: PerformanceChange;
  };
  holdingsCount: number;
  allocation: AllocationSlice[];
}

export interface HistoryPoint {
  date: string;
  totalValue: number;
}

export interface PortfolioHistory {
  range: HistoryRange;
  from: string;
  to: string;
  currency: string;
  points: HistoryPoint[];
  change: PerformanceChange;
  min: number;
  max: number;
  sourcePoints: number;
}

export interface PortfolioSnapshot {
  date: string;
  currency: string;
  totalValue: number;
  investedValue: number;
  cashValue: number;
  pnlAbs: number;
  pnlPct: number;
  allocation: AllocationSlice[];
  changeFromPreviousDay: PerformanceChange | null;
  approximated: boolean;
}

export interface Holding {
  id: string;
  instrument: { isin: string; name: string; type: string; issuer: string; currency: string };
  assetClass: AssetClassRef;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  costBasis: number;
  marketValue: number;
  weightPct: number;
  pnlAbs: number;
  pnlPct: number;
  openedAt: string;
}

export interface HoldingMovement {
  id: string;
  date: string;
  type: TransactionType;
  amount: number;
  quantity: number | null;
  price: number | null;
  description: string;
}

export type HoldingDetail = Holding & { movements: HoldingMovement[] };

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  amount: number;
  quantity: number | null;
  price: number | null;
  currency: string;
  description: string;
  instrument: { isin: string; name: string } | null;
}

export interface ClientProfile {
  id: string;
  clientCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string | null;
  avatarColor: string;
  city: string;
  birthDate: string;
  riskProfile: RiskProfile;
  taxCodeMasked: string;
  ibanMasked: string;
  onboardedAt: string;
  advisor: AdvisorContact;
  portfolios: { id: string; name: string; currency: string; openedAt: string }[];
}

// --- Proposte ---------------------------------------------------------------

export interface ProposalSummary {
  id: string;
  code: string;
  title: string;
  amount: number;
  currency: string;
  status: ProposalStatus;
  statusLabel: string;
  createdAt: string;
  expiresAt: string;
  daysToExpiry: number | null;
  respondedAt: string | null;
  isRead: boolean;
  documentsCount: number;
  itemsCount: number;
  client: { id: string; code: string; name: string } | null;
  advisor: { id: string; name: string } | null;
}

export interface ProposalItem {
  id: string;
  action: 'BUY' | 'SELL' | 'SWITCH';
  instrumentName: string;
  isin: string | null;
  amount: number;
  weightPct: number | null;
  note: string | null;
  assetClass: { key: string; label: string; colorHex: string } | null;
}

export interface ProposalAllocationRow {
  key: string;
  label: string;
  colorHex: string;
  currentPct: number;
  proposedPct: number;
  deltaPct: number;
}

export interface ProposalDetail extends ProposalSummary {
  description: string;
  rationale: string | null;
  responseNote: string | null;
  advisorContact: { email: string; phone: string | null; officeCity: string };
  items: ProposalItem[];
  allocation: ProposalAllocationRow[];
  documents: DocumentSummary[];
  simulationNotice: string;
}

export interface ProposalResponseResult {
  proposal: ProposalDetail;
  confirmation: {
    decision: 'ACCEPTED' | 'REJECTED';
    decisionLabel: string;
    message: string;
    respondedAt: string;
    notice: string;
  };
}

// --- Documenti --------------------------------------------------------------

export interface DocumentSummary {
  id: string;
  title: string;
  category: DocumentCategory;
  categoryLabel: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sizeLabel: string;
  proposalId: string | null;
  createdAt: string;
  downloadPath: string;
}

// --- Schermate aggregate ----------------------------------------------------

export interface ClientHome {
  summary: PortfolioSummary;
  chart: PortfolioHistory;
  pendingProposals: {
    id: string;
    code: string;
    title: string;
    amount: number;
    currency: string;
    status: ProposalStatus;
    statusLabel: string;
    createdAt: string;
    expiresAt: string;
    daysToExpiry: number;
    documentsCount: number;
    advisorName: string;
  }[];
  counters: {
    proposals: Partial<Record<ProposalStatus, number>>;
    documents: number;
  };
  recentActivity: {
    id: string;
    date: string;
    type: TransactionType;
    amount: number;
    description: string;
    instrumentName: string | null;
  }[];
}

export interface AdvisorClientRow {
  id: string;
  clientCode: string;
  name: string;
  email: string;
  avatarColor: string;
  initials: string;
  city: string;
  riskProfile: RiskProfile;
  totalValue: number;
  currency: string;
  performancePct: number;
  pnlPct: number;
  asOf: string | null;
  pendingProposals: number;
}

export interface AdvisorDashboard {
  advisor: { id: string; name: string; code: string; officeCity: string };
  kpi: {
    clients: number;
    assetsUnderManagement: number;
    averagePortfolio: number;
    currency: string;
    pendingProposals: number;
    acceptanceRatePct: number;
    proposalsTotal: number;
  };
  aumChart: PortfolioHistory;
  proposalsByStatus: { status: ProposalStatus; label: string; count: number; amount: number }[];
  topClients: { clientId: string; name: string; totalValue: number; performancePct: number }[];
  recentProposals: {
    id: string;
    code: string;
    title: string;
    status: ProposalStatus;
    statusLabel: string;
    amount: number;
    clientName: string;
    createdAt: string;
  }[];
  expiringSoon: {
    id: string;
    code: string;
    title: string;
    clientName: string;
    expiresAt: string;
    daysToExpiry: number;
  }[];
}

export interface ClientOverview {
  profile: ClientProfile;
  summary: PortfolioSummary;
  chart: PortfolioHistory;
  proposals: { status: ProposalStatus; label: string; count: number }[];
  documentsCount: number;
}

export interface CompanyOverview {
  kpi: {
    assetsUnderManagement: number;
    currency: string;
    clients: number;
    advisors: number;
    averagePortfolio: number;
    clientsPerAdvisor: number;
    monthChangePct: number;
    yearChangePct: number;
    proposalsTotal: number;
    pendingProposals: number;
    acceptanceRatePct: number;
  };
  aumChart: PortfolioHistory;
  allocation: AllocationSlice[];
  proposalsByStatus: { status: ProposalStatus; label: string; count: number; amount: number }[];
}

export interface AdvisorBreakdown {
  advisorId: string;
  code: string;
  name: string;
  officeCity: string;
  avatarColor: string;
  clients: number;
  assetsUnderManagement: number;
  averagePortfolio: number;
  shareOfCompanyPct: number;
  averagePerformancePct: number;
  proposals: { accepted: number; rejected: number; pending: number };
  acceptanceRatePct: number;
}

export interface ProposalsAnalytics {
  totals: {
    proposals: number;
    totalAmount: number;
    averageAmount: number;
    acceptanceRatePct: number;
    averageResponseHours: number;
    currency: string;
  };
  byStatus: { status: ProposalStatus; label: string; count: number; amount: number; sharePct: number }[];
  monthly: { month: string; created: number; accepted: number; rejected: number; amount: number }[];
}

export interface CompanyClientRow {
  id: string;
  clientCode: string;
  name: string;
  city: string;
  riskProfile: RiskProfile;
  avatarColor: string;
  totalValue: number;
  performancePct: number;
  currency: string;
  advisor: { id: string; name: string };
}

export interface AuditEntry {
  id: string;
  action: string;
  actor: { name: string; email: string | null; role: string | null };
  entityType: string | null;
  entityId: string | null;
  ip: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface InstrumentCatalogItem {
  id: string;
  isin: string;
  name: string;
  type: string;
  issuer: string;
  currency: string;
  description: string | null;
  assetClass: { key: string; label: string; colorHex: string };
}

export interface AssetClassMeta extends AssetClassRef {
  riskLevel: number;
  description: string | null;
}

// --- Sistema ----------------------------------------------------------------

export interface DataSourceStatus {
  name: 'mock' | 'guardian';
  available: boolean;
  configured: boolean;
  readOnly: boolean;
  description: string;
  selection: { requested: string; active: string; fallbackApplied: boolean; reason?: string };
  guardian: { configured: boolean; integrationReady: boolean; note: string };
  disclaimer: string;
}

export interface HealthStatus {
  status: string;
  service: string;
  version: string;
  environment: string;
  database: string;
  uptimeSeconds: number;
  timestamp: string;
}

// --- Creazione proposta -----------------------------------------------------

export interface CreateProposalPayload {
  clientId: string;
  title: string;
  description: string;
  rationale?: string;
  amount: number;
  expiresInDays?: number;
  items: {
    instrumentId?: string;
    instrumentName?: string;
    assetClassKey?: string;
    action: 'BUY' | 'SELL' | 'SWITCH';
    amount: number;
    note?: string;
  }[];
  proposedAllocation?: { assetClassKey: string; proposedPct: number }[];
  attachDocument?: boolean;
}
