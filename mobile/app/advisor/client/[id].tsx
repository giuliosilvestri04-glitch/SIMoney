import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useAdvisorClientDocuments,
  useAdvisorClientHistory,
  useAdvisorClientInvestments,
  useAdvisorClientOverview,
  useAdvisorClientProposals,
  useAdvisorClientSnapshot,
} from '@/api/queries';
import type { HistoryRange } from '@/api/types';
import { useDocumentViewer } from '@/lib/documents';
import { useTheme } from '@/lib/theme-context';
import { formatCurrency, formatDate, toISODate } from '@/lib/format';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, Section } from '@/components/ui/Card';
import { Delta } from '@/components/ui/Delta';
import { DataRow, ListRow } from '@/components/ui/Rows';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState, ErrorState, ListSkeleton, PortfolioSkeleton } from '@/components/ui/States';
import { AllocationCard } from '@/components/domain/AllocationCard';
import { HistoricalSnapshot } from '@/components/domain/HistoricalSnapshot';
import { PortfolioChart } from '@/components/domain/PortfolioChart';
import {
  DocumentListItem,
  HoldingListItem,
  ProposalListItem,
} from '@/components/domain/ListItems';

type Tab = 'portfolio' | 'investments' | 'proposals' | 'documents';

/**
 * DETTAGLIO CLIENTE (area consulente).
 *
 * Le sezioni sono divise a schede e i dati di ciascuna vengono richiesti SOLO
 * quando la scheda viene aperta: aprire un cliente costa una richiesta, non sei.
 * È la differenza fra un'app che sembra istantanea e una che "carica".
 */
