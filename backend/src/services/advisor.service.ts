import { prisma } from '../lib/prisma.js';
import { money, pct } from '../lib/money.js';
import { pageMeta, resolvePage } from '../lib/pagination.js';
import { getDataProvider } from '../providers/index.js';
import { PROPOSAL_STATUS_LABELS, type ProposalStatus, type RiskProfile } from '../domain/enums.js';
import { expireOverdueProposals } from './proposal.service.js';
import { getClientProfile, getSummary } from './portfolio.service.js';

/**
 * Area consulente.
 *
 * Il consulente vede ESCLUSIVAMENTE i clienti a lui assegnati: ogni query
 * parte da `advisorId`, ricavato dal token.
 */

export interface ClientListQuery {
  search?: string;
  riskProfile?: RiskProfile;
  onlyPendingProposals?: boolean;
  sort?: 'value_desc' | 'value_asc' | 'name_asc' | 'performance_desc' | 'performance_asc';
  page?: number;
  pageSize?: number;
}

/**
 * Lista clienti con patrimonio e performance.
 *
 * I valori arrivano dal provider in UNA chiamata aggregata: la lista resta
 * leggera anche con molti clienti (nessuna query per riga).
 */
export async function listAdvisorClients(advisorId: string, query: ClientListQuery) {
  await expireOverdueProposals({ advisorId });

  const clients = await prisma.client.findMany({
    where: {
      advisorId,
      ...(query.riskProfile ? { riskProfile: query.riskProfile } : {}),
      ...(query.search
        ? {
            OR: [
              { user: { firstName: { contains: query.search } } },
              { user: { lastName: { contains: query.search } } },
              { user: { email: { contains: query.search } } },
              { clientCode: { contains: query.search } },
              { city: { contains: query.search } },
            ],
          }
        : {}),
    },
    include: { user: true },
  });

  const clientIds = clients.map((client) => client.id);

  const [values, pendingCounts] = await Promise.all([
    getDataProvider().getLatestValues(clientIds),
    prisma.proposal.groupBy({
      by: ['clientId', 'status'],
      where: { clientId: { in: clientIds } },
      _count: { _all: true },
    }),
  ]);

  const valueByClient = new Map(values.map((value) => [value.clientId, value]));

  let rows = clients.map((client) => {
    const value = valueByClient.get(client.id);
    const pending =
      pendingCounts.find((row) => row.clientId === client.id && row.status === 'PENDING')?._count._all ?? 0;

    return {
      id: client.id,
      clientCode: client.clientCode,
      name: `${client.user.firstName} ${client.user.lastName}`,
      email: client.user.email,
      avatarColor: client.user.avatarColor,
      initials: `${client.user.firstName[0] ?? ''}${client.user.lastName[0] ?? ''}`.toUpperCase(),
      city: client.city,
      riskProfile: client.riskProfile as RiskProfile,
      totalValue: value?.totalValue ?? 0,
      currency: value?.currency ?? 'EUR',
      performancePct: value?.yearChangePct ?? 0,
      pnlPct: value?.pnlPct ?? 0,
      asOf: value?.asOf ?? null,
      pendingProposals: pending,
    };
  });

  if (query.onlyPendingProposals) {
    rows = rows.filter((row) => row.pendingProposals > 0);
  }

  const sorters: Record<NonNullable<ClientListQuery['sort']>, (a: typeof rows[number], b: typeof rows[number]) => number> = {
    value_desc: (a, b) => b.totalValue - a.totalValue,
    value_asc: (a, b) => a.totalValue - b.totalValue,
    name_asc: (a, b) => a.name.localeCompare(b.name, 'it'),
    performance_desc: (a, b) => b.performancePct - a.performancePct,
    performance_asc: (a, b) => a.performancePct - b.performancePct,
  };
  rows.sort(sorters[query.sort ?? 'value_desc']);

  const { page, pageSize, skip, take } = resolvePage(query);

  return {
    items: rows.slice(skip, skip + take),
    meta: pageMeta(page, pageSize, rows.length),
    totals: {
      clients: rows.length,
      assetsUnderManagement: money(rows.reduce((acc, row) => acc + row.totalValue, 0)),
      currency: 'EUR',
    },
  };
}

