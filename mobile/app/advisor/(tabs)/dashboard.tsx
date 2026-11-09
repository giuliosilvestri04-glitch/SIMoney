import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAdvisorDashboard } from '@/api/queries';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme-context';
import {
  formatCurrency,
  formatCurrencyShort,
  formatDate,
  formatExpiry,
  formatPercent,
} from '@/lib/format';
import { AppText } from '@/components/ui/AppText';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, Section } from '@/components/ui/Card';
import { Delta } from '@/components/ui/Delta';
import { KpiGrid, KpiTile, ListRow } from '@/components/ui/Rows';
import { BrandHeader, Screen } from '@/components/ui/Screen';
import { ErrorState, PortfolioSkeleton } from '@/components/ui/States';
import { LineChart } from '@/components/charts/LineChart';
import { HorizontalBars } from '@/components/charts/BarChart';

/**
 * DASHBOARD DEL CONSULENTE.
 *
 * Risponde a tre domande, nell'ordine in cui un consulente se le pone:
 * quanto gestisco, cosa devo fare oggi (proposte in attesa e in scadenza),
 * come stanno andando i miei clienti.
 */
export default function AdvisorDashboardScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const dashboard = useAdvisorDashboard();

  const data = dashboard.data;

  const header = (
    <BrandHeader>
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ gap: 2 }}>
            <AppText variant="caption" style={{ color: 'rgba(255,255,255,0.65)' }}>
              Area consulente
            </AppText>
            <AppText variant="headline" style={{ color: theme.colors.onBrand }}>
              {user?.fullName ?? ''}
            </AppText>
          </View>
          <IconButton
            icon="user"
            label="Profilo"
            tone="onBrand"
            onPress={() => router.push('/advisor/profile')}
          />
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="micro" style={{ color: 'rgba(255,255,255,0.6)' }} uppercase>
            Patrimonio gestito
          </AppText>
          {data ? (
            <>
              <AppText variant="hero" style={{ color: theme.colors.onBrand }}>
                {formatCurrency(data.kpi.assetsUnderManagement, data.kpi.currency, 0)}
              </AppText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                <Delta percent={data.aumChart.change.percent} variant="bodyStrong" filled onBrand />
                <AppText variant="caption" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {data.kpi.clients} clienti in gestione
                </AppText>
              </View>
            </>
          ) : (
            <AppText variant="hero" style={{ color: 'rgba(255,255,255,0.25)' }}>
              €ˍ.ˍˍˍ.ˍˍˍ
            </AppText>
          )}
        </View>
      </View>
    </BrandHeader>
  );

  if (dashboard.isError) {
    return (
      <Screen header={header}>
        <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />
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
    <Screen header={header} refreshing={dashboard.isRefetching} onRefresh={() => void dashboard.refetch()}>
      {/* Azione principale, a portata di pollice */}
      <Button
        label="Nuova proposta"
        onPress={() => router.push('/advisor/new-proposal')}
        icon="plus"
        size="lg"
      />

      <KpiGrid>
        <KpiTile
          label="Clienti"
          value={String(data.kpi.clients)}
          icon="users"
          onPress={() => router.push('/advisor/clients')}
          hint={
            <AppText variant="micro" tone="faint">
              media {formatCurrencyShort(data.kpi.averagePortfolio, data.kpi.currency)}
            </AppText>
          }
        />
        <KpiTile
          label="Proposte in attesa"
          value={String(data.kpi.pendingProposals)}
          icon="clock"
          onPress={() => router.push('/advisor/proposals')}
          hint={
            <AppText variant="micro" tone="faint">
              su {data.kpi.proposalsTotal} inviate
            </AppText>
          }
        />
        <KpiTile
          label="Tasso di accettazione"
          value={formatPercent(data.kpi.acceptanceRatePct, 0, false)}
          icon="check-circle"
        />
        <KpiTile
          label="Patrimonio medio"
          value={formatCurrencyShort(data.kpi.averagePortfolio, data.kpi.currency)}
          icon="pie-chart"
        />
      </KpiGrid>

      {/* Proposte in scadenza: la cosa che richiede un'azione oggi */}
      {data.expiringSoon.length > 0 && (
        <Section title="In scadenza">
          <Card>
            <View style={{ gap: theme.spacing.md }}>
              {data.expiringSoon.map((proposal, index) => (
                <View key={proposal.id} style={{ gap: theme.spacing.md }}>
                  {index > 0 && <View style={{ height: 1, backgroundColor: theme.colors.border }} />}
                  <ListRow
                    title={proposal.clientName}
                    subtitle={proposal.title}
                    leading={
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: theme.colors.warningSoft,
                        }}
                      >
                        <Feather name="clock" size={15} color={theme.colors.warning} />
                      </View>
                    }
                    valueHint={
                      <Badge
                        label={formatExpiry(proposal.daysToExpiry)}
                        tone={proposal.daysToExpiry <= 3 ? 'negative' : 'warning'}
                      />
                    }
                    onPress={() => router.push(`/advisor/proposal/${proposal.id}`)}
                  />
                </View>
              ))}
            </View>
          </Card>
        </Section>
      )}

      {/* Andamento del portafoglio gestito */}
      <Card>
        <View style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <AppText variant="micro" tone="faint" uppercase>
              Patrimonio gestito · 12 mesi
            </AppText>
            <Delta percent={data.aumChart.change.percent} variant="label" />
          </View>
          <LineChart points={data.aumChart.points} currency={data.kpi.currency} height={150} />
        </View>
      </Card>

      {/* Stato delle proposte */}
      <Section title="Proposte per stato" action={{ label: 'Vedi tutte', onPress: () => router.push('/advisor/proposals') }}>
        <Card>
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
        </Card>
      </Section>

      {/* Clienti principali */}
      {data.topClients.length > 0 && (
        <Section title="Clienti principali" action={{ label: 'Tutti', onPress: () => router.push('/advisor/clients') }}>
          <Card>
            <HorizontalBars
              data={data.topClients.map((client) => ({
                key: client.clientId,
                label: client.name,
                value: client.totalValue,
                display: formatCurrencyShort(client.totalValue, data.kpi.currency),
              }))}
              onPress={(clientId) => router.push(`/advisor/client/${clientId}`)}
            />
          </Card>
        </Section>
      )}

      {/* Ultime proposte inviate */}
      {data.recentProposals.length > 0 && (
        <Section title="Ultime proposte inviate">
          <Card>
            <View style={{ gap: theme.spacing.md }}>
              {data.recentProposals.map((proposal, index) => (
                <View key={proposal.id} style={{ gap: theme.spacing.md }}>
                  {index > 0 && <View style={{ height: 1, backgroundColor: theme.colors.border }} />}
                  <ListRow
                    title={proposal.title}
                    subtitle={`${proposal.clientName} · ${formatDate(proposal.createdAt)}`}
                    value={formatCurrencyShort(proposal.amount, data.kpi.currency)}
                    valueHint={<StatusBadge status={proposal.status} label={proposal.statusLabel} />}
                    onPress={() => router.push(`/advisor/proposal/${proposal.id}`)}
                  />
                </View>
              ))}
            </View>
          </Card>
        </Section>
      )}
    </Screen>
  );
}
