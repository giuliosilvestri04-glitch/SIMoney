import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuditLog } from '@/api/queries';
import { useTheme } from '@/lib/theme-context';
import { formatDateTime, formatRelative } from '@/lib/format';
import { AppText } from '@/components/ui/AppText';
import { Chip } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/States';

/** Descrizione leggibile delle azioni tracciate dal backend. */
const ACTION_META: Record<string, { label: string; icon: keyof typeof Feather.glyphMap; tone: 'accent' | 'positive' | 'negative' | 'muted' }> = {
  AUTH_LOGIN_SUCCESS: { label: 'Accesso effettuato', icon: 'log-in', tone: 'accent' },
  AUTH_LOGIN_FAILED: { label: 'Accesso non riuscito', icon: 'alert-triangle', tone: 'negative' },
  AUTH_LOGOUT: { label: 'Uscita', icon: 'log-out', tone: 'muted' },
  AUTH_TOKEN_REFRESH: { label: 'Sessione rinnovata', icon: 'refresh-cw', tone: 'muted' },
  PROPOSAL_CREATED: { label: 'Proposta creata', icon: 'file-plus', tone: 'accent' },
  PROPOSAL_VIEWED: { label: 'Proposta consultata', icon: 'eye', tone: 'muted' },
  PROPOSAL_ACCEPTED: { label: 'Proposta accettata', icon: 'check-circle', tone: 'positive' },
  PROPOSAL_REJECTED: { label: 'Proposta rifiutata', icon: 'x-circle', tone: 'negative' },
  DOCUMENT_VIEWED: { label: 'Documento aperto', icon: 'file-text', tone: 'muted' },
  CLIENT_VIEWED: { label: 'Cliente consultato', icon: 'user', tone: 'muted' },
  ANALYTICS_VIEWED: { label: 'Analisi consultate', icon: 'bar-chart-2', tone: 'muted' },
};

const FILTERS = [
  { value: '', label: 'Tutte' },
  { value: 'PROPOSAL_ACCEPTED', label: 'Accettazioni' },
  { value: 'PROPOSAL_REJECTED', label: 'Rifiuti' },
  { value: 'PROPOSAL_CREATED', label: 'Creazioni' },
  { value: 'AUTH_LOGIN_SUCCESS', label: 'Accessi' },
];

/**
 * REGISTRO ATTIVITÀ (audit).
 *
 * Requisito 27: chi ha fatto cosa e quando. È la schermata che dimostra che il
 * prototipo tiene traccia delle azioni sensibili, non solo che le esegue.
 */
export default function AdminAuditScreen() {
  const theme = useTheme();
  const [action, setAction] = useState('');
  const audit = useAuditLog(action || undefined);

  const entries = audit.data?.data ?? [];

  return (
    <Screen
      tabBarPadding={false}
      header={
        <ScreenHeader
          title="Registro attività"
          back
          subtitle={audit.data?.meta ? `${audit.data.meta.total} eventi registrati` : undefined}
          below={
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: theme.spacing.sm, paddingRight: theme.spacing.base }}
            >
              {FILTERS.map((filter) => (
                <Chip
                  key={filter.value || 'all'}
                  label={filter.label}
                  selected={action === filter.value}
                  onPress={() => setAction(filter.value)}
                />
              ))}
            </ScrollView>
          }
        />
      }
      refreshing={audit.isRefetching}
      onRefresh={() => void audit.refetch()}
    >
      {audit.isError ? (
        <ErrorState error={audit.error} onRetry={() => void audit.refetch()} />
      ) : audit.isLoading ? (
        <ListSkeleton rows={6} />
      ) : entries.length === 0 ? (
        <EmptyState icon="list" title="Nessun evento" message="Non ci sono attività per questo filtro." />
      ) : (
        <Card>
          <View style={{ gap: theme.spacing.md }}>
            {entries.map((entry, index) => {
              const meta = ACTION_META[entry.action] ?? {
                label: entry.action,
                icon: 'activity' as const,
                tone: 'muted' as const,
              };
              const color =
                meta.tone === 'positive'
                  ? theme.colors.positive
                  : meta.tone === 'negative'
                    ? theme.colors.negative
                    : meta.tone === 'accent'
                      ? theme.colors.accent
                      : theme.colors.textMuted;

              return (
                <View key={entry.id} style={{ gap: theme.spacing.md }}>
                  {index > 0 && <View style={{ height: 1, backgroundColor: theme.colors.border }} />}
                  <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'flex-start' }}>
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: theme.colors.surfaceSunken,
                      }}
                    >
                      <Feather name={meta.icon} size={15} color={color} />
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <AppText variant="bodyStrong" numberOfLines={1}>
                        {meta.label}
                      </AppText>
                      <AppText variant="micro" tone="faint" numberOfLines={1}>
                        {entry.actor.name}
                        {entry.actor.role ? ` · ${entry.actor.role.toLowerCase()}` : ''}
                      </AppText>
                      <AppText variant="micro" tone="faint">
                        {formatDateTime(entry.createdAt)} · {formatRelative(entry.createdAt)}
                      </AppText>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </Card>
      )}

      <AppText variant="micro" tone="faint" align="center">
        Vengono registrati accessi, creazione e consultazione delle proposte, accettazioni, rifiuti e
        apertura dei documenti.
      </AppText>
    </Screen>
  );
}
