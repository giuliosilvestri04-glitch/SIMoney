import { getData, getEnvelope, query, request } from './client';
import type {
  AdvisorBreakdown,
  AdvisorClientRow,
  AdvisorDashboard,
  AllocationSlice,
  AssetClassMeta,
  AuditEntry,
  ClientHome,
  ClientOverview,
  ClientProfile,
  CompanyClientRow,
  CompanyOverview,
  CreateProposalPayload,
  DataSourceStatus,
  DemoAccounts,
  DocumentCategory,
  DocumentSummary,
  Envelope,
  HealthStatus,
  Holding,
  HoldingDetail,
  HistoryRange,
  InstrumentCatalogItem,
  LoginResponse,
  PortfolioHistory,
  PortfolioSnapshot,
  PortfolioSummary,
  ProposalDetail,
  ProposalResponseResult,
  ProposalStatus,
  ProposalsAnalytics,
  ProposalSummary,
  RiskProfile,
  Transaction,
  CurrentUser,
} from './types';

/**
 * Funzioni di accesso all'API, una per endpoint.
 * Le schermate non costruiscono mai URL a mano.
 */

export interface HistoryParams {
  range?: HistoryRange;
  from?: string;
  to?: string;
  maxPoints?: number;
}

function historyQuery(params: HistoryParams = {}): string {
  return query({
    range: params.from ? undefined : params.range,
    from: params.from,
    to: params.to,
    maxPoints: params.maxPoints,
  });
}

// --- Sistema ----------------------------------------------------------------

export const system = {
  health: () => getData<HealthStatus>('/health', { anonymous: true, timeoutMs: 6000 }),
  dataSource: () => getData<DataSourceStatus>('/system/data-source', { anonymous: true }),
  assetClasses: () => getData<AssetClassMeta[]>('/meta/asset-classes'),
};

// --- Autenticazione ---------------------------------------------------------

export const auth = {
  login: (email: string, password: string) =>
    getData<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { email: email.trim().toLowerCase(), password },
      anonymous: true,
    }),

  logout: (refreshToken: string | null) =>
    request<unknown>('/auth/logout', { method: 'POST', body: { refreshToken: refreshToken ?? undefined } }),

  me: () => getData<CurrentUser>('/auth/me'),

  demoAccounts: () => getData<DemoAccounts>('/auth/demo-accounts', { anonymous: true }),
};

// --- Area cliente -----------------------------------------------------------

export const client = {
  home: () => getData<ClientHome>('/client/home'),
  profile: () => getData<ClientProfile>('/client/profile'),
  summary: () => getData<PortfolioSummary>('/client/portfolio/summary'),
  history: (params: HistoryParams) => getData<PortfolioHistory>(`/client/portfolio/history${historyQuery(params)}`),
  snapshot: (date: string) => getData<PortfolioSnapshot>(`/client/portfolio/snapshot${query({ date })}`),
  allocation: (date?: string) => getData<AllocationSlice[]>(`/client/portfolio/allocation${query({ date })}`),
  investments: () => getData<Holding[]>('/client/investments'),
  investment: (id: string) => getData<HoldingDetail>(`/client/investments/${id}`),
  transactions: (page = 1, pageSize = 20) =>
    getEnvelope<Transaction[]>(`/client/transactions${query({ page, pageSize })}`),
  proposals: (status?: ProposalStatus, page = 1, pageSize = 50) =>
    getEnvelope<ProposalSummary[]>(`/client/proposals${query({ status, page, pageSize })}`),
  proposal: (id: string) => getData<ProposalDetail>(`/client/proposals/${id}`),
  acceptProposal: (id: string, note?: string) =>
    getData<ProposalResponseResult>(`/client/proposals/${id}/accept`, { method: 'POST', body: { note } }),
  rejectProposal: (id: string, note?: string) =>
    getData<ProposalResponseResult>(`/client/proposals/${id}/reject`, { method: 'POST', body: { note } }),
  documents: (category?: DocumentCategory) =>
    getData<DocumentSummary[]>(`/client/documents${query({ category })}`),
};

// --- Area consulente --------------------------------------------------------

export interface AdvisorClientsParams {
  search?: string;
  riskProfile?: RiskProfile;
  onlyPendingProposals?: boolean;
  sort?: 'value_desc' | 'value_asc' | 'name_asc' | 'performance_desc' | 'performance_asc';
  page?: number;
  pageSize?: number;
}

