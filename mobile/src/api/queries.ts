import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { ApiError } from './client';
import { admin, advisor, auth, client, system, type AdvisorClientsParams, type HistoryParams } from './endpoints';
import type {
  DocumentCategory,
  HistoryRange,
  ProposalStatus,
  RiskProfile,
} from './types';

/**
 * Hook di accesso ai dati basati su TanStack Query.
 *
 * Perché: cache condivisa fra schermate, stati di caricamento/errore uniformi,
 * ritentativi automatici e aggiornamento al ritorno della connessione.
 * È ciò che rende l'app "leggera": tornando su una schermata già vista i dati
 * sono immediati, e l'aggiornamento avviene in background.
 */

export const keys = {
  health: ['health'] as const,
  dataSource: ['data-source'] as const,
  assetClasses: ['asset-classes'] as const,
  me: ['me'] as const,
  demoAccounts: ['demo-accounts'] as const,

  clientHome: ['client', 'home'] as const,
  clientProfile: ['client', 'profile'] as const,
  clientSummary: ['client', 'summary'] as const,
  clientHistory: (params: HistoryParams) => ['client', 'history', params] as const,
  clientSnapshot: (date: string) => ['client', 'snapshot', date] as const,
  clientInvestments: ['client', 'investments'] as const,
  clientInvestment: (id: string) => ['client', 'investment', id] as const,
  clientTransactions: ['client', 'transactions'] as const,
  clientProposals: (status?: ProposalStatus) => ['client', 'proposals', status ?? 'all'] as const,
  clientProposal: (id: string) => ['client', 'proposal', id] as const,
  clientDocuments: (category?: DocumentCategory) => ['client', 'documents', category ?? 'all'] as const,

  advisorDashboard: ['advisor', 'dashboard'] as const,
  advisorClients: (params: AdvisorClientsParams) => ['advisor', 'clients', params] as const,
  advisorClient: (id: string) => ['advisor', 'client', id] as const,
  advisorClientHistory: (id: string, params: HistoryParams) => ['advisor', 'client', id, 'history', params] as const,
  advisorClientSnapshot: (id: string, date: string) => ['advisor', 'client', id, 'snapshot', date] as const,
  advisorClientInvestments: (id: string) => ['advisor', 'client', id, 'investments'] as const,
  advisorClientProposals: (id: string) => ['advisor', 'client', id, 'proposals'] as const,
  advisorClientDocuments: (id: string) => ['advisor', 'client', id, 'documents'] as const,
  advisorProposals: (status?: ProposalStatus) => ['advisor', 'proposals', status ?? 'all'] as const,
  advisorProposal: (id: string) => ['advisor', 'proposal', id] as const,
  instruments: (search?: string) => ['advisor', 'instruments', search ?? ''] as const,

  adminOverview: ['admin', 'overview'] as const,
  adminAumHistory: (params: HistoryParams) => ['admin', 'aum-history', params] as const,
  adminProposalsAnalytics: ['admin', 'proposals-analytics'] as const,
  adminAdvisors: ['admin', 'advisors'] as const,
  adminClients: (search?: string) => ['admin', 'clients', search ?? ''] as const,
  adminClient: (id: string) => ['admin', 'client', id] as const,
  adminProposals: (status?: ProposalStatus) => ['admin', 'proposals', status ?? 'all'] as const,
  adminProposal: (id: string) => ['admin', 'proposal', id] as const,
  adminAudit: (action?: string) => ['admin', 'audit', action ?? 'all'] as const,
};

/** Dati che cambiano di rado: si evitano richieste inutili. */
const SLOW_DATA = { staleTime: 5 * 60_000 };

type Options<T> = Omit<UseQueryOptions<T, ApiError>, 'queryKey' | 'queryFn'>;

// --- Sistema ----------------------------------------------------------------

export const useDataSource = () =>
  useQuery({ queryKey: keys.dataSource, queryFn: system.dataSource, ...SLOW_DATA });

