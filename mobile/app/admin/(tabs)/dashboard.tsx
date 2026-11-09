import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useCompanyOverview } from '@/api/queries';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme-context';
import { formatCurrency, formatCurrencyShort, formatNumber, formatPercent } from '@/lib/format';
import { AppText } from '@/components/ui/AppText';
import { StatusBadge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/Button';
import { Card, Section } from '@/components/ui/Card';
import { Delta } from '@/components/ui/Delta';
import { KpiGrid, KpiTile } from '@/components/ui/Rows';
import { BrandHeader, Screen } from '@/components/ui/Screen';
import { ErrorState, PortfolioSkeleton } from '@/components/ui/States';
import { LineChart } from '@/components/charts/LineChart';
import { AllocationCard } from '@/components/domain/AllocationCard';

/**
 * DASHBOARD DIREZIONALE.
 *
 * Non è una dashboard desktop rimpicciolita: pochi indicatori grandi, un
 * grafico per volta, e il dettaglio spostato nella scheda "Analisi".
 */
export default function AdminDashboardScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const overview = useCompanyOverview();

  const data = overview.data;

  const header = (
    <BrandHeader>
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ gap: 2 }}>
            <AppText variant="caption" style={{ color: 'rgba(255,255,255,0.65)' }}>
              Direzione
            </AppText>
            <AppText variant="headline" style={{ color: theme.colors.onBrand }}>
              {user?.fullName ?? ''}
            </AppText>
          </View>
          <IconButton
            icon="user"
            label="Profilo"
            tone="onBrand"
            onPress={() => router.push('/admin/profile')}
          />
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="micro" style={{ color: 'rgba(255,255,255,0.6)' }} uppercase>
            Patrimonio complessivo
          </AppText>
          {data ? (
            <>
              <AppText variant="hero" style={{ color: theme.colors.onBrand }}>
                {formatCurrency(data.kpi.assetsUnderManagement, data.kpi.currency, 0)}
              </AppText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                <Delta percent={data.kpi.yearChangePct} variant="bodyStrong" filled onBrand />
                <AppText variant="caption" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  ultimi 12 mesi
                </AppText>
              </View>
            </>
          ) : (
            <AppText variant="hero" style={{ color: 'rgba(255,255,255,0.25)' }}>
              €ˍˍ.ˍˍˍ.ˍˍˍ
            </AppText>
          )}
        </View>
      </View>
    </BrandHeader>
  );

  if (overview.isError) {
    return (
      <Screen header={header}>
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen header={header}>
        <PortfolioSkeleton />
      </Screen>
    );
  }

  return (
    <Screen header={header} refreshing={overview.isRefetching} onRefresh={() => void overview.refetch()}>
      <KpiGrid>
        <KpiTile
          label="Clienti"
          value={formatNumber(data.kpi.clients)}
          icon="users"
          onPress={() => router.push('/admin/network')}
          hint={
            <AppText variant="micro" tone="faint">
              {data.kpi.clientsPerAdvisor} per consulente
            </AppText>
          }
        />
        <KpiTile
          label="Consulenti"
          value={formatNumber(data.kpi.advisors)}
          icon="briefcase"
          onPress={() => router.push('/admin/network')}
        />
        <KpiTile
          label="Patrimonio medio"
          value={formatCurrencyShort(data.kpi.averagePortfolio, data.kpi.currency)}
          icon="pie-chart"
        />
        <KpiTile
          label="Variazione mese"
          value={formatPercent(data.kpi.monthChangePct)}
          icon="trending-up"
        />
      </KpiGrid>

      {/* Andamento del patrimonio aziendale */}
      <Card onPress={() => router.push('/admin/analytics')}>
        <View style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <AppText variant="micro" tone="faint" uppercase>
              Patrimonio aziendale · 12 mesi
            </AppText>
            <Delta percent={data.aumChart.change.percent} variant="label" />
          </View>
          <LineChart points={data.aumChart.points} currency={data.kpi.currency} height={160} />
        </View>
      </Card>

      {/* Proposte */}
      <Section
        title="Proposte"
        action={{ label: 'Analisi', onPress: () => router.push('/admin/analytics') }}
      >
        <Card>
          <View style={{ gap: theme.spacing.base }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <View style={{ gap: 3 }}>
                <AppText variant="micro" tone="faint" uppercase>
                  Tasso di accettazione
                </AppText>
                <AppText variant="display">{formatPercent(data.kpi.acceptanceRatePct, 0, false)}</AppText>
              </View>
              <View style={{ gap: 3, alignItems: 'flex-end' }}>
                <AppText variant="micro" tone="faint" uppercase>
                  In attesa
                </AppText>
                <AppText variant="title">{data.kpi.pendingProposals}</AppText>
              </View>
            </View>

            <View style={{ gap: theme.spacing.md }}>
              {data.proposalsByStatus.map((row) => (
                <View
                  key={row.status}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}
                >
                  <StatusBadge status={row.status} label={row.label} />
                  <View style={{ flex: 1 }} />
                  <AppText variant="caption" tone="muted">
                    {formatCurrencyShort(row.amount, data.kpi.currency)}
                  </AppText>
                  <AppText variant="amountSmall" style={{ minWidth: 28, textAlign: 'right' }}>
                    {row.count}
                  </AppText>
                </View>
              ))}
            </View>
          </View>
        </Card>
      </Section>

      {/* Allocazione aziendale */}
      <AllocationCard
        allocation={data.allocation}
        currency={data.kpi.currency}
        title="Asset allocation aziendale"
        subtitle="Composizione aggregata di tutti i portafogli"
        totalLabel="Totale"
      />
    </Screen>
  );
}
