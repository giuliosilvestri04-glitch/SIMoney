import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  useAdvisorsBreakdown,
  useCompanyAumHistory,
  useProposalsAnalytics,
} from '@/api/queries';
import type { HistoryRange } from '@/api/types';
import { useTheme } from '@/lib/theme-context';
import {
  formatCurrency,
  formatCurrencyShort,
  formatMonthYear,
  formatNumber,
  formatPercent,
} from '@/lib/format';
import { AppText } from '@/components/ui/AppText';
import { StatusBadge } from '@/components/ui/Badge';
import { Card, Section } from '@/components/ui/Card';
import { KpiGrid, KpiTile, ProgressBar } from '@/components/ui/Rows';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { ErrorState, ListSkeleton } from '@/components/ui/States';
import { BarChart, HorizontalBars } from '@/components/charts/BarChart';
import { PortfolioChart } from '@/components/domain/PortfolioChart';

/**
 * ANALISI AZIENDALI.
 *
 * Ogni grafico è progettato per la larghezza di uno schermo: serie temporale a
 * tutta larghezza, confronti come barre orizzontali (le etichette restano
 * leggibili), andamento mensile come istogramma con dettaglio al tocco.
 */
export default function AdminAnalyticsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [range, setRange] = useState<HistoryRange>('1Y');

  const history = useCompanyAumHistory({ range, maxPoints: 120 });
  const proposals = useProposalsAnalytics();
  const advisors = useAdvisorsBreakdown();

  const refreshing = history.isRefetching || proposals.isRefetching || advisors.isRefetching;
  const refresh = () => {
    void history.refetch();
    void proposals.refetch();
    void advisors.refetch();
  };

  return (
    <Screen
      header={<ScreenHeader title="Analisi" subtitle="Andamento, rete e proposte" />}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {/* Patrimonio aziendale nel tempo */}
      <PortfolioChart
        history={history.data}
        range={range}
        onRangeChange={setRange}
        loading={history.isLoading}
        error={history.isError ? history.error : undefined}
        onRetry={() => void history.refetch()}
        title="Patrimonio aziendale"
        showHeaderValue
      />

      {/* Proposte: indicatori sintetici */}
      {proposals.isError ? (
        <ErrorState error={proposals.error} onRetry={() => void proposals.refetch()} />
      ) : proposals.isLoading ? (
        <ListSkeleton rows={3} />
      ) : proposals.data ? (
        <>
          <KpiGrid>
            <KpiTile
              label="Proposte totali"
              value={formatNumber(proposals.data.totals.proposals)}
              icon="send"
            />
            <KpiTile
              label="Tasso accettazione"
              value={formatPercent(proposals.data.totals.acceptanceRatePct, 0, false)}
              icon="check-circle"
            />
            <KpiTile
              label="Importo medio"
              value={formatCurrencyShort(proposals.data.totals.averageAmount, proposals.data.totals.currency)}
              icon="dollar-sign"
            />
            <KpiTile
              label="Tempo di risposta"
              value={`${formatNumber(Math.round(proposals.data.totals.averageResponseHours / 24))} gg`}
              icon="clock"
              hint={
                <AppText variant="micro" tone="faint">
                  media dei clienti
                </AppText>
              }
            />
          </KpiGrid>

          {/* Imbuto per stato */}
          <Section title="Proposte per stato">
            <Card>
              <View style={{ gap: theme.spacing.base }}>
                {proposals.data.byStatus.map((row) => (
                  <View key={row.status} style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                      <StatusBadge status={row.status} label={row.label} />
                      <View style={{ flex: 1 }} />
                      <AppText variant="caption" tone="muted">
                        {formatPercent(row.sharePct, 0, false)}
                      </AppText>
                      <AppText variant="amountSmall" style={{ minWidth: 30, textAlign: 'right' }}>
                        {row.count}
                      </AppText>
                    </View>
                    <ProgressBar
                      value={row.sharePct}
                      color={
                        row.status === 'ACCEPTED'
                          ? theme.colors.positive
                          : row.status === 'REJECTED'
                            ? theme.colors.negative
                            : row.status === 'PENDING'
                              ? theme.colors.warning
                              : theme.colors.borderStrong
                      }
                    />
                  </View>
                ))}
              </View>
            </Card>
          </Section>

          {/* Andamento mensile */}
          {proposals.data.monthly.length > 0 && (
            <Section title="Proposte create e accettate">
              <Card>
                <BarChart
                  height={140}
                  data={proposals.data.monthly.slice(-8).map((month) => ({
                    key: month.month,
                    label: formatMonthYear(`${month.month}-01`).split(' ')[0],
                    value: month.created,
                    secondary: month.accepted,
                    color: theme.colors.accentSoft,
                    secondaryColor: theme.colors.positive,
                    detail: `${month.created} create · ${month.accepted} accettate · ${formatCurrencyShort(month.amount)}`,
                  }))}
                />
                <View
                  style={{
                    flexDirection: 'row',
                    gap: theme.spacing.base,
                    marginTop: theme.spacing.md,
                    justifyContent: 'center',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View
                      style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: theme.colors.accentSoft }}
                    />
                    <AppText variant="micro" tone="faint">
                      Create
                    </AppText>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View
                      style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: theme.colors.positive }}
                    />
                    <AppText variant="micro" tone="faint">
                      Accettate
                    </AppText>
                  </View>
                </View>
              </Card>
            </Section>
          )}
        </>
      ) : null}

      {/* Patrimonio per consulente */}
      {advisors.data && advisors.data.length > 0 && (
        <Section title="Patrimonio per consulente" action={{ label: 'Rete', onPress: () => router.push('/admin/network') }}>
          <Card>
            <HorizontalBars
              data={advisors.data.map((advisor) => ({
                key: advisor.advisorId,
                label: advisor.name,
                value: advisor.assetsUnderManagement,
                display: formatCurrencyShort(advisor.assetsUnderManagement),
                color: theme.colors.accent,
              }))}
            />
          </Card>
        </Section>
      )}

      {/* Clienti per consulente */}
      {advisors.data && advisors.data.length > 0 && (
        <Section title="Clienti per consulente">
          <Card>
            <BarChart
              height={130}
              data={advisors.data.map((advisor) => ({
                key: advisor.advisorId,
                label: advisor.name.split(' ')[1] ?? advisor.name,
                value: advisor.clients,
                color: theme.colors.brand,
                detail: `${advisor.clients} clienti · ${formatCurrency(advisor.averagePortfolio, 'EUR', 0)} di media`,
              }))}
            />
          </Card>
        </Section>
      )}
    </Screen>
  );
}