export const useAssetClasses = () =>
  useQuery({ queryKey: keys.assetClasses, queryFn: system.assetClasses, ...SLOW_DATA });

export const useDemoAccounts = () =>
  useQuery({ queryKey: keys.demoAccounts, queryFn: auth.demoAccounts, ...SLOW_DATA, retry: 1 });

export const useCurrentUser = (options?: Options<Awaited<ReturnType<typeof auth.me>>>) =>
  useQuery({ queryKey: keys.me, queryFn: auth.me, ...SLOW_DATA, ...options });

// --- Cliente ----------------------------------------------------------------

export const useClientHome = () => useQuery({ queryKey: keys.clientHome, queryFn: client.home });

export const useClientProfile = () =>
  useQuery({ queryKey: keys.clientProfile, queryFn: client.profile, ...SLOW_DATA });

export const useClientSummary = () => useQuery({ queryKey: keys.clientSummary, queryFn: client.summary });

export const useClientHistory = (params: HistoryParams) =>
  useQuery({
    queryKey: keys.clientHistory(params),
    queryFn: () => client.history(params),
    // La serie storica di un periodo passato non cambia: si può tenere a lungo.
    staleTime: 5 * 60_000,
    placeholderData: (previous) => previous,
  });

export const useClientSnapshot = (date: string | null) =>
  useQuery({
    queryKey: keys.clientSnapshot(date ?? ''),
    queryFn: () => client.snapshot(date as string),
    enabled: Boolean(date),
    staleTime: 10 * 60_000,
  });

export const useClientInvestments = () =>
  useQuery({ queryKey: keys.clientInvestments, queryFn: client.investments });

export const useClientInvestment = (id: string) =>
  useQuery({ queryKey: keys.clientInvestment(id), queryFn: () => client.investment(id), enabled: Boolean(id) });

export const useClientTransactions = () =>
  useQuery({ queryKey: keys.clientTransactions, queryFn: () => client.transactions(1, 40) });

export const useClientProposals = (status?: ProposalStatus) =>
  useQuery({ queryKey: keys.clientProposals(status), queryFn: () => client.proposals(status) });

export const useClientProposal = (id: string) =>
  useQuery({ queryKey: keys.clientProposal(id), queryFn: () => client.proposal(id), enabled: Boolean(id) });

export const useClientDocuments = (category?: DocumentCategory) =>
  useQuery({ queryKey: keys.clientDocuments(category), queryFn: () => client.documents(category) });

/**
 * Risposta a una proposta.
 * Al successo invalida tutto ciò che mostra proposte o contatori, così l'app
 * riflette subito il nuovo stato senza che le schermate se ne occupino.
 */
export function useRespondToProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: 'ACCEPTED' | 'REJECTED'; note?: string }) =>
      decision === 'ACCEPTED' ? client.acceptProposal(id, note) : client.rejectProposal(id, note),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: keys.clientProposal(variables.id) });
      queryClient.invalidateQueries({ queryKey: ['client', 'proposals'] });
      queryClient.invalidateQueries({ queryKey: keys.clientHome });
      queryClient.invalidateQueries({ queryKey: ['client', 'documents'] });
    },
  });
}

// --- Consulente -------------------------------------------------------------

export const useAdvisorDashboard = () =>
  useQuery({ queryKey: keys.advisorDashboard, queryFn: advisor.dashboard });

export const useAdvisorClients = (params: AdvisorClientsParams) =>
  useQuery({
    queryKey: keys.advisorClients(params),
    queryFn: () => advisor.clients(params),
    placeholderData: (previous) => previous,
  });

export const useAdvisorClientOverview = (clientId: string) =>
  useQuery({
    queryKey: keys.advisorClient(clientId),
    queryFn: () => advisor.clientOverview(clientId),
    enabled: Boolean(clientId),
  });

