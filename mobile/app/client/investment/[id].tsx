import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useClientInvestment } from '@/api/queries';
import { useTheme } from '@/lib/theme-context';
import { formatCurrency, formatDate, formatPercent, formatQuantity } from '@/lib/format';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Card, Section } from '@/components/ui/Card';
import { Delta } from '@/components/ui/Delta';
import { ColorDot, DataRow, ProgressBar } from '@/components/ui/Rows';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { EmptyState, ErrorState, PortfolioSkeleton } from '@/components/ui/States';
import { TransactionListItem } from '@/components/domain/ListItems';

/**
 * DETTAGLIO DI UN INVESTIMENTO.
 *
 * Qui stanno i numeri "tecnici" (quantità, prezzo di carico, ISIN) che nella
 * lista sarebbero rumore. È il terzo livello della gerarchia:
 * patrimonio → investimenti → singola posizione.
 */
export default function InvestmentDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const investment = useClientInvestment(String(id ?? ''));

  const data = investment.data;

  const header = (
    <ScreenHeader
      title={data?.instrument.name ?? 'Investimento'}
      subtitle={data ? data.assetClass.label : undefined}
      back
    />
  );

  if (investment.isError) {
    return (
      <Screen header={header} tabBarPadding={false}>
        <ErrorState error={investment.error} onRetry={() => void investment.refetch()} />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen header={header} tabBarPadding={false}>
        <PortfolioSkeleton />
      </Screen>
    );
  }

  const currency = data.instrument.currency;

  return (
    <Screen
      header={header}
      tabBarPadding={false}
      refreshing={investment.isRefetching}
      onRefresh={() => void investment.refetch()}
    >
      {/* Controvalore e risultato */}
      <Card>
        <View style={{ gap: theme.spacing.base }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <ColorDot color={data.assetClass.colorHex} size={12} />
            <AppText variant="micro" tone="faint" uppercase>
              {data.assetClass.label}
            </AppText>
            <Badge label={data.instrument.type} tone="neutral" />
          </View>

          <View style={{ gap: 6 }}>
            <AppText variant="hero">{formatCurrency(data.marketValue, currency, 2)}</AppText>
            <Delta percent={data.pnlPct} absolute={data.pnlAbs} variant="bodyStrong" filled />
          </View>

          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText variant="micro" tone="faint" uppercase>
                Peso sul portafoglio
              </AppText>
              <AppText variant="label">{formatPercent(data.weightPct, 1, false)}</AppText>
            </View>
            <ProgressBar value={data.weightPct} color={data.assetClass.colorHex} />
          </View>
        </View>
      </Card>

      {/* Dati della posizione */}
      <Section title="Posizione">
        <Card>
          <View style={{ gap: theme.spacing.xs }}>
            <DataRow label="Quantità" value={formatQuantity(data.quantity)} />
            <DataRow label="Prezzo di carico" value={formatCurrency(data.avgPrice, currency, 2)} />
            <DataRow
              label="Prezzo attuale"
              value={formatCurrency(data.currentPrice, currency, 2)}
              tone={data.currentPrice >= data.avgPrice ? 'positive' : 'negative'}
            />
            <DataRow label="Capitale investito" value={formatCurrency(data.costBasis, currency, 2)} />
            <DataRow label="In portafoglio dal" value={formatDate(data.openedAt)} />
          </View>
        </Card>
      </Section>

      {/* Anagrafica strumento */}
      <Section title="Strumento">
        <Card>
          <View style={{ gap: theme.spacing.xs }}>
            <DataRow label="ISIN" value={data.instrument.isin} />
            <DataRow label="Emittente" value={data.instrument.issuer} />
            <DataRow label="Tipologia" value={data.instrument.type} />
            <DataRow label="Valuta" value={data.instrument.currency} />
          </View>
        </Card>
      </Section>

      {/* Movimenti collegati */}
      <Section title="Movimenti collegati">
        <Card>
          {data.movements.length === 0 ? (
            <EmptyState
              icon="activity"
              title="Nessun movimento"
              message="Non risultano operazioni registrate su questo strumento."
              compact
            />
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              {data.movements.map((movement, index) => (
                <View key={movement.id} style={{ gap: theme.spacing.sm }}>
                  {index > 0 && <View style={{ height: 1, backgroundColor: theme.colors.border }} />}
                  <TransactionListItem transaction={{ ...movement, currency }} />
                </View>
              ))}
            </View>
          )}
        </Card>
      </Section>
    </Screen>
  );
}
