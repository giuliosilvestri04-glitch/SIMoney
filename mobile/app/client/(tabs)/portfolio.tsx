import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useClientHistory, useClientSnapshot, useClientSummary } from '@/api/queries';
import type { HistoryRange } from '@/api/types';
import { useTheme } from '@/lib/theme-context';
import { formatCurrency, formatDate, toISODate } from '@/lib/format';
import { AppText } from '@/components/ui/AppText';
import { Card, Section } from '@/components/ui/Card';
import { Delta } from '@/components/ui/Delta';
import { ListRow } from '@/components/ui/Rows';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { ErrorState, PortfolioSkeleton } from '@/components/ui/States';
import { AllocationCard } from '@/components/domain/AllocationCard';
import { HistoricalSnapshot } from '@/components/domain/HistoricalSnapshot';
import { PortfolioChart } from '@/components/domain/PortfolioChart';

/**
 * PORTAFOGLIO DEL CLIENTE.
 *
 * Tre livelli di lettura, dall'alto verso il basso:
 *   1. quanto vale oggi e come è andato nel periodo scelto;
 *   2. com'è composto (asset allocation);
 *   3. quanto valeva in una data specifica (calendario).
 */
export default function ClientPortfolioScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [range, setRange] = useState<HistoryRange>('1Y');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const summary = useClientSummary();
  const history = useClientHistory({ range, maxPoints: 120 });
  // Serie minima usata solo per conoscere il primo giorno disponibile:
  // due punti, richiesta leggerissima e a lunga cache.
  const bounds = useClientHistory({ range: 'MAX', maxPoints: 2 });

  const defaultDate = useMemo(() => {
    if (!summary.data) return null;
    const asOf = new Date(summary.data.asOf);
    asOf.setMonth(asOf.getMonth() - 3);
    return toISODate(asOf);
  }, [summary.data]);

  const activeDate = selectedDate ?? defaultDate;
  const snapshotQuery = useClientSnapshot(activeDate);

  const refreshing = summary.isRefetching || history.isRefetching;
  const refresh = () => {
    void summary.refetch();
    void history.refetch();
    void snapshotQuery.refetch();
  };

  const header = <ScreenHeader title="Portafoglio" subtitle={summary.data ? `Aggiornato al ${formatDate(summary.data.asOf)}` : undefined} />;

  if (summary.isError) {
    return (
      <Screen header={header}>
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
      </Screen>
    );
  }

  if (!summary.data) {
    return (
      <Screen header={header}>
        <PortfolioSkeleton />
      </Screen>
    );
  }

  const data = summary.data;

  return (
    <Screen header={header} refreshing={refreshing} onRefresh={refresh}>
      {/* Valore corrente e performance complessiva */}
      <Card>
        <View style={{ gap: theme.spacing.base }}>
          <View style={{ gap: 6 }}>
            <AppText variant="micro" tone="faint" uppercase>
              Valore attuale
            </AppText>
            <AppText variant="hero">{formatCurrency(data.totalValue, data.currency, 2)}</AppText>
            <Delta
              percent={data.pnlPct}
              absolute={data.pnlAbs}
              variant="bodyStrong"
              caption="dall'apertura"
              filled
            />
          </View>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingTop: theme.spacing.md,
              borderTopWidth: 1,
              borderTopColor: theme.colors.border,
            }}
          >
            {[
              { label: 'Oggi', change: data.changes.day },
              { label: 'Settimana', change: data.changes.week },
              { label: 'Mese', change: data.changes.month },
            ].map((item) => (
              <View key={item.label} style={{ gap: 4, alignItems: 'flex-start' }}>
                <AppText variant="micro" tone="faint" uppercase>
                  {item.label}
                </AppText>
                <Delta percent={item.change.percent} variant="label" />
              </View>
            ))}
          </View>
        </View>
      </Card>

      {/* Evoluzione del patrimonio */}
      <PortfolioChart
        history={history.data}
        range={range}
        onRangeChange={setRange}
        loading={history.isLoading}
        error={history.isError ? history.error : undefined}
        onRetry={() => void history.refetch()}
        title="Evoluzione del patrimonio"
      />

      {/* Composizione */}
      <AllocationCard
        allocation={data.allocation}
        currency={data.currency}
        subtitle={`${data.allocation.length} categorie · aggiornato al ${formatDate(data.asOf)}`}
      />

      {/* Approfondimenti */}
      <Section title="Dettagli">
        <Card>
          <View style={{ gap: theme.spacing.xs }}>
            <ListRow
              title="Investimenti"
              subtitle={`${data.holdingsCount} posizioni in portafoglio`}
              value={formatCurrency(data.investedValue, data.currency, 0)}
              onPress={() => router.push('/client/investments')}
            />
            <View style={{ height: 1, backgroundColor: theme.colors.border }} />
            <ListRow
              title="Movimenti"
              subtitle="Acquisti, vendite, cedole e versamenti"
              onPress={() => router.push('/client/transactions')}
            />
          </View>
        </Card>
      </Section>

      {/* Storico per data */}
      <HistoricalSnapshot
        date={activeDate}
        onDateChange={setSelectedDate}
        snapshot={snapshotQuery.data}
        loading={snapshotQuery.isLoading}
        error={snapshotQuery.isError ? snapshotQuery.error : undefined}
        onRetry={() => void snapshotQuery.refetch()}
        minDate={bounds.data?.from}
        maxDate={data.asOf}
      />
    </Screen>
  );
}
