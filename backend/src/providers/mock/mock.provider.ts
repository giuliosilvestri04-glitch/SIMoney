import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';
import { changePct, money, normalizeWeights, pct } from '../../lib/money.js';
import { addDays, addMonths, downsample, parseISODate, resolveRange, toISODate } from '../../lib/dates.js';
import type { InstrumentType, TransactionType } from '../../domain/enums.js';
import type {
  AllocationSlice,
  AssetClassRef,
  ClientValue,
  HistoryQuery,
  HoldingDTO,
  PagedResult,
  PerformanceChange,
  PortfolioDataProvider,
  PortfolioHistory,
  PortfolioSnapshotDTO,
  PortfolioSummary,
  ProviderStatus,
  TransactionDTO,
} from '../types.js';

const DEFAULT_MAX_POINTS = 120;

/**
 * Implementazione della sorgente dati sul DATABASE DEL PROTOTIPO.
 *
 * È il provider attivo per la demo: garantisce che l'applicazione funzioni al
 * 100% senza Guardian, senza rete e senza infrastruttura aziendale.
 */
export class MockDataProvider implements PortfolioDataProvider {
  readonly name = 'mock' as const;

  async isAvailable(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async status(): Promise<ProviderStatus> {
    const available = await this.isAvailable();
    return {
      name: 'mock',
      available,
      configured: true,
      readOnly: false,
      description:
        'Dati simulati dal database locale del prototipo. Nessuna dipendenza da Guardian o da sistemi aziendali.',
    };
  }

  async getAssetClasses(): Promise<AssetClassRef[]> {
    const classes = await prisma.assetClass.findMany({ orderBy: { orderIndex: 'asc' } });
    return classes.map(toAssetClassRef);
  }

  // -------------------------------------------------------------------------
  // Patrimonio
  // -------------------------------------------------------------------------

  async getPortfolioSummary(clientId: string): Promise<PortfolioSummary> {
    const portfolio = await this.requirePortfolio(clientId);

    const latest = await prisma.portfolioSnapshot.findFirst({
      where: { portfolioId: portfolio.id },
      orderBy: { date: 'desc' },
      include: { allocations: { include: { assetClass: true } } },
    });

    if (!latest) {
      throw notFound('Nessuno storico disponibile per questo portafoglio.');
    }

    const [holdingsCount, dayAgo, weekAgo, monthAgo, yearAgo] = await Promise.all([
      prisma.holding.count({ where: { portfolioId: portfolio.id } }),
      this.valueAtOrBefore(portfolio.id, addDays(latest.date, -1)),
      this.valueAtOrBefore(portfolio.id, addDays(latest.date, -7)),
      this.valueAtOrBefore(portfolio.id, addMonths(latest.date, -1)),
      this.valueAtOrBefore(portfolio.id, addMonths(latest.date, -12)),
    ]);

    return {
      portfolioId: portfolio.id,
      clientId,
      currency: portfolio.baseCurrency,
      asOf: toISODate(latest.date),
      totalValue: money(latest.totalValue),
      investedValue: money(latest.investedValue),
      cashValue: money(latest.cashValue),
      pnlAbs: money(latest.pnlAbs),
      pnlPct: pct(latest.pnlPct),
      changes: {
        day: buildChange(dayAgo, latest.totalValue),
        week: buildChange(weekAgo, latest.totalValue),
        month: buildChange(monthAgo, latest.totalValue),
        year: buildChange(yearAgo, latest.totalValue),
      },
      holdingsCount,
      allocation: toAllocation(latest.allocations),
    };
  }

  async getHistory(clientId: string, query: HistoryQuery): Promise<PortfolioHistory> {
    const portfolio = await this.requirePortfolio(clientId);
    const bounds = await this.historyBounds(portfolio.id);
    if (!bounds) {
      return emptyHistory(portfolio.baseCurrency, query);
    }

    const { range, from, to } = resolveRange(query.range, bounds.last, bounds.first, {
      from: query.from,
      to: query.to,
    });

    const snapshots = await prisma.portfolioSnapshot.findMany({
      where: { portfolioId: portfolio.id, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
      select: { date: true, totalValue: true },
    });

    return buildHistory(
      snapshots.map((s) => ({ date: toISODate(s.date), totalValue: money(s.totalValue) })),
      { range, from, to },
      portfolio.baseCurrency,
      query.maxPoints ?? DEFAULT_MAX_POINTS,
    );
  }

  async getSnapshotAt(clientId: string, date: string): Promise<PortfolioSnapshotDTO> {
    const portfolio = await this.requirePortfolio(clientId);
    const requested = parseISODate(date);

    const snapshot = await prisma.portfolioSnapshot.findFirst({
      where: { portfolioId: portfolio.id, date: { lte: requested } },
      orderBy: { date: 'desc' },
      include: { allocations: { include: { assetClass: true } } },
    });

    if (!snapshot) {
      throw notFound(
        `Nessun dato disponibile alla data ${date}: precede l'apertura del rapporto.`,
      );
    }

    const previous = await this.valueAtOrBefore(portfolio.id, addDays(snapshot.date, -1));

    return {
      date: toISODate(snapshot.date),
      currency: portfolio.baseCurrency,
      totalValue: money(snapshot.totalValue),
      investedValue: money(snapshot.investedValue),
      cashValue: money(snapshot.cashValue),
      pnlAbs: money(snapshot.pnlAbs),
      pnlPct: pct(snapshot.pnlPct),
      allocation: toAllocation(snapshot.allocations),
      changeFromPreviousDay: previous === null ? null : buildChange(previous, snapshot.totalValue),
      approximated: toISODate(snapshot.date) !== date,
    };
  }

  async getAllocation(clientId: string, date?: string): Promise<AllocationSlice[]> {
    if (date) {
      const snapshot = await this.getSnapshotAt(clientId, date);
      return snapshot.allocation;
    }
    const summary = await this.getPortfolioSummary(clientId);
    return summary.allocation;
  }

  async getHoldings(clientId: string): Promise<HoldingDTO[]> {
    const portfolio = await this.requirePortfolio(clientId);

    const holdings = await prisma.holding.findMany({
      where: { portfolioId: portfolio.id },
      include: { instrument: { include: { assetClass: true } } },
      orderBy: { marketValue: 'desc' },
    });

    const total = holdings.reduce((acc, h) => acc + h.marketValue, 0);

    return holdings.map((holding) => ({
      id: holding.id,
      instrument: {
        isin: holding.instrument.isin,
        name: holding.instrument.name,
        type: holding.instrument.type as InstrumentType,
        issuer: holding.instrument.issuer,
        currency: holding.instrument.currency,
      },
      assetClass: toAssetClassRef(holding.instrument.assetClass),
      quantity: holding.quantity,
      avgPrice: holding.avgPrice,
      currentPrice: holding.currentPrice,
      costBasis: money(holding.costBasis),
      marketValue: money(holding.marketValue),
      weightPct: total > 0 ? pct((holding.marketValue / total) * 100) : 0,
      pnlAbs: money(holding.marketValue - holding.costBasis),
      pnlPct: changePct(holding.costBasis, holding.marketValue),
      openedAt: toISODate(holding.openedAt),
    }));
  }

  async getTransactions(
    clientId: string,
    query: { page?: number; pageSize?: number },
  ): Promise<PagedResult<TransactionDTO>> {
    const portfolio = await this.requirePortfolio(clientId);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    const [total, rows] = await Promise.all([
      prisma.transaction.count({ where: { portfolioId: portfolio.id } }),
      prisma.transaction.findMany({
        where: { portfolioId: portfolio.id },
        orderBy: { date: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { instrument: { select: { isin: true, name: true } } },
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      items: rows.map((row) => ({
        id: row.id,
        date: toISODate(row.date),
        type: row.type as TransactionType,
        amount: money(row.amount),
        quantity: row.quantity,
        price: row.price,
        currency: row.currency,
        description: row.description,
        instrument: row.instrument ? { isin: row.instrument.isin, name: row.instrument.name } : null,
      })),
      meta: { page, pageSize, total, totalPages, hasNext: page < totalPages },
    };
  }

  async getAggregatedHistory(clientIds: string[], query: HistoryQuery): Promise<PortfolioHistory> {
    if (clientIds.length === 0) return emptyHistory('EUR', query);

    const portfolios = await prisma.portfolio.findMany({
      where: { clientId: { in: clientIds } },
      select: { id: true, baseCurrency: true },
    });
    if (portfolios.length === 0) return emptyHistory('EUR', query);

    const portfolioIds = portfolios.map((p) => p.id);

    const bounds = await prisma.portfolioSnapshot.aggregate({
      where: { portfolioId: { in: portfolioIds } },
      _min: { date: true },
      _max: { date: true },
    });
    if (!bounds._min.date || !bounds._max.date) return emptyHistory('EUR', query);

    const { range, from, to } = resolveRange(query.range, bounds._max.date, bounds._min.date, {
      from: query.from,
      to: query.to,
    });

    // Somma dei patrimoni per data: una sola query aggregata invece di N letture.
    const grouped = await prisma.portfolioSnapshot.groupBy({
      by: ['date'],
      where: { portfolioId: { in: portfolioIds }, date: { gte: from, lte: to } },
      _sum: { totalValue: true },
      orderBy: { date: 'asc' },
    });

    return buildHistory(
      grouped.map((g) => ({ date: toISODate(g.date), totalValue: money(g._sum.totalValue ?? 0) })),
      { range, from, to },
      portfolios[0]?.baseCurrency ?? 'EUR',
      query.maxPoints ?? DEFAULT_MAX_POINTS,
    );
  }

  async getLatestValues(clientIds: string[]): Promise<ClientValue[]> {
    if (clientIds.length === 0) return [];

    const portfolios = await prisma.portfolio.findMany({
      where: { clientId: { in: clientIds } },
      select: { id: true, clientId: true, baseCurrency: true },
    });
    if (portfolios.length === 0) return [];

    const portfolioIds = portfolios.map((p) => p.id);

    // Ultima data disponibile per ciascun portafoglio (una sola query).
    const latestDates = await prisma.portfolioSnapshot.groupBy({
      by: ['portfolioId'],
      where: { portfolioId: { in: portfolioIds } },
      _max: { date: true },
    });

    const distinctDates = [
      ...new Set(latestDates.map((row) => row._max.date?.getTime()).filter((t): t is number => !!t)),
    ].map((time) => new Date(time));

    const snapshots = await prisma.portfolioSnapshot.findMany({
      where: { portfolioId: { in: portfolioIds }, date: { in: distinctDates } },
      select: { portfolioId: true, date: true, totalValue: true, pnlAbs: true, pnlPct: true },
    });

    const latestByPortfolio = new Map<string, (typeof snapshots)[number]>();
    for (const row of latestDates) {
      if (!row._max.date) continue;
      const match = snapshots.find(
        (s) => s.portfolioId === row.portfolioId && s.date.getTime() === row._max.date!.getTime(),
      );
      if (match) latestByPortfolio.set(row.portfolioId, match);
    }

    // Valore a 12 mesi prima, per la variazione annua mostrata nella lista clienti.
    const yearAgoValues = await Promise.all(
      portfolios.map(async (portfolio) => {
        const latest = latestByPortfolio.get(portfolio.id);
        if (!latest) return null;
        const previous = await this.valueAtOrBefore(portfolio.id, addMonths(latest.date, -12));
        return { portfolioId: portfolio.id, previous };
      }),
    );
    const yearAgoByPortfolio = new Map(
      yearAgoValues.filter((v): v is NonNullable<typeof v> => v !== null).map((v) => [v.portfolioId, v.previous]),
    );

    return portfolios
      .map((portfolio) => {
        const latest = latestByPortfolio.get(portfolio.id);
        if (!latest) return null;
        const yearAgo = yearAgoByPortfolio.get(portfolio.id) ?? null;
        return {
          clientId: portfolio.clientId,
          portfolioId: portfolio.id,
          currency: portfolio.baseCurrency,
          asOf: toISODate(latest.date),
          totalValue: money(latest.totalValue),
          pnlAbs: money(latest.pnlAbs),
          pnlPct: pct(latest.pnlPct),
          yearChangePct: yearAgo === null ? 0 : changePct(yearAgo, latest.totalValue),
        } satisfies ClientValue;
      })
      .filter((value): value is ClientValue => value !== null);
  }

  async getAggregatedAllocation(clientIds: string[]): Promise<AllocationSlice[]> {
    if (clientIds.length === 0) return [];

    const portfolios = await prisma.portfolio.findMany({
      where: { clientId: { in: clientIds } },
      select: { id: true },
    });
    if (portfolios.length === 0) return [];

    const portfolioIds = portfolios.map((p) => p.id);

    const latestDates = await prisma.portfolioSnapshot.groupBy({
      by: ['portfolioId'],
      where: { portfolioId: { in: portfolioIds } },
      _max: { date: true },
    });
    const distinctDates = [
      ...new Set(latestDates.map((row) => row._max.date?.getTime()).filter((t): t is number => !!t)),
    ].map((time) => new Date(time));

    const latestSnapshots = await prisma.portfolioSnapshot.findMany({
      where: { portfolioId: { in: portfolioIds }, date: { in: distinctDates } },
      select: { id: true, portfolioId: true, date: true },
    });

    const snapshotIds = latestDates
      .map((row) => {
        if (!row._max.date) return null;
        return (
          latestSnapshots.find(
            (s) => s.portfolioId === row.portfolioId && s.date.getTime() === row._max.date!.getTime(),
          )?.id ?? null
        );
      })
      .filter((id): id is string => id !== null);

    const grouped = await prisma.snapshotAllocation.groupBy({
      by: ['assetClassId'],
      where: { snapshotId: { in: snapshotIds } },
      _sum: { value: true },
    });

    const assetClasses = await prisma.assetClass.findMany({ orderBy: { orderIndex: 'asc' } });
    const total = grouped.reduce((acc, row) => acc + (row._sum.value ?? 0), 0);

    const slices = assetClasses
      .map((assetClass) => {
        const value = grouped.find((row) => row.assetClassId === assetClass.id)?._sum.value ?? 0;
        return {
          ...toAssetClassRef(assetClass),
          value: money(value),
          weightPct: total > 0 ? pct((value / total) * 100) : 0,
        };
      })
      .filter((slice) => slice.value > 0);

    const weights = normalizeWeights(slices.map((slice) => slice.weightPct));
    return slices.map((slice, index) => ({ ...slice, weightPct: weights[index] }));
  }

  // -------------------------------------------------------------------------
  // Helper interni
  // -------------------------------------------------------------------------

  private async requirePortfolio(clientId: string) {
    const portfolio = await prisma.portfolio.findFirst({
      where: { clientId },
      orderBy: { openedAt: 'asc' },
    });
    if (!portfolio) throw notFound('Nessun portafoglio associato a questo cliente.');
    return portfolio;
  }

  private async historyBounds(portfolioId: string) {
    const result = await prisma.portfolioSnapshot.aggregate({
      where: { portfolioId },
      _min: { date: true },
      _max: { date: true },
    });
    if (!result._min.date || !result._max.date) return null;
    return { first: result._min.date, last: result._max.date };
  }

  /** Valore del patrimonio alla data indicata o, se assente, al giorno utile precedente. */
  private async valueAtOrBefore(portfolioId: string, date: Date): Promise<number | null> {
    const snapshot = await prisma.portfolioSnapshot.findFirst({
      where: { portfolioId, date: { lte: date } },
      orderBy: { date: 'desc' },
      select: { totalValue: true },
    });
    return snapshot ? snapshot.totalValue : null;
  }
}

// ---------------------------------------------------------------------------
// Funzioni pure condivise
// ---------------------------------------------------------------------------

function toAssetClassRef(assetClass: {
  key: string;
  label: string;
  colorHex: string;
  orderIndex: number;
}): AssetClassRef {
  return {
    key: assetClass.key,
    label: assetClass.label,
    colorHex: assetClass.colorHex,
    orderIndex: assetClass.orderIndex,
  };
}

function toAllocation(
  allocations: Array<{
    value: number;
    weightPct: number;
    assetClass: { key: string; label: string; colorHex: string; orderIndex: number };
  }>,
): AllocationSlice[] {
  const sorted = [...allocations].sort((a, b) => a.assetClass.orderIndex - b.assetClass.orderIndex);
  const weights = normalizeWeights(sorted.map((a) => a.weightPct));
  return sorted.map((allocation, index) => ({
    ...toAssetClassRef(allocation.assetClass),
    value: money(allocation.value),
    weightPct: weights[index],
  }));
}

function buildChange(previous: number | null, current: number): PerformanceChange {
  if (previous === null) return { absolute: 0, percent: 0 };
  return { absolute: money(current - previous), percent: changePct(previous, current) };
}

function buildHistory(
  points: Array<{ date: string; totalValue: number }>,
  range: { range: PortfolioHistory['range']; from: Date; to: Date },
  currency: string,
  maxPoints: number,
): PortfolioHistory {
  const sourcePoints = points.length;
  const sampled = downsample(points, maxPoints);
  const values = points.map((p) => p.totalValue);
  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;

  return {
    range: range.range,
    from: toISODate(range.from),
    to: toISODate(range.to),
    currency,
    points: sampled,
    change: { absolute: money(last - first), percent: changePct(first, last) },
    min: values.length ? money(Math.min(...values)) : 0,
    max: values.length ? money(Math.max(...values)) : 0,
    sourcePoints,
  };
}

function emptyHistory(currency: string, query: HistoryQuery): PortfolioHistory {
  const today = toISODate(new Date());
  return {
    range: query.range ?? '1Y',
    from: query.from ?? today,
    to: query.to ?? today,
    currency,
    points: [],
    change: { absolute: 0, percent: 0 },
    min: 0,
    max: 0,
    sourcePoints: 0,
  };
}

export const mockProviderInternals = { buildHistory, toAllocation, buildChange };
