import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useClientHome } from '@/api/queries';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme-context';
import { formatCurrency, formatCurrencyCompact } from '@/lib/format';
import { AppText } from '@/components/ui/AppText';
import { Card, Section } from '@/components/ui/Card';
import { Delta } from '@/components/ui/Delta';
import { IconButton } from '@/components/ui/Button';
import { BrandHeader, Screen } from '@/components/ui/Screen';
import { ColorDot, KpiGrid, KpiTile } from '@/components/ui/Rows';
import { ErrorState, PortfolioSkeleton } from '@/components/ui/States';
import { LineChart } from '@/components/charts/LineChart';
import { ProposalListItem, TransactionListItem } from '@/components/domain/ListItems';

/**
 * HOME DEL CLIENTE.
 *
 * Obiettivo: in un colpo d'occhio, senza scorrere, si vede quanto si ha e come
 * sta andando. Tutto il resto è a un tocco di distanza.
 *
 * L'intera schermata arriva da UNA sola richiesta (`/client/home`): è la
 * differenza che si percepisce rispetto alla piattaforma web attuale.
 */
export default function ClientHomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const home = useClientHome();

  const data = home.data;
  const summary = data?.summary;

  const header = (
    <BrandHeader>
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ gap: 2 }}>
            <AppText variant="caption" style={{ color: 'rgba(255,255,255,0.65)' }}>
              Bentornato
            </AppText>
            <AppText variant="headline" style={{ color: theme.colors.onBrand }}>
              {user?.firstName ?? ''}
            </AppText>
          </View>
          <IconButton
            icon="user"
            label="Profilo"
            tone="onBrand"
            onPress={() => router.push('/client/profile')}
          />
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="micro" style={{ color: 'rgba(255,255,255,0.6)' }} uppercase>
            Patrimonio totale
          </AppText>
          {summary ? (
            <>
              <AppText variant="hero" style={{ color: theme.colors.onBrand }}>
                {formatCurrency(summary.totalValue, summary.currency, 2)}
              </AppText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                <Delta
                  percent={summary.changes.year.percent}
                  absolute={summary.changes.year.absolute}
                  variant="bodyStrong"
                  filled
                  onBrand
                />
                <AppText variant="caption" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  ultimi 12 mesi
                </AppText>
              </View>
            </>
          ) : (
            <AppText variant="hero" style={{ color: 'rgba(255,255,255,0.25)' }}>
              €ˍˍˍ.ˍˍˍ
            </AppText>
          )}
        </View>
      </View>
    </BrandHeader>
  );

  if (home.isError) {
    return (
      <Screen header={header}>
        <ErrorState error={home.error} onRetry={() => void home.refetch()} />
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

  const topAllocation = [...data.summary.allocation].sort((a, b) => b.weightPct - a.weightPct).slice(0, 4);

  return (
    <Screen header={header} refreshing={home.isRefetching} onRefresh={() => void home.refetch()}>
      {/* Composizione essenziale del patrimonio */}
      <KpiGrid>
        <KpiTile
          label="Investito"
          value={formatCurrencyCompact(data.summary.investedValue, data.summary.currency)}
          icon="trending-up"
          hint={
            <AppText variant="micro" tone="faint">
              {data.summary.holdingsCount} posizioni
            </AppText>
          }
        />
        <KpiTile
          label="Liquidità"
          value={formatCurrencyCompact(data.summary.cashValue, data.summary.currency)}
          icon="credit-card"
          hint={
            <AppText variant="micro" tone="faint">
              disponibile
            </AppText>
          }
        />
      </KpiGrid>

      {/* Proposte che richiedono una risposta: la cosa più importante della home */}
      {data.pendingProposals.length > 0 && (
        <Section title={data.pendingProposals.length === 1 ? 'Nuova proposta' : 'Nuove proposte'}>
          {data.pendingProposals.map((proposal) => (
            <ProposalListItem
              key={proposal.id}
              proposal={proposal}
              counterpart={proposal.advisorName}
              unread
              onPress={() => router.push(`/client/proposal/${proposal.id}`)}
            />
          ))}
        </Section>
      )}

      {/* Andamento sintetico: il dettaglio è nella scheda Portafoglio */}
      <Card onPress={() => router.push('/client/portfolio')}>
        <View style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <AppText variant="micro" tone="faint" uppercase>
              Andamento · 6 mesi
            </AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Delta percent={data.chart.change.percent} variant="label" />
              <Feather name="chevron-right" size={16} color={theme.colors.textFaint} />
            </View>
          </View>
          <LineChart
            points={data.chart.points}
            currency={data.chart.currency}
            height={120}
            interactive={false}
            showAxisLabels={false}
            showBaseline={false}
          />
        </View>
      </Card>

      {/* Asset allocation sintetica */}
      <Section title="Asset allocation" action={{ label: 'Dettaglio', onPress: () => router.push('/client/portfolio') }}>
        <Card>
          <View style={{ gap: theme.spacing.md }}>
            {topAllocation.map((slice) => (
              <View key={slice.key} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                <ColorDot color={slice.colorHex} />
                <AppText variant="caption" style={{ flex: 1 }} numberOfLines={1}>
                  {slice.label}
                </AppText>
                <AppText variant="label">{slice.weightPct.toLocaleString('it-IT', { maximumFractionDigits: 1 })}%</AppText>
              </View>
            ))}
          </View>
        </Card>
      </Section>

      {/* Movimenti recenti */}
      {data.recentActivity.length > 0 && (
        <Section
          title="Attività recente"
          action={{ label: 'Tutti i movimenti', onPress: () => router.push('/client/transactions') }}
        >
          <Card>
            <View style={{ gap: theme.spacing.sm }}>
              {data.recentActivity.map((activity) => (
                <TransactionListItem
                  key={activity.id}
                  transaction={{ ...activity, currency: data.summary.currency }}
                />
              ))}
            </View>
          </Card>
        </Section>
      )}
    </Screen>
  );
}
