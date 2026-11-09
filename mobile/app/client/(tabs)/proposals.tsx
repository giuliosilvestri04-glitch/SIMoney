import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useClientProposals } from '@/api/queries';
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

/**
 * PROPOSTE RICEVUTE DAL CLIENTE.
 *
 * Il filtro per stato è a pillole sopra la lista: sempre visibile, a portata
 * di pollice, senza menù nascosti.
 */
export default function ClientProposalsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('ALL');

  const proposals = useClientProposals(filter === 'ALL' ? undefined : filter);
  const items = proposals.data?.data ?? [];

  const header = (
    <ScreenHeader
      title="Proposte"
      subtitle="Le proposte di investimento del tuo consulente"
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
    <Screen
      header={header}
      refreshing={proposals.isRefetching}
      onRefresh={() => void proposals.refetch()}
    >
      {proposals.isError ? (
        <ErrorState error={proposals.error} onRetry={() => void proposals.refetch()} />
      ) : proposals.isLoading ? (
        <ListSkeleton rows={4} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="inbox"
          title={filter === 'ALL' ? 'Nessuna proposta' : 'Nessuna proposta in questo stato'}
          message={
            filter === 'ALL'
              ? 'Quando il tuo consulente invierà una proposta la troverai qui, con tutti i dettagli.'
              : 'Prova a cambiare filtro per vedere le altre proposte.'
          }
        />
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          {items.map((proposal) => (
            <ProposalListItem
              key={proposal.id}
              proposal={proposal}
              counterpart={proposal.advisor?.name}
              unread={proposal.status === 'PENDING' && !proposal.isRead}
              onPress={() => router.push(`/client/proposal/${proposal.id}`)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
