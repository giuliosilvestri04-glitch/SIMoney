import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useClientTransactions } from '@/api/queries';
import { useTheme } from '@/lib/theme-context';
import { formatMonthYear, parseDate } from '@/lib/format';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/States';
import { TransactionListItem } from '@/components/domain/ListItems';
import type { Transaction } from '@/api/types';

/**
 * MOVIMENTI.
 *
 * Raggruppati per mese: su una lista lunga il mese è l'ancora di lettura più
 * naturale, ed evita di ripetere l'anno su ogni riga.
 */
export default function ClientTransactionsScreen() {
  const theme = useTheme();
  const transactions = useClientTransactions();

  const groups = useMemo(() => {
    const items = transactions.data?.data ?? [];
    const map = new Map<string, Transaction[]>();

    for (const transaction of items) {
      const key = formatMonthYear(parseDate(transaction.date));
      const bucket = map.get(key) ?? [];
      bucket.push(transaction);
      map.set(key, bucket);
    }

    return [...map.entries()];
  }, [transactions.data]);

  return (
    <Screen
      header={
        <ScreenHeader
          title="Movimenti"
          back
          subtitle={transactions.data?.meta ? `${transactions.data.meta.total} operazioni` : undefined}
        />
      }
      tabBarPadding={false}
      refreshing={transactions.isRefetching}
      onRefresh={() => void transactions.refetch()}
    >
      {transactions.isError ? (
        <ErrorState error={transactions.error} onRetry={() => void transactions.refetch()} />
      ) : transactions.isLoading ? (
        <ListSkeleton rows={6} />
      ) : groups.length === 0 ? (
        <EmptyState
          icon="activity"
          title="Nessun movimento"
          message="Non risultano operazioni registrate sul portafoglio."
        />
      ) : (
        groups.map(([month, items]) => (
          <View key={month} style={{ gap: theme.spacing.sm }}>
            <AppText variant="micro" tone="faint" uppercase style={{ paddingHorizontal: theme.spacing.xs }}>
              {month}
            </AppText>
            <Card>
              <View style={{ gap: theme.spacing.sm }}>
                {items.map((transaction, index) => (
                  <View key={transaction.id} style={{ gap: theme.spacing.sm }}>
                    {index > 0 && <View style={{ height: 1, backgroundColor: theme.colors.border }} />}
                    <TransactionListItem transaction={transaction} />
                  </View>
                ))}
              </View>
            </Card>
          </View>
        ))
      )}
    </Screen>
  );
}
