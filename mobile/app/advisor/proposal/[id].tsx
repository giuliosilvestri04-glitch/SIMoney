import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useAdvisorProposal } from '@/api/queries';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { ErrorState, PortfolioSkeleton } from '@/components/ui/States';
import { ProposalDetailView } from '@/components/domain/ProposalDetailView';

/** Dettaglio di una proposta creata dal consulente (sola lettura). */
export default function AdvisorProposalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const proposal = useAdvisorProposal(String(id ?? ''));

  const header = <ScreenHeader title="Proposta" subtitle={proposal.data?.code} back />;

  return (
    <Screen
      header={header}
      tabBarPadding={false}
      refreshing={proposal.isRefetching}
      onRefresh={() => void proposal.refetch()}
    >
      {proposal.isError ? (
        <ErrorState error={proposal.error} onRetry={() => void proposal.refetch()} />
      ) : proposal.data ? (
        <ProposalDetailView proposal={proposal.data} />
      ) : (
        <PortfolioSkeleton />
      )}
    </Screen>
  );
}