export const useAdvisorClientHistory = (clientId: string, params: HistoryParams) =>
  useQuery({
    queryKey: keys.advisorClientHistory(clientId, params),
    queryFn: () => advisor.clientHistory(clientId, params),
    enabled: Boolean(clientId),
    staleTime: 5 * 60_000,
    placeholderData: (previous) => previous,
  });

export const useAdvisorClientSnapshot = (clientId: string, date: string | null) =>
  useQuery({
    queryKey: keys.advisorClientSnapshot(clientId, date ?? ''),
    queryFn: () => advisor.clientSnapshot(clientId, date as string),
    enabled: Boolean(clientId && date),
    staleTime: 10 * 60_000,
  });

export const useAdvisorClientInvestments = (clientId: string) =>
  useQuery({
    queryKey: keys.advisorClientInvestments(clientId),
    queryFn: () => advisor.clientInvestments(clientId),
    enabled: Boolean(clientId),
  });

export const useAdvisorClientProposals = (clientId: string) =>
  useQuery({
    queryKey: keys.advisorClientProposals(clientId),
    queryFn: () => advisor.clientProposals(clientId),
    enabled: Boolean(clientId),
  });

export const useAdvisorClientDocuments = (clientId: string) =>
  useQuery({
    queryKey: keys.advisorClientDocuments(clientId),
    queryFn: () => advisor.clientDocuments(clientId),
    enabled: Boolean(clientId),
  });

export const useAdvisorProposals = (status?: ProposalStatus) =>
  useQuery({ queryKey: keys.advisorProposals(status), queryFn: () => advisor.proposals(status) });

export const useAdvisorProposal = (id: string) =>
  useQuery({ queryKey: keys.advisorProposal(id), queryFn: () => advisor.proposal(id), enabled: Boolean(id) });

export const useInstruments = (search?: string) =>
  useQuery({
    queryKey: keys.instruments(search),
    queryFn: () => advisor.instruments(search),
    ...SLOW_DATA,
    placeholderData: (previous) => previous,
  });

export function useCreateProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: advisor.createProposal,
    onSuccess: (proposal) => {
      queryClient.invalidateQueries({ queryKey: ['advisor'] });
      if (proposal.client?.id) {
        queryClient.invalidateQueries({ queryKey: keys.advisorClient(proposal.client.id) });
      }
    },
  });
}

// --- Direzione --------------------------------------------------------------

export const useCompanyOverview = () => useQuery({ queryKey: keys.adminOverview, queryFn: admin.overview });

export const useCompanyAumHistory = (params: HistoryParams) =>
  useQuery({
    queryKey: keys.adminAumHistory(params),
    queryFn: () => admin.aumHistory(params),
    staleTime: 5 * 60_000,
    placeholderData: (previous) => previous,
  });

export const useProposalsAnalytics = () =>
  useQuery({ queryKey: keys.adminProposalsAnalytics, queryFn: admin.proposalsAnalytics });

export const useAdvisorsBreakdown = () =>
  useQuery({ queryKey: keys.adminAdvisors, queryFn: admin.advisors });

export const useCompanyClients = (search?: string) =>
  useQuery({
    queryKey: keys.adminClients(search),
    queryFn: () => admin.clients({ search }),
    placeholderData: (previous) => previous,
  });

export const useCompanyClientOverview = (clientId: string) =>
  useQuery({
    queryKey: keys.adminClient(clientId),
    queryFn: () => admin.clientOverview(clientId),
    enabled: Boolean(clientId),
  });

export const useCompanyProposals = (status?: ProposalStatus) =>
  useQuery({ queryKey: keys.adminProposals(status), queryFn: () => admin.proposals(status) });

export const useCompanyProposal = (id: string) =>
  useQuery({ queryKey: keys.adminProposal(id), queryFn: () => admin.proposal(id), enabled: Boolean(id) });

export const useAuditLog = (action?: string) =>
  useQuery({ queryKey: keys.adminAudit(action), queryFn: () => admin.audit(1, action) });

export type { HistoryRange, RiskProfile };
