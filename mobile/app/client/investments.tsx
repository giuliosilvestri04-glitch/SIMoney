import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useClientInvestments } from '@/api/queries';
import { useTheme } from '@/lib/theme-context';
import { formatCurrency } from '@/lib/format';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Delta } from '@/components/ui/Delta';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/States';
import { HoldingListItem } from '@/components/domain/ListItems';

type SortKey = 'value' | 'performance' | 'name';

/**
 * ELENCO INVESTIMENTI.
 *
 * Niente tabella: ogni posizione è una riga con nome, categoria, controvalore e
 * rendimento. Il dettaglio completo (quantità, prezzi, movimenti) è nella
 * schermata successiva, secondo una gerarchia progressiva.
 */
export default function ClientInvestmentsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [sort, setSort] = useState<SortKey>('value');

  const investments = useClientInvestments();

  const sorted = useMemo(() => {
    const items = [...(investments.data ?? [])];
    if (sort === 'value') items.sort((a, b) => b.marketValue - a.marketValue);
    if (sort === 'performance') items.sort((a, b) => b.pnlPct - a.pnlPct);
    if (sort === 'name') items.sort((a, b) => a.instrument.name.localeCompare(b.instrument.name, 'it'));
    return items;
  }, [investments.data, sort]);

  const totals = useMemo(() => {
    const items = investments.data ?? [];
    const marketValue = items.reduce((sum, item) => sum + item.marketValue, 0);
    const costBasis = items.reduce((sum, item) => sum + item.costBasis, 0);
    return {
      marketValue,
      pnlAbs: marketValue - costBasis,
      pnlPct: costBasis > 0 ? ((marketValue - costBasis) / costBasis) * 100 : 0,
      currency: items[0]?.instrument.currency ?? 'EUR',
    };
  }, [investments.data]);

  const header = (
    <ScreenHeader
      title="Investimenti"
      back
      subtitle={investments.data ? `${investments.data.length} posizioni` : undefined}
      below={
        <SegmentedControl
          options={[
            { value: 'value', label: 'Valore' },
            { value: 'performance', label: 'Rendimento' },
            { value: 'name', label: 'Nome' },
          ]}
          value={sort}
          onChange={setSort}
          compact
        />
      }
    />
  );

  return (
    <Screen
      header={header}
      tabBarPadding={false}
      refreshing={investments.isRefetching}
      onRefresh={() => void investments.refetch()}
    >
      {investments.isError ? (
        <ErrorState error={investments.error} onRetry={() => void investments.refetch()} />
      ) : investments.isLoading ? (
        <ListSkeleton rows={5} />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon="bar-chart-2"
          title="Nessun investimento"
          message="Il portafoglio non contiene posizioni aperte."
        />
      ) : (
        <>
          <Card>
            <View style={{ gap: theme.spacing.sm }}>
              <AppText variant="micro" tone="faint" uppercase>
                Totale investito
              </AppText>
              <AppText variant="display">{formatCurrency(totals.marketValue, totals.currency, 2)}</AppText>
              <Delta percent={totals.pnlPct} absolute={totals.pnlAbs} variant="bodyStrong" filled />
            </View>
          </Card>

          <Card>
            <View style={{ gap: theme.spacing.sm }}>
              {sorted.map((holding, index) => (
                <View key={holding.id} style={{ gap: theme.spacing.sm }}>
                  {index > 0 && <View style={{ height: 1, backgroundColor: theme.colors.border }} />}
                  <HoldingListItem
                    holding={holding}
                    onPress={() => router.push(`/client/investment/${holding.id}`)}
                  />
                </View>
              ))}
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}