export default function AdvisorClientDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const clientId = String(id ?? '');

  const [tab, setTab] = useState<Tab>('portfolio');
  const [range, setRange] = useState<HistoryRange>('1Y');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const overview = useAdvisorClientOverview(clientId);
  const history = useAdvisorClientHistory(tab === 'portfolio' ? clientId : '', { range, maxPoints: 120 });
  const bounds = useAdvisorClientHistory(tab === 'portfolio' ? clientId : '', { range: 'MAX', maxPoints: 2 });
  const investments = useAdvisorClientInvestments(tab === 'investments' ? clientId : '');
  const proposals = useAdvisorClientProposals(tab === 'proposals' ? clientId : '');
  const documents = useAdvisorClientDocuments(tab === 'documents' ? clientId : '');
  const viewer = useDocumentViewer();

  const defaultDate = useMemo(() => {
    if (!overview.data) return null;
    const asOf = new Date(overview.data.summary.asOf);
    asOf.setMonth(asOf.getMonth() - 3);
    return toISODate(asOf);
  }, [overview.data]);

  const activeDate = selectedDate ?? defaultDate;
  const snapshot = useAdvisorClientSnapshot(tab === 'portfolio' ? clientId : '', activeDate);

  const data = overview.data;

  const header = (
    <ScreenHeader
      title={data?.profile.fullName ?? 'Cliente'}
      subtitle={data ? `${data.profile.clientCode} · ${data.profile.city}` : undefined}
      back
      action={{
        icon: 'plus',
        label: 'Nuova proposta per questo cliente',
        onPress: () => router.push(`/advisor/new-proposal?clientId=${clientId}`),
      }}
      below={
        <SegmentedControl
          options={[
            { value: 'portfolio', label: 'Patrimonio' },
            { value: 'investments', label: 'Investimenti' },
            { value: 'proposals', label: 'Proposte' },
            { value: 'documents', label: 'Documenti' },
          ]}
          value={tab}
          onChange={setTab}
          scrollable
          compact
        />
      }
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

  const summary = data.summary;

  return (
    <Screen
      header={header}
      tabBarPadding={false}
      refreshing={overview.isRefetching}
      onRefresh={() => void overview.refetch()}
    >
      {/* Intestazione cliente: sempre visibile, qualunque scheda sia aperta */}
      <Card>
        <View style={{ gap: theme.spacing.base }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <Avatar name={data.profile.fullName} color={data.profile.avatarColor} size={52} />
            <View style={{ flex: 1, gap: 4 }}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {data.profile.fullName}
              </AppText>
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
                <Badge label={data.profile.riskProfile} tone="brand" />
                <AppText variant="micro" tone="faint">
                  cliente dal {formatDate(data.profile.onboardedAt)}
                </AppText>
              </View>
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
            <AppText variant="display">{formatCurrency(summary.totalValue, summary.currency, 2)}</AppText>
            <View style={{ flexDirection: 'row', gap: theme.spacing.base, flexWrap: 'wrap' }}>
              <Delta percent={summary.changes.month.percent} variant="label" caption="mese" />
              <Delta percent={summary.changes.year.percent} variant="label" caption="anno" />
            </View>
          </View>
        </View>
      </Card>

      {/* --- Scheda: patrimonio --- */}
      {tab === 'portfolio' && (
        <>
          <PortfolioChart
            history={history.data}
            range={range}
            onRangeChange={setRange}
            loading={history.isLoading}
            error={history.isError ? history.error : undefined}
            onRetry={() => void history.refetch()}
            title="Evoluzione del patrimonio"
          />

          <AllocationCard allocation={summary.allocation} currency={summary.currency} />

          <HistoricalSnapshot
            date={activeDate}
            onDateChange={setSelectedDate}
            snapshot={snapshot.data}
            loading={snapshot.isLoading}
            error={snapshot.isError ? snapshot.error : undefined}
            onRetry={() => void snapshot.refetch()}
            minDate={bounds.data?.from}
            maxDate={summary.asOf}
          />

          <Section title="Contatti e rapporto">
            <Card>
              <View style={{ gap: theme.spacing.xs }}>
                <DataRow label="Email" value={data.profile.email} />
                {data.profile.phone && <DataRow label="Telefono" value={data.profile.phone} />}
                <DataRow label="IBAN" value={data.profile.ibanMasked} />
                <DataRow label="Posizioni aperte" value={String(summary.holdingsCount)} />
                <DataRow label="Documenti" value={String(data.documentsCount)} />
              </View>
            </Card>
          </Section>
        </>
      )}

      {/* --- Scheda: investimenti --- */}
      {tab === 'investments' && (
        <>
          {investments.isError ? (
            <ErrorState error={investments.error} onRetry={() => void investments.refetch()} />
          ) : investments.isLoading ? (
            <ListSkeleton rows={5} />
          ) : (investments.data ?? []).length === 0 ? (
            <EmptyState icon="bar-chart-2" title="Nessun investimento" />
          ) : (
            <Card>
              <View style={{ gap: theme.spacing.sm }}>
                {(investments.data ?? []).map((holding, index) => (
                  <View key={holding.id} style={{ gap: theme.spacing.sm }}>
                    {index > 0 && <View style={{ height: 1, backgroundColor: theme.colors.border }} />}
                    <HoldingListItem holding={holding} />
                  </View>
                ))}
              </View>
            </Card>
          )}
        </>
      )}

      {/* --- Scheda: proposte --- */}
      {tab === 'proposals' && (
        <>
          <Button
            label="Nuova proposta per questo cliente"
            onPress={() => router.push(`/advisor/new-proposal?clientId=${clientId}`)}
            icon="plus"
          />

          {proposals.isError ? (
            <ErrorState error={proposals.error} onRetry={() => void proposals.refetch()} />
          ) : proposals.isLoading ? (
            <ListSkeleton rows={3} />
          ) : (proposals.data?.data ?? []).length === 0 ? (
            <EmptyState
              icon="send"
              title="Nessuna proposta"
              message="Non hai ancora inviato proposte a questo cliente."
            />
          ) : (
            <View style={{ gap: theme.spacing.md }}>
              {(proposals.data?.data ?? []).map((proposal) => (
                <ProposalListItem
                  key={proposal.id}
                  proposal={proposal}
                  onPress={() => router.push(`/advisor/proposal/${proposal.id}`)}
                />
              ))}
            </View>
          )}
        </>
      )}

      {/* --- Scheda: documenti --- */}
      {tab === 'documents' && (
        <>
          {documents.isError ? (
            <ErrorState error={documents.error} onRetry={() => void documents.refetch()} />
          ) : documents.isLoading ? (
            <ListSkeleton rows={4} />
          ) : (documents.data ?? []).length === 0 ? (
            <EmptyState icon="folder" title="Nessun documento" />
          ) : (
            <Card>
              <View style={{ gap: theme.spacing.sm }}>
                {(documents.data ?? []).map((document, index) => (
                  <View key={document.id} style={{ gap: theme.spacing.sm }}>
                    {index > 0 && <View style={{ height: 1, backgroundColor: theme.colors.border }} />}
                    <DocumentListItem
                      document={document}
                      busy={viewer.isBusy(document.id)}
                      onOpen={() => void viewer.open(document)}
                    />
                  </View>
                ))}
              </View>
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}
