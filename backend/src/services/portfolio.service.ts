import { prisma } from '../lib/prisma.js';
import { notFound } from '../lib/errors.js';
import { toISODate } from '../lib/dates.js';
import { getDataProvider } from '../providers/index.js';
import { PROPOSAL_STATUS_LABELS, type ProposalStatus } from '../domain/enums.js';
import type { HistoryQuery } from '../providers/types.js';

/**
 * Servizio di patrimonio.
 *
 * NON conosce il database per i dati di patrimonio: passa sempre dal
 * `PortfolioDataProvider`. È questo che rende sostituibile la sorgente dati
 * (mock oggi, Guardian domani) senza toccare rotte e frontend.
 *
 * Legge direttamente da Prisma solo ciò che è del prototipo e non di Guardian:
 * anagrafiche, proposte, documenti.
 */

export function getSummary(clientId: string) {
  return getDataProvider().getPortfolioSummary(clientId);
}

export function getHistory(clientId: string, query: HistoryQuery) {
  return getDataProvider().getHistory(clientId, query);
}

export function getSnapshot(clientId: string, date: string) {
  return getDataProvider().getSnapshotAt(clientId, date);
}

export function getAllocation(clientId: string, date?: string) {
  return getDataProvider().getAllocation(clientId, date);
}

export function getInvestments(clientId: string) {
  return getDataProvider().getHoldings(clientId);
}

export function getTransactions(clientId: string, query: { page?: number; pageSize?: number }) {
  return getDataProvider().getTransactions(clientId, query);
}

/** Dettaglio di una singola posizione, con i movimenti collegati. */
export async function getInvestmentDetail(clientId: string, holdingId: string) {
  const holdings = await getDataProvider().getHoldings(clientId);
  const holding = holdings.find((item) => item.id === holdingId);
  if (!holding) throw notFound('Investimento non trovato.');

  const movements = await prisma.transaction.findMany({
    where: {
      portfolio: { clientId },
      instrument: { isin: holding.instrument.isin },
    },
    orderBy: { date: 'desc' },
    take: 20,
  });

  return {
    ...holding,
    movements: movements.map((movement) => ({
      id: movement.id,
      date: toISODate(movement.date),
      type: movement.type,
      amount: movement.amount,
      quantity: movement.quantity,
      price: movement.price,
      description: movement.description,
    })),
  };
}

/** Anagrafica del cliente (senza dati personali reali: tutto fittizio e mascherato). */
export async function getClientProfile(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      user: true,
      advisor: { include: { user: true } },
      portfolios: { select: { id: true, name: true, baseCurrency: true, openedAt: true } },
    },
  });
  if (!client) throw notFound('Cliente non trovato.');

  return {
    id: client.id,
    clientCode: client.clientCode,
    firstName: client.user.firstName,
    lastName: client.user.lastName,
    fullName: `${client.user.firstName} ${client.user.lastName}`,
    email: client.user.email,
    phone: client.user.phone,
    avatarColor: client.user.avatarColor,
    city: client.city,
    birthDate: toISODate(client.birthDate),
    riskProfile: client.riskProfile,
    taxCodeMasked: client.taxCodeMasked,
    ibanMasked: client.ibanMasked,
    onboardedAt: toISODate(client.onboardedAt),
    advisor: {
      id: client.advisor.id,
      name: `${client.advisor.user.firstName} ${client.advisor.user.lastName}`,
      email: client.advisor.user.email,
      phone: client.advisor.user.phone,
      officeCity: client.advisor.officeCity,
    },
    portfolios: client.portfolios.map((portfolio) => ({
      id: portfolio.id,
      name: portfolio.name,
      currency: portfolio.baseCurrency,
      openedAt: toISODate(portfolio.openedAt),
    })),
  };
}

/**
 * Schermata HOME del cliente in UNA sola richiesta.
 *
 * Requisito 40 (leggerezza): l'app non deve fare 5 chiamate per disegnare la
 * prima schermata. Qui vengono composti patrimonio, mini-grafico, allocazione,
 * proposte in attesa e attività recenti.
 */
export async function getClientHome(clientId: string) {
  const provider = getDataProvider();

  const [summary, history, pendingProposals, recentTransactions, documentsCount] = await Promise.all([
    provider.getPortfolioSummary(clientId),
    provider.getHistory(clientId, { range: '6M', maxPoints: 60 }),
    prisma.proposal.findMany({
      where: { clientId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { advisor: { include: { user: true } }, _count: { select: { documents: true } } },
    }),
    prisma.transaction.findMany({
      where: { portfolio: { clientId } },
      orderBy: { date: 'desc' },
      take: 5,
      include: { instrument: { select: { name: true } } },
    }),
    prisma.document.count({ where: { clientId } }),
  ]);

  const proposalCounts = await prisma.proposal.groupBy({
    by: ['status'],
    where: { clientId },
    _count: { status: true },
  });

  return {
    summary,
    chart: history,
    pendingProposals: pendingProposals.map((proposal) => ({
      id: proposal.id,
      code: proposal.code,
      title: proposal.title,
      amount: proposal.amount,
      currency: proposal.currency,
      status: proposal.status as ProposalStatus,
      statusLabel: PROPOSAL_STATUS_LABELS[proposal.status as ProposalStatus],
      createdAt: proposal.createdAt.toISOString(),
      expiresAt: proposal.expiresAt.toISOString(),
      daysToExpiry: Math.max(
        0,
        Math.ceil((proposal.expiresAt.getTime() - Date.now()) / 86_400_000),
      ),
      documentsCount: proposal._count.documents,
      advisorName: `${proposal.advisor.user.firstName} ${proposal.advisor.user.lastName}`,
    })),
    counters: {
      proposals: Object.fromEntries(
        proposalCounts.map((row) => [row.status, row._count.status]),
      ) as Partial<Record<ProposalStatus, number>>,
      documents: documentsCount,
    },
    recentActivity: recentTransactions.map((transaction) => ({
      id: transaction.id,
      date: toISODate(transaction.date),
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description,
      instrumentName: transaction.instrument?.name ?? null,
    })),
  };
}