export const advisor = {
  dashboard: () => getData<AdvisorDashboard>('/advisor/dashboard'),

  clients: (params: AdvisorClientsParams = {}) =>
    getEnvelope<AdvisorClientRow[]>(
      `/advisor/clients${query({
        search: params.search,
        riskProfile: params.riskProfile,
        onlyPendingProposals: params.onlyPendingProposals ? true : undefined,
        sort: params.sort,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 50,
      })}`,
    ) as Promise<Envelope<AdvisorClientRow[]>>,

  clientOverview: (clientId: string) => getData<ClientOverview>(`/advisor/clients/${clientId}`),
  clientHistory: (clientId: string, params: HistoryParams) =>
    getData<PortfolioHistory>(`/advisor/clients/${clientId}/portfolio/history${historyQuery(params)}`),
  clientSnapshot: (clientId: string, date: string) =>
    getData<PortfolioSnapshot>(`/advisor/clients/${clientId}/portfolio/snapshot${query({ date })}`),
  clientAllocation: (clientId: string, date?: string) =>
    getData<AllocationSlice[]>(`/advisor/clients/${clientId}/portfolio/allocation${query({ date })}`),
  clientInvestments: (clientId: string) => getData<Holding[]>(`/advisor/clients/${clientId}/investments`),
  clientTransactions: (clientId: string, page = 1, pageSize = 20) =>
    getEnvelope<Transaction[]>(`/advisor/clients/${clientId}/transactions${query({ page, pageSize })}`),
  clientProposals: (clientId: string, status?: ProposalStatus) =>
    getEnvelope<ProposalSummary[]>(`/advisor/clients/${clientId}/proposals${query({ status, pageSize: 50 })}`),
  clientDocuments: (clientId: string) => getData<DocumentSummary[]>(`/advisor/clients/${clientId}/documents`),

  proposals: (status?: ProposalStatus, clientId?: string) =>
    getEnvelope<ProposalSummary[]>(`/advisor/proposals${query({ status, clientId, pageSize: 50 })}`),
  proposal: (id: string) => getData<ProposalDetail>(`/advisor/proposals/${id}`),
  createProposal: (payload: CreateProposalPayload) =>
    getData<ProposalDetail>('/advisor/proposals', { method: 'POST', body: payload, timeoutMs: 20_000 }),

  instruments: (search?: string, assetClassKey?: string) =>
    getData<InstrumentCatalogItem[]>(`/advisor/catalog/instruments${query({ search, assetClassKey })}`),
};

// --- Area direzione ---------------------------------------------------------

export const admin = {
  overview: () => getData<CompanyOverview>('/admin/analytics/overview'),
  aumHistory: (params: HistoryParams) =>
    getData<PortfolioHistory>(`/admin/analytics/aum-history${historyQuery(params)}`),
  allocation: () => getData<AllocationSlice[]>('/admin/analytics/allocation'),
  proposalsAnalytics: () => getData<ProposalsAnalytics>('/admin/analytics/proposals'),
  advisors: () => getData<AdvisorBreakdown[]>('/admin/advisors'),
  clients: (params: { search?: string; advisorId?: string; riskProfile?: RiskProfile; page?: number } = {}) =>
    getEnvelope<CompanyClientRow[]>(
      `/admin/clients${query({
        search: params.search,
        advisorId: params.advisorId,
        riskProfile: params.riskProfile,
        page: params.page ?? 1,
        pageSize: 50,
      })}`,
    ),
  clientOverview: (clientId: string) => getData<ClientOverview>(`/admin/clients/${clientId}`),
  proposals: (status?: ProposalStatus, advisorId?: string) =>
    getEnvelope<ProposalSummary[]>(`/admin/proposals${query({ status, advisorId, pageSize: 50 })}`),
  proposal: (id: string) => getData<ProposalDetail>(`/admin/proposals/${id}`),
  audit: (page = 1, action?: string) =>
    getEnvelope<AuditEntry[]>(`/admin/audit${query({ page, pageSize: 30, action })}`),
  auditSummary: () => getData<{ action: string; count: number }[]>('/admin/audit/summary'),
};

// --- Documenti --------------------------------------------------------------

export const documents = {
  metadata: (id: string) => getData<DocumentSummary>(`/documents/${id}`),
};
