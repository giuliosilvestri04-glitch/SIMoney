import { prisma } from '../lib/prisma.js';
import { money, pct } from '../lib/money.js';
import { pageMeta, resolvePage } from '../lib/pagination.js';
import { getDataProvider } from '../providers/index.js';
import { PROPOSAL_STATUS_LABELS, type ProposalStatus, type RiskProfile } from '../domain/enums.js';
import { expireOverdueProposals } from './proposal.service.js';
import type { HistoryQuery } from '../providers/types.js';

/**
 * Analytics aziendali (ruolo ADMIN / boss).
 *
 * I dati di patrimonio passano sempre dal provider: se domani la sorgente
 * diventa Guardian, queste funzioni non cambiano.
 * Da Prisma arrivano solo le entità del prototipo (clienti, consulenti, proposte).
 *
 * Le analisi sono pensate per schermate SMARTPHONE: pochi indicatori grandi,
 * serie già pronte da disegnare, nessuna tabella desktop.
 */

async function allClientIds(): Promise<string[]> {
  const clients = await prisma.client.findMany({ select: { id: true } });
  return clients.map((client) => client.id);
}

/** Dashboard direzionale: una sola richiesta per l'intera schermata. */
export async function getCompanyOverview() {
  await expireOverdueProposals();
  const provider = getDataProvider();

  const clientIds = await allClientIds();

  const [values, allocation, history, advisorsCount, statusCounts, previousMonthValues] = await Promise.all([
    provider.getLatestValues(clientIds),
    provider.getAggregatedAllocation(clientIds),
    provider.getAggregatedHistory(clientIds, { range: '1Y', maxPoints: 60 }),
    prisma.advisor.count(),
    prisma.proposal.groupBy({ by: ['status'], _count: { status: true }, _sum: { amount: true } }),
    provider.getAggregatedHistory(clientIds, { range: '1M', maxPoints: 2 }),
  ]);

  const totalAum = money(values.reduce((acc, value) => acc + value.totalValue, 0));
  const counts = Object.fromEntries(statusCounts.map((row) => [row.status, row._count.status])) as Partial<
    Record<ProposalStatus, number>
  >;
  const answered = (counts.ACCEPTED ?? 0) + (counts.REJECTED ?? 0);
  const proposalsTotal = statusCounts.reduce((acc, row) => acc + row._count.status, 0);

  return {
    kpi: {
      assetsUnderManagement: totalAum,
      currency: 'EUR',
      clients: clientIds.length,
      advisors: advisorsCount,
      averagePortfolio: clientIds.length ? money(totalAum / clientIds.length) : 0,
      clientsPerAdvisor: advisorsCount ? Math.round((clientIds.length / advisorsCount) * 10) / 10 : 0,
      monthChangePct: previousMonthValues.change.percent,
      yearChangePct: history.change.percent,
      proposalsTotal,
      pendingProposals: counts.PENDING ?? 0,
      acceptanceRatePct: answered ? pct(((counts.ACCEPTED ?? 0) / answered) * 100) : 0,
    },
    aumChart: history,
    allocation,
    proposalsByStatus: statusCounts.map((row) => ({
      status: row.status as ProposalStatus,
      label: PROPOSAL_STATUS_LABELS[row.status as ProposalStatus],
      count: row._count.status,
      amount: money(row._sum.amount ?? 0),
    })),
  };
}

export function getCompanyAumHistory(query: HistoryQuery) {
  return allClientIds().then((ids) => getDataProvider().getAggregatedHistory(ids, query));
}

export function getCompanyAllocation() {
  return allClientIds().then((ids) => getDataProvider().getAggregatedAllocation(ids));
}

/** Patrimonio e clienti per consulente: confronto della rete commerciale. */
export async function getAdvisorsBreakdown() {
  const provider = getDataProvider();

  const advisors = await prisma.advisor.findMany({
    include: { user: true, clients: { select: { id: true } } },
  });

  const clientIds = advisors.flatMap((advisor) => advisor.clients.map((client) => client.id));
  const [values, proposalCounts] = await Promise.all([
    provider.getLatestValues(clientIds),
    prisma.proposal.groupBy({ by: ['advisorId', 'status'], _count: { _all: true } }),
  ]);

  const valueByClient = new Map(values.map((value) => [value.clientId, value]));
  const totalAum = values.reduce((acc, value) => acc + value.totalValue, 0);

  const rows = advisors.map((advisor) => {
    const advisorValues = advisor.clients
      .map((client) => valueByClient.get(client.id))
      .filter((value): value is NonNullable<typeof value> => Boolean(value));

    const aum = advisorValues.reduce((acc, value) => acc + value.totalValue, 0);
    const accepted = proposalCounts.find((r) => r.advisorId === advisor.id && r.status === 'ACCEPTED')?._count._all ?? 0;
    const rejected = proposalCounts.find((r) => r.advisorId === advisor.id && r.status === 'REJECTED')?._count._all ?? 0;
    const pending = proposalCounts.find((r) => r.advisorId === advisor.id && r.status === 'PENDING')?._count._all ?? 0;
    const answered = accepted + rejected;

    return {
      advisorId: advisor.id,
      code: advisor.code,
      name: `${advisor.user.firstName} ${advisor.user.lastName}`,
      officeCity: advisor.officeCity,
      avatarColor: advisor.user.avatarColor,
      clients: advisor.clients.length,
      assetsUnderManagement: money(aum),
      averagePortfolio: advisor.clients.length ? money(aum / advisor.clients.length) : 0,
      shareOfCompanyPct: totalAum > 0 ? pct((aum / totalAum) * 100) : 0,
      averagePerformancePct: advisorValues.length
        ? pct(advisorValues.reduce((acc, value) => acc + value.yearChangePct, 0) / advisorValues.length)
        : 0,
      proposals: { accepted, rejected, pending },
      acceptanceRatePct: answered ? pct((accepted / answered) * 100) : 0,
    };
  });

  return rows.sort((a, b) => b.assetsUnderManagement - a.assetsUnderManagement);
}

