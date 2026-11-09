import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ApiError } from '@/api/client';
import { useClientProposal, useRespondToProposal } from '@/api/queries';
import type { ProposalAllocationRow, ProposalDetail, ProposalResponseResult } from '@/api/types';
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
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Card, Section } from '@/components/ui/Card';
import { ColorDot, ProgressBar } from '@/components/ui/Rows';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { ErrorState, PortfolioSkeleton } from '@/components/ui/States';
import { TextField } from '@/components/ui/TextField';
import { DocumentListItem } from '@/components/domain/ListItems';

const ACTION_LABEL: Record<string, string> = {
  BUY: 'Acquisto',
  SELL: 'Vendita',
  SWITCH: 'Switch',
};

/**
 * DETTAGLIO PROPOSTA — lato cliente.
 *
 * Il cliente legge, apre il documento e risponde. Due pulsanti grandi ancorati
 * in fondo, sempre raggiungibili col pollice senza dover scorrere fino in fondo.
 *
 * IMPORTANTE: l'accettazione qui è la SIMULAZIONE dell'esperienza utente.
 * Non è una firma elettronica qualificata e non sostituisce il sistema
 * ufficiale dell'azienda: la schermata lo dichiara esplicitamente, prima e
 * dopo la conferma.
 */
export default function ClientProposalScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const proposalId = String(id ?? '');

  const proposal = useClientProposal(proposalId);
  const respond = useRespondToProposal();
  const viewer = useDocumentViewer();

  const [confirming, setConfirming] = useState<'ACCEPTED' | 'REJECTED' | null>(null);
  const [note, setNote] = useState('');
  const [result, setResult] = useState<ProposalResponseResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const data = proposal.data;

  const submit = async () => {
    if (!confirming) return;
    setActionError(null);
    try {
      const response = await respond.mutateAsync({
        id: proposalId,
        decision: confirming,
        note: note.trim() || undefined,
      });
      setConfirming(null);
      setNote('');
      setResult(response);
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'Operazione non riuscita. Riprova.',
      );
    }
  };

  const header = (
    <ScreenHeader title="Proposta" subtitle={data?.code} back />
  );

  if (proposal.isError) {
    return (
      <Screen header={header} tabBarPadding={false}>
        <ErrorState error={proposal.error} onRetry={() => void proposal.refetch()} />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen header={header} tabBarPadding={false}>
        <PortfolioSkeleton />
      </Screen>
    );
  }

  const pending = data.status === 'PENDING';

  return (
    <>
      <Screen
        header={header}
        tabBarPadding={false}
        refreshing={proposal.isRefetching}
        onRefresh={() => void proposal.refetch()}
        footer={
          pending ? (
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Rifiuta"
                  onPress={() => {
                    setActionError(null);
                    setConfirming('REJECTED');
                  }}
                  variant="destructive"
                  size="lg"
                />
              </View>
              <View style={{ flex: 1.35 }}>
                <Button
                  label="Accetta"
                  onPress={() => {
                    setActionError(null);
                    setConfirming('ACCEPTED');
                  }}
                  variant="positive"
                  size="lg"
                  icon="check"
                  haptic
                />
              </View>
            </View>
          ) : undefined
        }
      >
        {/* Intestazione della proposta */}
        <Card>
          <View style={{ gap: theme.spacing.base }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
              <StatusBadge status={data.status} label={data.statusLabel} />
              {pending && data.daysToExpiry !== null && (
                <Badge
                  label={formatExpiry(data.daysToExpiry)}
                  tone={data.daysToExpiry <= 3 ? 'negative' : 'neutral'}
                  icon="clock"
                />
              )}
            </View>

            <AppText variant="title">{data.title}</AppText>

            <View style={{ gap: 4 }}>
              <AppText variant="micro" tone="faint" uppercase>
                Importo della proposta
              </AppText>
              <AppText variant="display">{formatCurrency(data.amount, data.currency, 2)}</AppText>
            </View>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingTop: theme.spacing.md,
                borderTopWidth: 1,
                borderTopColor: theme.colors.border,
              }}
            >
              <View style={{ gap: 2 }}>
                <AppText variant="micro" tone="faint" uppercase>
                  Proposta da
                </AppText>
                <AppText variant="caption">{data.advisor?.name ?? '—'}</AppText>
              </View>
              <View style={{ gap: 2, alignItems: 'flex-end' }}>
                <AppText variant="micro" tone="faint" uppercase>
                  {data.respondedAt ? 'Risposta il' : 'Valida fino al'}
                </AppText>
                <AppText variant="caption">
                  {formatDate(data.respondedAt ?? data.expiresAt)}
                </AppText>
              </View>
            </View>
          </View>
        </Card>

        {/* Esito, quando già risposta */}
        {data.respondedAt && (
          <Card variant="outlined">
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Feather
                name={data.status === 'ACCEPTED' ? 'check-circle' : 'x-circle'}
                size={20}
                color={data.status === 'ACCEPTED' ? theme.colors.positive : theme.colors.negative}
              />
              <View style={{ flex: 1, gap: 4 }}>
                <AppText variant="bodyStrong">
                  {data.status === 'ACCEPTED' ? 'Hai accettato questa proposta' : 'Hai rifiutato questa proposta'}
                </AppText>
                <AppText variant="caption" tone="muted">
                  {formatDateLong(data.respondedAt)}
                </AppText>
                {data.responseNote && (
                  <AppText variant="caption" tone="muted" style={{ fontStyle: 'italic' }}>
                    «{data.responseNote}»
                  </AppText>
                )}
              </View>
            </View>
          </Card>
        )}

        {/* Descrizione */}
        <Section title="In sintesi">
          <Card>
            <View style={{ gap: theme.spacing.md }}>
              <AppText variant="body" tone="muted">
                {data.description}
              </AppText>
              {data.rationale && (
                <View
                  style={{
                    gap: 6,
                    padding: theme.spacing.md,
                    borderRadius: theme.radius.sm,
                    backgroundColor: theme.colors.surfaceSunken,
                  }}
                >
                  <AppText variant="micro" tone="faint" uppercase>
                    Motivazione del consulente
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    {data.rationale}
                  </AppText>
                </View>
              )}
            </View>
          </Card>
        </Section>

        {/* Operazioni */}
        <Section title={`Operazioni proposte (${data.items.length})`}>
          <Card>
            <View style={{ gap: theme.spacing.md }}>
              {data.items.map((item, index) => (
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
                        {item.isin ? ` · ${item.isin}` : ''}
                      </AppText>
                    </View>
                    <AppText variant="amountSmall">
                      {formatCurrency(item.amount, data.currency, 0)}
                    </AppText>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        </Section>

        {/* Confronto asset allocation */}
        {data.allocation.length > 0 && (
          <Section title="Asset allocation: oggi e dopo la proposta">
            <Card>
              <View style={{ gap: theme.spacing.base }}>
                {data.allocation.map((row) => (
                  <AllocationComparison key={row.key} row={row} />
                ))}
              </View>
            </Card>
          </Section>
        )}

        {/* Documenti */}
        {data.documents.length > 0 && (
          <Section title="Documenti">
            <Card>
              <View style={{ gap: theme.spacing.sm }}>
                {data.documents.map((document, index) => (
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

        {/* Avviso sulla natura simulata */}
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
            {data.simulationNotice}
          </AppText>
        </View>
      </Screen>

      {/* Conferma della risposta */}
      <ConfirmSheet
        decision={confirming}
        proposal={data}
        note={note}
        onNoteChange={setNote}
        error={actionError}
        submitting={respond.isPending}
        onCancel={() => {
          setConfirming(null);
          setActionError(null);
        }}
        onConfirm={() => void submit()}
      />

      {/* Esito dell'operazione */}
      <ResultSheet result={result} onClose={() => setResult(null)} />
    </>
  );
}

/** Riga di confronto fra peso attuale e peso proposto di una categoria. */
function AllocationComparison({ row }: { row: ProposalAllocationRow }) {
  const theme = useTheme();
  const increasing = row.deltaPct > 0;

  return (
    <View style={{ gap: 8 }}>
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
        {Math.abs(row.deltaPct) >= 0.1 && (
          <AppText
            variant="micro"
            style={{ color: increasing ? theme.colors.positive : theme.colors.negative, minWidth: 42, textAlign: 'right' }}
          >
            {formatPercent(row.deltaPct, 1)}
          </AppText>
        )}
      </View>

      <View style={{ gap: 3 }}>
        <ProgressBar value={row.currentPct} color={theme.colors.borderStrong} height={4} />
        <ProgressBar value={row.proposedPct} color={row.colorHex} height={6} />
      </View>
    </View>
  );
}

interface ConfirmSheetProps {
  decision: 'ACCEPTED' | 'REJECTED' | null;
  proposal: ProposalDetail;
  note: string;
  onNoteChange: (value: string) => void;
  error: string | null;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmSheet({
  decision,
  proposal,
  note,
  onNoteChange,
  error,
  submitting,
  onCancel,
  onConfirm,
}: ConfirmSheetProps) {
  const theme = useTheme();
  const accepting = decision === 'ACCEPTED';

  return (
    <BottomSheet
      visible={decision !== null}
      onClose={onCancel}
      title={accepting ? 'Conferma accettazione' : 'Conferma rifiuto'}
      subtitle={proposal.title}
      footer={
        <View style={{ gap: theme.spacing.sm }}>
          <Button
            label={accepting ? 'Conferma accettazione' : 'Conferma rifiuto'}
            onPress={onConfirm}
            variant={accepting ? 'positive' : 'destructive'}
            size="lg"
            loading={submitting}
            haptic
          />
          <Button label="Annulla" onPress={onCancel} variant="ghost" />
        </View>
      }
    >
      <View style={{ gap: theme.spacing.base, paddingBottom: theme.spacing.base }}>
        <View
          style={{
            gap: theme.spacing.sm,
            padding: theme.spacing.base,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.surfaceSunken,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText variant="caption" tone="muted">
              Importo
            </AppText>
            <AppText variant="amountSmall">{formatCurrency(proposal.amount, proposal.currency, 2)}</AppText>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText variant="caption" tone="muted">
              Operazioni
            </AppText>
            <AppText variant="label">{proposal.items.length}</AppText>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText variant="caption" tone="muted">
              Riferimento
            </AppText>
            <AppText variant="label">{proposal.code}</AppText>
          </View>
        </View>

        <TextField
          label={accepting ? 'Nota per il consulente (facoltativa)' : 'Motivo del rifiuto (facoltativo)'}
          value={note}
          onChangeText={onNoteChange}
          placeholder={accepting ? 'Es. procediamo pure.' : 'Es. preferisco attendere il prossimo trimestre.'}
          multiline
          maxLength={500}
          editable={!submitting}
        />

        {error && (
          <View
            style={{
              flexDirection: 'row',
              gap: theme.spacing.sm,
              padding: theme.spacing.md,
              borderRadius: theme.radius.sm,
              backgroundColor: theme.colors.negativeSoft,
            }}
          >
            <Feather name="alert-circle" size={15} color={theme.colors.negative} />
            <AppText variant="caption" tone="negative" style={{ flex: 1 }}>
              {error}
            </AppText>
          </View>
        )}

        <AppText variant="micro" tone="faint">
          {proposal.simulationNotice}
        </AppText>
      </View>
    </BottomSheet>
  );
}

function ResultSheet({
  result,
  onClose,
}: {
  result: ProposalResponseResult | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const accepted = result?.confirmation.decision === 'ACCEPTED';

  return (
    <BottomSheet
      visible={result !== null}
      onClose={onClose}
      scrollable={false}
      footer={<Button label="Chiudi" onPress={onClose} size="lg" />}
    >
      {result && (
        <View style={{ alignItems: 'center', gap: theme.spacing.base, paddingVertical: theme.spacing.lg }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: accepted ? theme.colors.positiveSoft : theme.colors.negativeSoft,
            }}
          >
            <Feather
              name={accepted ? 'check' : 'x'}
              size={32}
              color={accepted ? theme.colors.positive : theme.colors.negative}
            />
          </View>

          <View style={{ gap: 8, alignItems: 'center' }}>
            <AppText variant="title" align="center">
              {result.confirmation.decisionLabel}
            </AppText>
            <AppText variant="body" tone="muted" align="center">
              {result.confirmation.message}
            </AppText>
          </View>

          <AppText variant="micro" tone="faint" align="center">
            {result.confirmation.notice}
          </AppText>
        </View>
      )}
    </BottomSheet>
  );
}
