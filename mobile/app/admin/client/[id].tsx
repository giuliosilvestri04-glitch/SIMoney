import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useCompanyClientOverview } from '@/api/queries';
import { useTheme } from '@/lib/theme-context';
import { formatCurrency, formatDate } from '@/lib/format';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card, Section } from '@/components/ui/Card';
import { Delta } from '@/components/ui/Delta';
import { DataRow } from '@/components/ui/Rows';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { ErrorState, PortfolioSkeleton } from '@/components/ui/States';
import { LineChart } from '@/components/charts/LineChart';
import { AllocationCard } from '@/components/domain/AllocationCard';

/**
 * Scheda cliente per la direzione: sola lettura, senza operatività.
 * Il perimetro di ciò che è visibile resta deciso dal backend.
 */
export default function AdminClientScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const overview = useCompanyClientOverview(String(id ?? ''));

  const data = overview.data;
  const header = (
    <ScreenHeader
      title={data?.profile.fullName ?? 'Cliente'}
      subtitle={data ? `${data.profile.clientCode} · ${data.profile.advisor.name}` : undefined}
      back
    />
  );

  if (overview.isError) {
    return (
      <Screen header={header} tabBarPadding={false}>
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
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

  return (
    <Screen
      header={header}
      tabBarPadding={false}
      refreshing={overview.isRefetching}
      onRefresh={() => void overview.refetch()}
    >
      <Card>
        <View style={{ gap: theme.spacing.base }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <Avatar name={data.profile.fullName} color={data.profile.avatarColor} size={52} />
            <View style={{ flex: 1, gap: 4 }}>
              <AppText variant="bodyStrong">{data.profile.fullName}</AppText>
              <Badge label={data.profile.riskProfile} tone="brand" />
            </View>
          </View>

          <View
            style={{
              gap: 6,
              paddingTop: theme.spacing.md,
              borderTopWidth: 1,
              borderTopColor: theme.colors.border,
            }}
          >
            <AppText variant="micro" tone="faint" uppercase>
              Patrimonio
            </AppText>
            <AppText variant="display">
              {formatCurrency(data.summary.totalValue, data.summary.currency, 2)}
            </AppText>
            <Delta
              percent={data.summary.changes.year.percent}
              absolute={data.summary.changes.year.absolute}
              variant="label"
              caption="ultimi 12 mesi"
            />
          </View>
        </View>
      </Card>

      <Card>
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="micro" tone="faint" uppercase>
            Andamento · 12 mesi
          </AppText>
          <LineChart points={data.chart.points} currency={data.chart.currency} height={150} />
        </View>
      </Card>

      <AllocationCard allocation={data.summary.allocation} currency={data.summary.currency} />

      <Section title="Rapporto">
        <Card>
          <View style={{ gap: theme.spacing.xs }}>
            <DataRow label="Consulente" value={data.profile.advisor.name} />
            <DataRow label="Città" value={data.profile.city} />
            <DataRow label="Cliente dal" value={formatDate(data.profile.onboardedAt)} />
            <DataRow label="Posizioni" value={String(data.summary.holdingsCount)} />
            <DataRow label="Documenti" value={String(data.documentsCount)} />
            {data.proposals.map((row) => (
              <DataRow key={row.status} label={`Proposte ${row.label.toLowerCase()}`} value={String(row.count)} />
            ))}
          </View>
        </Card>
      </Section>
    </Screen>
  );
}
