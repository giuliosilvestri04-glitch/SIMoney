import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAdvisorProposals } from '@/api/queries';
import type { ProposalStatus } from '@/api/types';
import { useTheme } from '@/lib/theme-context';
import { Button } from '@/components/ui/Button';
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

/** PROPOSTE INVIATE DAL CONSULENTE, con filtro per stato. */
export default function AdvisorProposalsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('ALL');

  const proposals = useAdvisorProposals(filter === 'ALL' ? undefined : filter);
  const items = proposals.data?.data ?? [];

  const header = (
    <ScreenHeader
      title="Proposte"
      subtitle="Le proposte inviate ai tuoi clienti"
      action={{ icon: 'plus', label: 'Nuova proposta', onPress: () => router.push('/advisor/new-proposal') }}
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
  );

  return (
    <Screen header={header} refreshing={proposals.isRefetching} onRefresh={() => void proposals.refetch()}>
      {proposals.isError ? (
        <ErrorState error={proposals.error} onRetry={() => void proposals.refetch()} />
      ) : proposals.isLoading ? (
        <ListSkeleton rows={4} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="send"
          title="Nessuna proposta"
          message={
            filter === 'ALL'
              ? 'Crea la prima proposta per uno dei tuoi clienti.'
              : 'Nessuna proposta in questo stato.'
          }
          action={
            filter === 'ALL'
              ? { label: 'Nuova proposta', onPress: () => router.push('/advisor/new-proposal') }
              : undefined
          }
        />
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          <Button
            label="Nuova proposta"
            onPress={() => router.push('/advisor/new-proposal')}
            variant="secondary"
            icon="plus"
          />
          {items.map((proposal) => (
            <ProposalListItem
              key={proposal.id}
              proposal={proposal}
              counterpart={proposal.client?.name}
              onPress={() => router.push(`/advisor/proposal/${proposal.id}`)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