/** Imbuto e andamento delle proposte aziendali. */
export async function getProposalsAnalytics(months = 12) {
  await expireOverdueProposals();

  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - months);

  const [statusCounts, recent] = await Promise.all([
    prisma.proposal.groupBy({ by: ['status'], _count: { status: true }, _sum: { amount: true } }),
    prisma.proposal.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, respondedAt: true, status: true, amount: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const byMonth = new Map<string, { created: number; accepted: number; rejected: number; amount: number }>();
  for (const proposal of recent) {
    const key = proposal.createdAt.toISOString().slice(0, 7);
    const bucket = byMonth.get(key) ?? { created: 0, accepted: 0, rejected: 0, amount: 0 };
    bucket.created += 1;
    bucket.amount += proposal.amount;
    if (proposal.status === 'ACCEPTED') bucket.accepted += 1;
    if (proposal.status === 'REJECTED') bucket.rejected += 1;
    byMonth.set(key, bucket);
  }

  const responded = recent.filter((proposal) => proposal.respondedAt !== null);
  const averageResponseHours = responded.length
    ? Math.round(
        responded.reduce(
          (acc, proposal) => acc + (proposal.respondedAt!.getTime() - proposal.createdAt.getTime()) / 3_600_000,
          0,
        ) / responded.length,
      )
    : 0;

  const counts = Object.fromEntries(statusCounts.map((row) => [row.status, row._count.status])) as Partial<
    Record<ProposalStatus, number>
  >;
  const answered = (counts.ACCEPTED ?? 0) + (counts.REJECTED ?? 0);
  const total = statusCounts.reduce((acc, row) => acc + row._count.status, 0);
  const totalAmount = statusCounts.reduce((acc, row) => acc + (row._sum.amount ?? 0), 0);

  return {
    totals: {
      proposals: total,
      totalAmount: money(totalAmount),
      averageAmount: total ? money(totalAmount / total) : 0,
      acceptanceRatePct: answered ? pct(((counts.ACCEPTED ?? 0) / answered) * 100) : 0,
      averageResponseHours,
      currency: 'EUR',
    },
    byStatus: statusCounts.map((row) => ({
      status: row.status as ProposalStatus,
      label: PROPOSAL_STATUS_LABELS[row.status as ProposalStatus],
      count: row._count.status,
      amount: money(row._sum.amount ?? 0),
      sharePct: total ? pct((row._count.status / total) * 100) : 0,
    })),
    monthly: [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, bucket]) => ({
        month,
        created: bucket.created,
        accepted: bucket.accepted,
        rejected: bucket.rejected,
        amount: money(bucket.amount),
      })),
  };
}

/** Elenco clienti aziendale con patrimonio e consulente di riferimento. */
export async function listCompanyClients(query: {
  search?: string;
  advisorId?: string;
  riskProfile?: RiskProfile;
  page?: number;
  pageSize?: number;
}) {
  const clients = await prisma.client.findMany({
    where: {
      ...(query.advisorId ? { advisorId: query.advisorId } : {}),
      ...(query.riskProfile ? { riskProfile: query.riskProfile } : {}),
      ...(query.search
        ? {
            OR: [
              { user: { firstName: { contains: query.search } } },
              { user: { lastName: { contains: query.search } } },
              { clientCode: { contains: query.search } },
              { city: { contains: query.search } },
            ],
          }
        : {}),
    },
    include: { user: true, advisor: { include: { user: true } } },
  });

  const values = await getDataProvider().getLatestValues(clients.map((client) => client.id));
  const valueByClient = new Map(values.map((value) => [value.clientId, value]));

  const rows = clients
    .map((client) => {
      const value = valueByClient.get(client.id);
      return {
        id: client.id,
        clientCode: client.clientCode,
        name: `${client.user.firstName} ${client.user.lastName}`,
        city: client.city,
        riskProfile: client.riskProfile as RiskProfile,
        avatarColor: client.user.avatarColor,
        totalValue: value?.totalValue ?? 0,
        performancePct: value?.yearChangePct ?? 0,
        currency: value?.currency ?? 'EUR',
        advisor: {
          id: client.advisor.id,
          name: `${client.advisor.user.firstName} ${client.advisor.user.lastName}`,
        },
      };
    })
    .sort((a, b) => b.totalValue - a.totalValue);

  const { page, pageSize, skip, take } = resolvePage(query);

  return {
    items: rows.slice(skip, skip + take),
    meta: pageMeta(page, pageSize, rows.length),
    totals: { assetsUnderManagement: money(rows.reduce((acc, row) => acc + row.totalValue, 0)), currency: 'EUR' },
  };
}
