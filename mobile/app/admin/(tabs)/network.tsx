import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAdvisorsBreakdown, useCompanyClients } from '@/api/queries';
import { useTheme } from '@/lib/theme-context';
import { formatCurrency, formatCurrencyShort, formatPercent } from '@/lib/format';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Delta } from '@/components/ui/Delta';
import { ProgressBar } from '@/components/ui/Rows';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TextField } from '@/components/ui/TextField';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/States';

type View_ = 'advisors' | 'clients';

/**
 * RETE COMMERCIALE.
 *
 * Due elenchi nella stessa schermata, selezionabili a segmenti: consulenti e
 * clienti. Evita due voci quasi identiche nella barra inferiore.
 */
export default function AdminNetworkScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [view, setView] = useState<View_>('advisors');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const advisors = useAdvisorsBreakdown();
  const clients = useCompanyClients(view === 'clients' ? debounced || undefined : undefined);

  const header = (
    <ScreenHeader
      title="Rete"
      subtitle={view === 'advisors' ? 'Consulenti e portafogli gestiti' : 'Clienti dell\'azienda'}
      below={
        <View style={{ gap: theme.spacing.md }}>
          <SegmentedControl
            options={[
              { value: 'advisors', label: 'Consulenti' },
              { value: 'clients', label: 'Clienti' },
            ]}
            value={view}
            onChange={setView}
          />
          {view === 'clients' && (
            <TextField
              icon="search"
              value={search}
              onChangeText={setSearch}
              placeholder="Cerca per nome, codice o città"
              autoCapitalize="none"
            />
          )}
        </View>
      }
    />
  );

  return (
    <Screen
      header={header}
      refreshing={view === 'advisors' ? advisors.isRefetching : clients.isRefetching}
      onRefresh={() => (view === 'advisors' ? void advisors.refetch() : void clients.refetch())}
    >
      {view === 'advisors' ? (
        advisors.isError ? (
          <ErrorState error={advisors.error} onRetry={() => void advisors.refetch()} />
        ) : advisors.isLoading ? (
          <ListSkeleton rows={5} />
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            {(advisors.data ?? []).map((advisor) => (
              <Card key={advisor.advisorId}>
                <View style={{ gap: theme.spacing.base }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                    <Avatar name={advisor.name} color={advisor.avatarColor} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <AppText variant="bodyStrong" numberOfLines={1}>
                        {advisor.name}
                      </AppText>
                      <AppText variant="micro" tone="faint">
                        {advisor.code} · {advisor.officeCity} · {advisor.clients} clienti
                      </AppText>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 3 }}>
                      <AppText variant="amountSmall">
                        {formatCurrencyShort(advisor.assetsUnderManagement)}
                      </AppText>
                      <Delta percent={advisor.averagePerformancePct} variant="micro" />
                    </View>
                  </View>

                  <View style={{ gap: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <AppText variant="micro" tone="faint" uppercase>
                        Quota del patrimonio aziendale
                      </AppText>
                      <AppText variant="label">{formatPercent(advisor.shareOfCompanyPct, 1, false)}</AppText>
                    </View>
                    <ProgressBar value={advisor.shareOfCompanyPct} />
                  </View>

                  <View
                    style={{
                      flexDirection: 'row',
                      gap: theme.spacing.sm,
                      flexWrap: 'wrap',
                      paddingTop: theme.spacing.sm,
                      borderTopWidth: 1,
                      borderTopColor: theme.colors.border,
                    }}
                  >
                    <Badge label={`${advisor.proposals.accepted} accettate`} tone="positive" />
                    <Badge label={`${advisor.proposals.pending} in attesa`} tone="warning" />
                    <Badge label={`${advisor.proposals.rejected} rifiutate`} tone="negative" />
                    <Badge
                      label={`accettazione ${formatPercent(advisor.acceptanceRatePct, 0, false)}`}
                      tone="neutral"
                      icon="percent"
                    />
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )
      ) : clients.isError ? (
        <ErrorState error={clients.error} onRetry={() => void clients.refetch()} />
      ) : clients.isLoading ? (
        <ListSkeleton rows={6} />
      ) : (clients.data?.data ?? []).length === 0 ? (
        <EmptyState
          icon="users"
          title="Nessun cliente trovato"
          message="Prova a modificare la ricerca."
        />
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          {(clients.data?.data ?? []).map((client) => (
            <Card key={client.id} onPress={() => router.push(`/admin/client/${client.id}`)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                <Avatar name={client.name} color={client.avatarColor} />
                <View style={{ flex: 1, gap: 3 }}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {client.name}
                  </AppText>
                  <AppText variant="micro" tone="faint" numberOfLines={1}>
                    {client.clientCode} · {client.city} · {client.advisor.name}
                  </AppText>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 3 }}>
                  <AppText variant="amountSmall">
                    {formatCurrency(client.totalValue, client.currency, 0)}
                  </AppText>
                  <Delta percent={client.performancePct} variant="micro" />
                </View>
                <Feather name="chevron-right" size={18} color={theme.colors.textFaint} />
              </View>
            </Card>
          ))}

          {clients.data?.totals && (
            <Card variant="outlined">
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <AppText variant="caption" tone="muted">
                  Patrimonio complessivo
                </AppText>
                <AppText variant="amountSmall">
                  {formatCurrency(Number(clients.data.totals.assetsUnderManagement), 'EUR', 0)}
                </AppText>
              </View>
            </Card>
          )}
        </View>
      )}
    </Screen>
  );
}