/** Dashboard del consulente: una sola richiesta per l'intera schermata. */
export async function getAdvisorDashboard(advisorId: string) {
  await expireOverdueProposals({ advisorId });

  const provider = getDataProvider();

  const advisor = await prisma.advisor.findUniqueOrThrow({
    where: { id: advisorId },
    include: { user: true },
  });

  const clients = await prisma.client.findMany({
    where: { advisorId },
    include: { user: true },
  });
  const clientIds = clients.map((client) => client.id);

  const [values, history, statusCounts, recentProposals, expiringSoon] = await Promise.all([
    provider.getLatestValues(clientIds),
    provider.getAggregatedHistory(clientIds, { range: '1Y', maxPoints: 60 }),
    prisma.proposal.groupBy({
      by: ['status'],
      where: { advisorId },
      _count: { status: true },
      _sum: { amount: true },
    }),
    prisma.proposal.findMany({
      where: { advisorId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { client: { include: { user: true } } },
    }),
    prisma.proposal.findMany({
      where: {
        advisorId,
        status: 'PENDING',
        expiresAt: { lte: new Date(Date.now() + 7 * 86_400_000) },
      },
      orderBy: { expiresAt: 'asc' },
      take: 5,
      include: { client: { include: { user: true } } },
    }),
  ]);

  const aum = money(values.reduce((acc, value) => acc + value.totalValue, 0));
  const counts = Object.fromEntries(statusCounts.map((row) => [row.status, row._count.status])) as Partial<
    Record<ProposalStatus, number>
  >;
  const answered = (counts.ACCEPTED ?? 0) + (counts.REJECTED ?? 0);

  const nameById = new Map(clients.map((client) => [client.id, `${client.user.firstName} ${client.user.lastName}`]));

  const topClients = [...values]
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 5)
    .map((value) => ({
      clientId: value.clientId,
      name: nameById.get(value.clientId) ?? '—',
      totalValue: value.totalValue,
      performancePct: value.yearChangePct,
    }));

  return {
    advisor: {
      id: advisor.id,
      name: `${advisor.user.firstName} ${advisor.user.lastName}`,
      code: advisor.code,
      officeCity: advisor.officeCity,
    },
    kpi: {
      clients: clients.length,
      assetsUnderManagement: aum,
      averagePortfolio: clients.length ? money(aum / clients.length) : 0,
      currency: 'EUR',
      pendingProposals: counts.PENDING ?? 0,
      acceptanceRatePct: answered ? pct(((counts.ACCEPTED ?? 0) / answered) * 100) : 0,
      proposalsTotal: statusCounts.reduce((acc, row) => acc + row._count.status, 0),
    },
    aumChart: history,
    proposalsByStatus: statusCounts.map((row) => ({
      status: row.status as ProposalStatus,
      label: PROPOSAL_STATUS_LABELS[row.status as ProposalStatus],
      count: row._count.status,
      amount: money(row._sum.amount ?? 0),
    })),
    topClients,
    recentProposals: recentProposals.map((proposal) => ({
      id: proposal.id,
      code: proposal.code,
      title: proposal.title,
      status: proposal.status as ProposalStatus,
      statusLabel: PROPOSAL_STATUS_LABELS[proposal.status as ProposalStatus],
      amount: money(proposal.amount),
      clientName: `${proposal.client.user.firstName} ${proposal.client.user.lastName}`,
      createdAt: proposal.createdAt.toISOString(),
    })),
    expiringSoon: expiringSoon.map((proposal) => ({
      id: proposal.id,
      code: proposal.code,
      title: proposal.title,
      clientName: `${proposal.client.user.firstName} ${proposal.client.user.lastName}`,
      expiresAt: proposal.expiresAt.toISOString(),
      daysToExpiry: Math.max(0, Math.ceil((proposal.expiresAt.getTime() - Date.now()) / 86_400_000)),
    })),
  };
}

/**
 * Schermata "dettaglio cliente" del consulente: anagrafica, patrimonio,
 * allocazione, mini-grafico e stato delle proposte in una sola richiesta.
 */
export async function getClientOverview(clientId: string) {
  const provider = getDataProvider();

  const [profile, summary, history, proposalCounts, documentsCount] = await Promise.all([
    getClientProfile(clientId),
    getSummary(clientId),
    provider.getHistory(clientId, { range: '1Y', maxPoints: 60 }),
    prisma.proposal.groupBy({
      by: ['status'],
      where: { clientId },
      _count: { status: true },
    }),
    prisma.document.count({ where: { clientId } }),
  ]);

  return {
    profile,
    summary,
    chart: history,
    proposals: proposalCounts.map((row) => ({
      status: row.status as ProposalStatus,
      label: PROPOSAL_STATUS_LABELS[row.status as ProposalStatus],
      count: row._count.status,
    })),
    documentsCount,
  };
}
