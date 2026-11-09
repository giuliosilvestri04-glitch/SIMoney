import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useCompanyProposals } from '@/api/queries';
import type { ProposalStatus } from '@/api/types';
import { useTheme } from '@/lib/theme-context';
import { Chip } from '@/components/ui/Badge';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/States';
import { ProposalListItem } from '@/components/domain/ListItems';

type Filter = 'ALL' | ProposalStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'Tutte' },
  { value: 'PENDING', label: 'In attesa' },
  { value: 'ACCEPTED', label: 'Accettate' },
  { value: 'REJECTED', label: 'Rifiutate' },
  { value: 'EXPIRED', label: 'Scadute' },
];

/** Tutte le proposte dell'azienda, in sola lettura. */
export default function AdminProposalsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('ALL');

  const proposals = useCompanyProposals(filter === 'ALL' ? undefined : filter);
  const items = proposals.data?.data ?? [];

  return (
    <Screen
      tabBarPadding={false}
      header={
        <ScreenHeader
          title="Proposte"
          back
          subtitle={proposals.data?.meta ? `${proposals.data.meta.total} proposte` : undefined}
          below={
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: theme.spacing.sm, paddingRight: theme.spacing.base }}
            >
              {FILTERS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={filter === option.value}
                  onPress={() => setFilter(option.value)}
                />
              ))}
            </ScrollView>
          }
        />
      }
      refreshing={proposals.isRefetching}
      onRefresh={() => void proposals.refetch()}
    >
      {proposals.isError ? (
        <ErrorState error={proposals.error} onRetry={() => void proposals.refetch()} />
      ) : proposals.isLoading ? (
        <ListSkeleton rows={5} />
      ) : items.length === 0 ? (
        <EmptyState icon="send" title="Nessuna proposta" message="Nessuna proposta in questo stato." />
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          {items.map((proposal) => (
            <ProposalListItem
              key={proposal.id}
              proposal={proposal}
              counterpart={`${proposal.client?.name ?? ''}${proposal.advisor ? ` · ${proposal.advisor.name}` : ''}`}
              onPress={() => router.push(`/admin/proposal/${proposal.id}`)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
