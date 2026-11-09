import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme-context';
import {
  formatCurrency,
  formatDate,
  formatExpiry,
  formatPercent,
  formatRelative,
} from '@/lib/format';
import type {
  AdvisorClientRow,
  DocumentSummary,
  Holding,
  ProposalSummary,
  Transaction,
  TransactionType,
} from '@/api/types';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ColorDot, ListRow } from '@/components/ui/Rows';
import { Delta } from '@/components/ui/Delta';

/** Elementi di lista condivisi fra le tre aree dell'app. */

// --- Proposta ---------------------------------------------------------------

interface ProposalListItemProps {
  proposal: ProposalSummary | {
    id: string;
    code: string;
    title: string;
    amount: number;
    currency: string;
    status: ProposalSummary['status'];
    statusLabel: string;
    daysToExpiry?: number | null;
    documentsCount?: number;
  };
  onPress: () => void;
  /** Nome mostrato sotto al titolo: il consulente per il cliente, e viceversa. */
  counterpart?: string | null;
  unread?: boolean;
}

export function ProposalListItem({ proposal, onPress, counterpart, unread }: ProposalListItemProps) {
  const theme = useTheme();
  const pending = proposal.status === 'PENDING';
  const expiring = pending && typeof proposal.daysToExpiry === 'number' && proposal.daysToExpiry <= 3;

  return (
    <Card onPress={onPress} padded>
      <View style={{ gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.md }}>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {unread && (
                <View
                  style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.accent }}
                />
              )}
              <AppText variant="headline" numberOfLines={2} style={{ flex: 1 }}>
                {proposal.title}
              </AppText>
            </View>
            <AppText variant="micro" tone="faint">
              {proposal.code}
              {counterpart ? ` · ${counterpart}` : ''}
            </AppText>
          </View>
          <Feather name="chevron-right" size={18} color={theme.colors.textFaint} />
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
            <StatusBadge status={proposal.status} label={proposal.statusLabel} />
            {expiring && (
              <Badge label={formatExpiry(proposal.daysToExpiry ?? null)} tone="negative" icon="clock" />
            )}
            {!expiring && pending && typeof proposal.daysToExpiry === 'number' && (
              <AppText variant="micro" tone="faint">
                {formatExpiry(proposal.daysToExpiry)}
              </AppText>
            )}
          </View>
          <AppText variant="amount">{formatCurrency(proposal.amount, proposal.currency, 0)}</AppText>
        </View>
      </View>
    </Card>
  );
}

// --- Investimento -----------------------------------------------------------

export function HoldingListItem({ holding, onPress }: { holding: Holding; onPress?: () => void }) {
  return (
    <ListRow
      title={holding.instrument.name}
      subtitle={`${holding.assetClass.label} · ${formatPercent(holding.weightPct, 1, false)} del portafoglio`}
      leading={<ColorDot color={holding.assetClass.colorHex} size={12} />}
      value={formatCurrency(holding.marketValue, holding.instrument.currency, 0)}
      valueHint={<Delta percent={holding.pnlPct} variant="micro" />}
      onPress={onPress}
    />
  );
}

// --- Movimento --------------------------------------------------------------

const TRANSACTION_META: Record<
  TransactionType,
  { label: string; icon: keyof typeof Feather.glyphMap; direction: 'in' | 'out' | 'neutral' }
> = {
  BUY: { label: 'Acquisto', icon: 'shopping-bag', direction: 'neutral' },
  SELL: { label: 'Vendita', icon: 'tag', direction: 'neutral' },
  DIVIDEND: { label: 'Dividendo', icon: 'gift', direction: 'in' },
  COUPON: { label: 'Cedola', icon: 'percent', direction: 'in' },
  FEE: { label: 'Commissioni', icon: 'minus-circle', direction: 'out' },
  DEPOSIT: { label: 'Versamento', icon: 'plus-circle', direction: 'in' },
  WITHDRAWAL: { label: 'Prelievo', icon: 'arrow-up-circle', direction: 'out' },
};

export function TransactionListItem({
  transaction,
}: {
  transaction: Pick<Transaction, 'type' | 'amount' | 'date' | 'description'> & { currency?: string };
}) {
  const theme = useTheme();
  const meta = TRANSACTION_META[transaction.type] ?? TRANSACTION_META.BUY;
  const amount = Math.abs(transaction.amount);

  const tone =
    meta.direction === 'in' ? 'positive' : meta.direction === 'out' ? 'negative' : 'default';
  const prefix = meta.direction === 'in' ? '+' : meta.direction === 'out' ? '−' : '';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, minHeight: 52 }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surfaceSunken,
        }}
      >
        <Feather name={meta.icon} size={15} color={theme.colors.textMuted} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {transaction.description}
        </AppText>
        <AppText variant="micro" tone="faint">
          {meta.label} · {formatDate(transaction.date)}
        </AppText>
      </View>
      <AppText variant="amountSmall" tone={tone}>
        {prefix}
        {formatCurrency(amount, transaction.currency ?? 'EUR', 2)}
      </AppText>
    </View>
  );
}

// --- Documento --------------------------------------------------------------

interface DocumentListItemProps {
  document: DocumentSummary;
  onOpen: () => void;
  busy?: boolean;
}

export function DocumentListItem({ document, onOpen, busy }: DocumentListItemProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onOpen}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={`Apri ${document.title}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, minHeight: 58 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: theme.radius.sm,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.negativeSoft,
          }}
        >
          {busy ? (
            <ActivityIndicator size="small" color={theme.colors.negative} />
          ) : (
            <Feather name="file-text" size={18} color={theme.colors.negative} />
          )}
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <AppText variant="bodyStrong" numberOfLines={2}>
            {document.title}
          </AppText>
          <AppText variant="micro" tone="faint">
            {document.categoryLabel} · PDF · {document.sizeLabel} · {formatDate(document.createdAt)}
          </AppText>
        </View>
        <Feather name="download" size={18} color={theme.colors.textFaint} />
      </View>
    </Pressable>
  );
}

// --- Cliente (area consulente) ---------------------------------------------

interface ClientListItemProps {
  client: AdvisorClientRow;
  onPress: () => void;
}

export function ClientListItem({ client, onPress }: ClientListItemProps) {
  const theme = useTheme();

  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <Avatar name={client.name} color={client.avatarColor} initials={client.initials} />

        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {client.name}
          </AppText>
          <AppText variant="micro" tone="faint" numberOfLines={1}>
            {client.clientCode} · {client.city} · {client.riskProfile.toLowerCase()}
          </AppText>
          {client.pendingProposals > 0 && (
            <Badge
              label={`${client.pendingProposals} in attesa`}
              tone="warning"
              icon="clock"
              style={{ marginTop: 2 }}
            />
          )}
        </View>

        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <AppText variant="amountSmall">{formatCurrency(client.totalValue, client.currency, 0)}</AppText>
          <Delta percent={client.performancePct} variant="micro" />
        </View>

        <Feather name="chevron-right" size={18} color={theme.colors.textFaint} />
      </View>
    </Card>
  );
}
