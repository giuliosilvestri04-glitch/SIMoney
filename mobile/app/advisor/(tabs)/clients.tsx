import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAdvisorClients } from '@/api/queries';
import { useTheme } from '@/lib/theme-context';
import { formatCurrency } from '@/lib/format';
import { AppText } from '@/components/ui/AppText';
import { Chip } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TextField } from '@/components/ui/TextField';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/States';
import { ClientListItem } from '@/components/domain/ListItems';

type Sort = 'value_desc' | 'performance_desc' | 'name_asc';

/**
 * CLIENTI DEL CONSULENTE.
 *
 * Il backend restituisce SOLO i clienti assegnati: qui non esiste un modo per
 * vederne altri, nemmeno cambiando i parametri di ricerca.
 */
export default function AdvisorClientsScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sort, setSort] = useState<Sort>('value_desc');
  const [onlyPending, setOnlyPending] = useState(false);

  // Si attende una pausa nella digitazione prima di interrogare il server:
  // meno richieste, lista più reattiva.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const clients = useAdvisorClients({
    search: debounced || undefined,
    sort,
    onlyPendingProposals: onlyPending || undefined,
  });

  const items = clients.data?.data ?? [];
  const totals = clients.data?.totals;

  const header = (
    <ScreenHeader
      title="Clienti"
      subtitle={totals ? `${totals.clients} clienti · ${formatCurrency(Number(totals.assetsUnderManagement), 'EUR', 0)}` : undefined}
      action={{ icon: 'plus', label: 'Nuova proposta', onPress: () => router.push('/advisor/new-proposal') }}
      below={
        <View style={{ gap: theme.spacing.md }}>
          <TextField
            icon="search"
            value={search}
            onChangeText={setSearch}
            placeholder="Cerca per nome, codice o città"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          <SegmentedControl
            options={[
              { value: 'value_desc', label: 'Patrimonio' },
              { value: 'performance_desc', label: 'Performance' },
              { value: 'name_asc', label: 'Nome' },
            ]}
            value={sort}
            onChange={setSort}
            compact
          />
          <View style={{ flexDirection: 'row' }}>
            <Chip
              label="Solo con proposte in attesa"
              selected={onlyPending}
              onPress={() => setOnlyPending((value) => !value)}
            />
          </View>
        </View>
      }
    />
  );

  return (
    <Screen header={header} refreshing={clients.isRefetching} onRefresh={() => void clients.refetch()}>
      {clients.isError ? (
        <ErrorState error={clients.error} onRetry={() => void clients.refetch()} />
      ) : clients.isLoading ? (
        <ListSkeleton rows={5} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="users"
          title="Nessun cliente trovato"
          message={
            debounced || onlyPending
              ? 'Prova a modificare la ricerca o a rimuovere i filtri.'
              : 'Non hai ancora clienti assegnati.'
          }
          action={
            debounced || onlyPending
              ? {
                  label: 'Azzera filtri',
                  onPress: () => {
                    setSearch('');
                    setOnlyPending(false);
                  },
                }
              : undefined
          }
        />
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          {items.map((client) => (
            <ClientListItem
              key={client.id}
              client={client}
              onPress={() => router.push(`/advisor/client/${client.id}`)}
            />
          ))}

          <Card variant="outlined">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText variant="caption" tone="muted">
                Totale gestito
              </AppText>
              <AppText variant="amountSmall">
                {formatCurrency(items.reduce((sum, client) => sum + client.totalValue, 0), 'EUR', 0)}
              </AppText>
            </View>
          </Card>
        </View>
      )}
    </Screen>
  );
}
