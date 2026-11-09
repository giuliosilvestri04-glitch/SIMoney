import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useCompanyProposal } from '@/api/queries';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { ErrorState, PortfolioSkeleton } from '@/components/ui/States';
import { ProposalDetailView } from '@/components/domain/ProposalDetailView';

/** Dettaglio proposta per la direzione (sola lettura, qualsiasi consulente). */
export default function AdminProposalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const proposal = useCompanyProposal(String(id ?? ''));

  return (
    <Screen
      header={<ScreenHeader title="Proposta" subtitle={proposal.data?.code} back />}
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
