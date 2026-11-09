import React from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { ProposalDetail } from '@/api/types';
import { useDocumentViewer } from '@/lib/documents';
import { useTheme } from '@/lib/theme-context';
import {
  formatCurrency,
  formatDate,
  formatDateLong,
  formatExpiry,
  formatPercent,
} from '@/lib/format';
import { AppText } from '@/components/ui/AppText';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Card, Section } from '@/components/ui/Card';
import { ColorDot, DataRow, ProgressBar } from '@/components/ui/Rows';
import { DocumentListItem } from './ListItems';

const ACTION_LABEL: Record<string, string> = {
  BUY: 'Acquisto',
  SELL: 'Vendita',
  SWITCH: 'Switch',
};

/**
 * Vista in SOLA LETTURA di una proposta.
 *
 * Usata da consulente e direzione: possono esaminare tutto, ma la risposta
 * spetta unicamente al cliente (ed è il backend a imporlo).
 */
export function ProposalDetailView({ proposal }: { proposal: ProposalDetail }) {
  const theme = useTheme();
  const viewer = useDocumentViewer();
  const pending = proposal.status === 'PENDING';

  return (
    <>
      <Card>
        <View style={{ gap: theme.spacing.base }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
            <StatusBadge status={proposal.status} label={proposal.statusLabel} />
            {pending && proposal.daysToExpiry !== null && (
              <Badge
                label={formatExpiry(proposal.daysToExpiry)}
                tone={proposal.daysToExpiry <= 3 ? 'negative' : 'neutral'}
                icon="clock"
              />
            )}
            {pending && (
              <Badge
                label={proposal.isRead ? 'Letta dal cliente' : 'Non ancora letta'}
                tone={proposal.isRead ? 'accent' : 'neutral'}
                icon={proposal.isRead ? 'eye' : 'eye-off'}
              />
            )}
          </View>

          <AppText variant="title">{proposal.title}</AppText>

          <View style={{ gap: 4 }}>
            <AppText variant="micro" tone="faint" uppercase>
              Importo
            </AppText>
            <AppText variant="display">{formatCurrency(proposal.amount, proposal.currency, 2)}</AppText>
          </View>

          <View
            style={{
              gap: theme.spacing.xs,
              paddingTop: theme.spacing.md,
              borderTopWidth: 1,
              borderTopColor: theme.colors.border,
            }}
          >
            {proposal.client && <DataRow label="Cliente" value={proposal.client.name} hint={proposal.client.code} />}
            {proposal.advisor && <DataRow label="Consulente" value={proposal.advisor.name} />}
            <DataRow label="Inviata il" value={formatDate(proposal.createdAt)} />
            <DataRow label="Valida fino al" value={formatDate(proposal.expiresAt)} />
            {proposal.respondedAt && (
              <DataRow
                label="Risposta del cliente"
                value={formatDate(proposal.respondedAt)}
                tone={proposal.status === 'ACCEPTED' ? 'positive' : 'negative'}
              />
            )}
          </View>
        </View>
      </Card>

      {proposal.respondedAt && (
        <Card variant="outlined">
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <Feather
              name={proposal.status === 'ACCEPTED' ? 'check-circle' : 'x-circle'}
              size={20}
              color={proposal.status === 'ACCEPTED' ? theme.colors.positive : theme.colors.negative}
            />
            <View style={{ flex: 1, gap: 4 }}>
              <AppText variant="bodyStrong">
                {proposal.status === 'ACCEPTED'
                  ? 'Il cliente ha accettato la proposta'
                  : 'Il cliente ha rifiutato la proposta'}
              </AppText>
              <AppText variant="caption" tone="muted">
                {formatDateLong(proposal.respondedAt)}
              </AppText>
              {proposal.responseNote && (
                <AppText variant="caption" tone="muted" style={{ fontStyle: 'italic' }}>
                  «{proposal.responseNote}»
                </AppText>
              )}
            </View>
          </View>
        </Card>
      )}

      <Section title="Descrizione">
        <Card>
          <View style={{ gap: theme.spacing.md }}>
            <AppText variant="body" tone="muted">
              {proposal.description}
            </AppText>
            {proposal.rationale && (
              <View
                style={{
                  gap: 6,
                  padding: theme.spacing.md,
                  borderRadius: theme.radius.sm,
                  backgroundColor: theme.colors.surfaceSunken,
                }}
              >
                <AppText variant="micro" tone="faint" uppercase>
                  Motivazione
                </AppText>
                <AppText variant="caption" tone="muted">
                  {proposal.rationale}
                </AppText>
              </View>
            )}
          </View>
        </Card>
      </Section>

      <Section title={`Operazioni (${proposal.items.length})`}>
        <Card>
          <View style={{ gap: theme.spacing.md }}>
            {proposal.items.map((item, index) => (
              <View key={item.id} style={{ gap: theme.spacing.md }}>
                {index > 0 && <View style={{ height: 1, backgroundColor: theme.colors.border }} />}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                  {item.assetClass && <ColorDot color={item.assetClass.colorHex} size={12} />}
                  <View style={{ flex: 1, gap: 3 }}>
                    <AppText variant="bodyStrong" numberOfLines={2}>
                      {item.instrumentName}
                    </AppText>
                    <AppText variant="micro" tone="faint">
                      {ACTION_LABEL[item.action] ?? item.action}
                      {item.assetClass ? ` · ${item.assetClass.label}` : ''}
                    </AppText>
                  </View>
                  <AppText variant="amountSmall">{formatCurrency(item.amount, proposal.currency, 0)}</AppText>
                </View>
              </View>
            ))}
          </View>
        </Card>
      </Section>

      {proposal.allocation.length > 0 && (
        <Section title="Asset allocation proposta">
          <Card>
            <View style={{ gap: theme.spacing.base }}>
              {proposal.allocation.map((row) => (
                <View key={row.key} style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                    <ColorDot color={row.colorHex} />
                    <AppText variant="caption" style={{ flex: 1 }} numberOfLines={1}>
                      {row.label}
                    </AppText>
                    <AppText variant="micro" tone="faint">
                      {formatPercent(row.currentPct, 1, false)}
                    </AppText>
                    <Feather name="arrow-right" size={12} color={theme.colors.textFaint} />
                    <AppText variant="label">{formatPercent(row.proposedPct, 1, false)}</AppText>
                  </View>
                  <View style={{ gap: 3 }}>
                    <ProgressBar value={row.currentPct} color={theme.colors.borderStrong} height={4} />
                    <ProgressBar value={row.proposedPct} color={row.colorHex} height={6} />
                  </View>
                </View>
              ))}
            </View>
          </Card>
        </Section>
      )}

      {proposal.documents.length > 0 && (
        <Section title="Documenti">
          <Card>
            <View style={{ gap: theme.spacing.sm }}>
              {proposal.documents.map((document, index) => (
                <View key={document.id} style={{ gap: theme.spacing.sm }}>
                  {index > 0 && <View style={{ height: 1, backgroundColor: theme.colors.border }} />}
                  <DocumentListItem
                    document={document}
                    busy={viewer.isBusy(document.id)}
                    onOpen={() => void viewer.open(document)}
                  />
                </View>
              ))}
            </View>
          </Card>
        </Section>
      )}

      <View
        style={{
          flexDirection: 'row',
          gap: theme.spacing.sm,
          padding: theme.spacing.md,
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.surfaceSunken,
        }}
      >
        <Feather name="info" size={14} color={theme.colors.textFaint} />
        <AppText variant="micro" tone="faint" style={{ flex: 1 }}>
          La risposta a una proposta può essere data solo dal cliente, dalla sua area.{' '}
          {proposal.simulationNotice}
        </AppText>
      </View>
    </>
  );
}
