import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ApiError } from '@/api/client';
import {
  useAdvisorClientOverview,
  useAdvisorClients,
  useAssetClasses,
  useCreateProposal,
  useInstruments,
} from '@/api/queries';
import type { CreateProposalPayload, InstrumentCatalogItem, ProposalDetail } from '@/api/types';
import { useTheme } from '@/lib/theme-context';
import { formatCurrency, formatPercent } from '@/lib/format';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ColorDot, ProgressBar } from '@/components/ui/Rows';
import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TextField } from '@/components/ui/TextField';
import { EmptyState, ListSkeleton } from '@/components/ui/States';

/**
 * CREAZIONE DI UNA PROPOSTA — flusso guidato.
 *
 * Requisito 21: un passo alla volta, con riepilogo prima dell'invio.
 * Su smartphone un modulo unico con dodici campi è ingestibile: qui ogni
 * schermata chiede una cosa sola, con validazione immediata e possibilità di
 * tornare indietro senza perdere nulla.
 */

interface DraftItem {
  key: string;
  instrumentId?: string;
  instrumentName: string;
  assetClassKey?: string;
  colorHex?: string;
  action: 'BUY' | 'SELL' | 'SWITCH';
  amount: string;
}

interface DraftAllocation {
  key: string;
  label: string;
  colorHex: string;
  currentPct: number;
  proposedPct: number;
}

const STEPS = ['Cliente', 'Proposta', 'Importo', 'Operazioni', 'Allocazione', 'Riepilogo'] as const;

function parseAmount(value: string): number {
  const normalized = value.replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function NewProposalScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ clientId?: string }>();

  const [step, setStep] = useState(0);
  const [clientId, setClientId] = useState<string>(params.clientId ? String(params.clientId) : '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rationale, setRationale] = useState('');
  const [amount, setAmount] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [withAllocation, setWithAllocation] = useState(false);
  const [allocation, setAllocation] = useState<DraftAllocation[]>([]);
  const [attachDocument, setAttachDocument] = useState(true);
  const [created, setCreated] = useState<ProposalDetail | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const clients = useAdvisorClients({ sort: 'name_asc' });
  const overview = useAdvisorClientOverview(clientId);
  const assetClasses = useAssetClasses();
  const createProposal = useCreateProposal();

  const selectedClient = clients.data?.data.find((item) => item.id === clientId);
  const amountValue = parseAmount(amount);
  const itemsTotal = items.reduce((sum, item) => sum + parseAmount(item.amount), 0);
  const allocationTotal = allocation.reduce((sum, row) => sum + row.proposedPct, 0);

  // L'allocazione proposta parte da quella attuale del cliente: il consulente
  // ritocca i pesi invece di inventarli da zero.
  useEffect(() => {
    if (!withAllocation || allocation.length > 0) return;
    const current = overview.data?.summary.allocation ?? [];
    const classes = assetClasses.data ?? [];
    if (current.length === 0 && classes.length === 0) return;

    const base = classes.map((assetClass) => {
      const match = current.find((slice) => slice.key === assetClass.key);
      return {
        key: assetClass.key,
        label: assetClass.label,
        colorHex: assetClass.colorHex,
        currentPct: match ? Math.round(match.weightPct) : 0,
        proposedPct: match ? Math.round(match.weightPct) : 0,
      };
    });

    // Arrotondando si può perdere qualche punto: si riallinea sulla categoria maggiore.
    const total = base.reduce((sum, row) => sum + row.proposedPct, 0);
    if (total !== 100 && base.length > 0) {
      const largest = base.reduce((max, row) => (row.proposedPct > max.proposedPct ? row : max), base[0]);
      largest.proposedPct += 100 - total;
    }

    setAllocation(base);
  }, [withAllocation, allocation.length, overview.data, assetClasses.data]);

  const stepValidation = useMemo(() => {
    switch (step) {
      case 0:
        return clientId ? null : 'Seleziona il cliente destinatario.';
      case 1:
        if (title.trim().length < 3) return 'Il titolo deve avere almeno 3 caratteri.';
        if (description.trim().length < 10) return 'La descrizione deve avere almeno 10 caratteri.';
        return null;
      case 2:
        return amountValue > 0 ? null : 'Indica l\'importo della proposta.';
      case 3:
        if (items.length === 0) return 'Aggiungi almeno un\'operazione.';
        if (items.some((item) => parseAmount(item.amount) <= 0)) return 'Ogni operazione deve avere un importo.';
        if (Math.abs(itemsTotal - amountValue) > Math.max(1, amountValue * 0.01)) {
          return `La somma delle operazioni (${formatCurrency(itemsTotal, 'EUR', 0)}) deve corrispondere all'importo della proposta (${formatCurrency(amountValue, 'EUR', 0)}).`;
        }
        return null;
      case 4:
        if (!withAllocation) return null;
        if (Math.abs(allocationTotal - 100) > 0.5) {
          return `L'allocazione proposta somma ${allocationTotal.toFixed(0)}% invece di 100%.`;
        }
        return null;
      default:
        return null;
    }
  }, [step, clientId, title, description, amountValue, items, itemsTotal, withAllocation, allocationTotal]);

  const submit = async () => {
    setSubmitError(null);
    const payload: CreateProposalPayload = {
      clientId,
      title: title.trim(),
      description: description.trim(),
      rationale: rationale.trim() || undefined,
      amount: amountValue,
      expiresInDays,
      items: items.map((item) => ({
        instrumentId: item.instrumentId,
        instrumentName: item.instrumentId ? undefined : item.instrumentName,
        assetClassKey: item.instrumentId ? undefined : item.assetClassKey,
        action: item.action,
        amount: parseAmount(item.amount),
      })),
      proposedAllocation: withAllocation
        ? allocation.map((row) => ({ assetClassKey: row.key, proposedPct: row.proposedPct }))
        : undefined,
      attachDocument,
    };

    try {
      const proposal = await createProposal.mutateAsync(payload);
      setCreated(proposal);
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : 'Invio non riuscito. Riprova.');
    }
  };

  const isLastStep = step === STEPS.length - 1;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        tabBarPadding={false}
        header={
          <WizardHeader
            step={step}
            onClose={() => router.back()}
            onBack={() => setStep((value) => Math.max(0, value - 1))}
          />
        }
        footer={
          <View style={{ gap: theme.spacing.sm }}>
            {stepValidation && (
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
                <Feather name="alert-circle" size={14} color={theme.colors.warning} />
                <AppText variant="caption" style={{ color: theme.colors.warning, flex: 1 }}>
                  {stepValidation}
                </AppText>
              </View>
            )}
            {submitError && (
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
                <Feather name="alert-circle" size={14} color={theme.colors.negative} />
                <AppText variant="caption" tone="negative" style={{ flex: 1 }}>
                  {submitError}
                </AppText>
              </View>
            )}
            <Button
              label={isLastStep ? 'Invia la proposta' : 'Continua'}
              onPress={() => (isLastStep ? void submit() : setStep((value) => value + 1))}
              disabled={Boolean(stepValidation)}
              loading={createProposal.isPending}
              size="lg"
              icon={isLastStep ? 'send' : 'arrow-right'}
              iconPosition="right"
              haptic={isLastStep}
            />
          </View>
        }
      >
        {step === 0 && (
          <StepClient
            clients={clients.data?.data ?? []}
            loading={clients.isLoading}
            selectedId={clientId}
            onSelect={(id) => {
              setClientId(id);
              setAllocation([]);
            }}
          />
        )}

        {step === 1 && (
          <StepDetails
            title={title}
            description={description}
            rationale={rationale}
            onTitle={setTitle}
            onDescription={setDescription}
            onRationale={setRationale}
          />
        )}

        {step === 2 && (
          <StepAmount
            amount={amount}
            onAmount={setAmount}
            expiresInDays={expiresInDays}
            onExpiry={setExpiresInDays}
            clientValue={overview.data?.summary.totalValue}
          />
        )}

        {step === 3 && (
          <StepItems
            items={items}
            onChange={setItems}
            proposalAmount={amountValue}
            itemsTotal={itemsTotal}
          />
        )}

        {step === 4 && (
          <StepAllocation
            enabled={withAllocation}
            onToggle={setWithAllocation}
            allocation={allocation}
            onChange={setAllocation}
            total={allocationTotal}
          />
        )}

        {step === 5 && (
          <StepSummary
            clientName={selectedClient?.name ?? ''}
            title={title}
            description={description}
            rationale={rationale}
            amount={amountValue}
            expiresInDays={expiresInDays}
            items={items}
            allocation={withAllocation ? allocation : []}
            attachDocument={attachDocument}
            onToggleDocument={setAttachDocument}
          />
        )}
      </Screen>

      {/* Esito dell'invio */}
      <BottomSheet
        visible={created !== null}
        onClose={() => {
          setCreated(null);
          router.back();
        }}
        scrollable={false}
        footer={
          <View style={{ gap: theme.spacing.sm }}>
            <Button
              label="Vedi la proposta"
              onPress={() => {
                const id = created?.id;
                setCreated(null);
                router.replace(id ? `/advisor/proposal/${id}` : '/advisor/proposals');
              }}
              size="lg"
            />
            <Button
              label="Chiudi"
              onPress={() => {
                setCreated(null);
                router.back();
              }}
              variant="ghost"
            />
          </View>
        }
      >
        <View style={{ alignItems: 'center', gap: theme.spacing.base, paddingVertical: theme.spacing.lg }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.positiveSoft,
            }}
          >
            <Feather name="send" size={30} color={theme.colors.positive} />
          </View>
          <View style={{ gap: 8, alignItems: 'center' }}>
            <AppText variant="title" align="center">
              Proposta inviata
            </AppText>
            <AppText variant="body" tone="muted" align="center">
              {created?.client?.name} riceverà la proposta {created?.code} nella propria app e potrà
              accettarla o rifiutarla.
            </AppText>
          </View>
        </View>
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Intestazione con avanzamento
// ---------------------------------------------------------------------------

function WizardHeader({
  step,
  onClose,
  onBack,
}: {
  step: number;
  onClose: () => void;
  onBack: () => void;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        paddingTop: theme.spacing.base,
        paddingHorizontal: theme.spacing.base,
        paddingBottom: theme.spacing.md,
        gap: theme.spacing.md,
        backgroundColor: theme.colors.background,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        {step > 0 ? (
          <IconButton icon="chevron-left" label="Indietro" size={24} onPress={onBack} style={{ marginLeft: -12 }} />
        ) : (
          <View style={{ width: 4 }} />
        )}
        <View style={{ flex: 1, gap: 1 }}>
          <AppText variant="micro" tone="faint" uppercase>
            Passo {step + 1} di {STEPS.length}
          </AppText>
          <AppText variant="title">{STEPS[step]}</AppText>
        </View>
        <IconButton icon="x" label="Annulla" onPress={onClose} tone="muted" background />
      </View>

      {/* Avanzamento: barre invece di pallini, leggibili anche a colpo d'occhio */}
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {STEPS.map((label, index) => (
          <View
            key={label}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              backgroundColor: index <= step ? theme.colors.accent : theme.colors.surfaceSunken,
            }}
          />
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Passo 1 — cliente
// ---------------------------------------------------------------------------

function StepClient({
  clients,
  loading,
  selectedId,
  onSelect,
}: {
  clients: { id: string; name: string; clientCode: string; city: string; avatarColor: string; totalValue: number }[];
  loading: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const theme = useTheme();
  const [search, setSearch] = useState('');

  const filtered = clients.filter((client) =>
    `${client.name} ${client.clientCode} ${client.city}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  if (loading) return <ListSkeleton rows={5} />;

  return (
    <>
      <AppText variant="caption" tone="muted">
        Scegli il cliente destinatario della proposta. Vedi solo i clienti a te assegnati.
      </AppText>

      <TextField
        icon="search"
        value={search}
        onChangeText={setSearch}
        placeholder="Cerca un cliente"
        autoCapitalize="none"
      />

      {filtered.length === 0 ? (
        <EmptyState icon="users" title="Nessun cliente trovato" compact />
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          {filtered.map((client) => {
            const selected = client.id === selectedId;
            return (
              <Pressable
                key={client.id}
                onPress={() => onSelect(client.id)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                  padding: theme.spacing.base,
                  borderRadius: theme.radius.md,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? theme.colors.accent : theme.colors.border,
                  backgroundColor: theme.colors.surface,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Avatar name={client.name} color={client.avatarColor} size={40} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {client.name}
                  </AppText>
                  <AppText variant="micro" tone="faint">
                    {client.clientCode} · {client.city} · {formatCurrency(client.totalValue, 'EUR', 0)}
                  </AppText>
                </View>
                <Feather
                  name={selected ? 'check-circle' : 'circle'}
                  size={20}
                  color={selected ? theme.colors.accent : theme.colors.borderStrong}
                />
              </Pressable>
            );
          })}
        </View>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Passo 2 — testi
// ---------------------------------------------------------------------------

const TEMPLATES = [
  {
    title: 'Ribilanciamento del portafoglio',
    description:
      'Il peso della componente azionaria ha superato il profilo concordato. Proponiamo un riallineamento verso l\'allocazione obiettivo, riducendo il rischio complessivo senza rinunciare al potenziale di crescita.',
  },
  {
    title: 'Impiego della liquidità in eccesso',
    description:
      'La liquidità disponibile supera la soglia concordata. Proponiamo di destinarne una parte a strumenti monetari e a un fondo bilanciato, mantenendo il capitale prontamente disponibile.',
  },
  {
    title: 'Piano di accumulo su fondo bilanciato',
    description:
      'Attivazione di un piano di accumulo mensile su un fondo bilanciato, per costruire gradualmente la posizione riducendo l\'impatto della volatilità di ingresso.',
  },
];

function StepDetails({
  title,
  description,
  rationale,
  onTitle,
  onDescription,
  onRationale,
}: {
  title: string;
  description: string;
  rationale: string;
  onTitle: (value: string) => void;
  onDescription: (value: string) => void;
  onRationale: (value: string) => void;
}) {
  const theme = useTheme();

  return (
    <>
      <TextField
        label="Titolo della proposta"
        value={title}
        onChangeText={onTitle}
        placeholder="Es. Ribilanciamento del portafoglio"
        maxLength={120}
      />

      <TextField
        label="Descrizione per il cliente"
        value={description}
        onChangeText={onDescription}
        placeholder="Spiega in poche righe cosa proponi e perché."
        multiline
        maxLength={2000}
        hint={`${description.length}/2000 caratteri`}
      />

      <TextField
        label="Motivazione tecnica (facoltativa)"
        value={rationale}
        onChangeText={onRationale}
        placeholder="Note interne o razionale dell'operazione."
        multiline
        maxLength={2000}
      />

      {/* Modelli: fanno risparmiare digitazione durante la demo e nella pratica */}
      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="micro" tone="faint" uppercase>
          Modelli rapidi
        </AppText>
        {TEMPLATES.map((template) => (
          <Pressable
            key={template.title}
            onPress={() => {
              onTitle(template.title);
              onDescription(template.description);
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              padding: theme.spacing.md,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: pressed ? theme.colors.surfaceSunken : theme.colors.surfaceAlt,
            })}
          >
            <Feather name="file-plus" size={15} color={theme.colors.accent} />
            <AppText variant="caption" style={{ flex: 1 }} numberOfLines={1}>
              {template.title}
            </AppText>
          </Pressable>
        ))}
      </View>
    </>
  );
}

// ---------------------------------------------------------------------------
// Passo 3 — importo
// ---------------------------------------------------------------------------

function StepAmount({
  amount,
  onAmount,
  expiresInDays,
  onExpiry,
  clientValue,
}: {
  amount: string;
  onAmount: (value: string) => void;
  expiresInDays: number;
  onExpiry: (value: number) => void;
  clientValue?: number;
}) {
  const theme = useTheme();
  const value = parseAmount(amount);

  const quickAmounts = clientValue
    ? [0.05, 0.1, 0.2].map((share) => Math.round((clientValue * share) / 1000) * 1000)
    : [10000, 25000, 50000];

  return (
    <>
      <TextField
        label="Importo della proposta"
        value={amount}
        onChangeText={onAmount}
        placeholder="0"
        keyboardType="numeric"
        suffix="EUR"
        hint={value > 0 ? formatCurrency(value, 'EUR', 2) : 'Inserisci l\'importo complessivo.'}
      />

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
        {quickAmounts.map((quick) => (
          <Pressable
            key={quick}
            onPress={() => onAmount(String(quick))}
            style={({ pressed }) => ({
              paddingHorizontal: theme.spacing.base,
              height: 38,
              borderRadius: theme.radius.pill,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: pressed ? theme.colors.surfaceSunken : theme.colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <AppText variant="label" tone="muted">
              {formatCurrency(quick, 'EUR', 0)}
            </AppText>
          </Pressable>
        ))}
      </View>

      {clientValue !== undefined && value > 0 && (
        <Card variant="outlined">
          <View style={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText variant="caption" tone="muted">
                Incidenza sul patrimonio del cliente
              </AppText>
              <AppText variant="label">{formatPercent((value / clientValue) * 100, 1, false)}</AppText>
            </View>
            <ProgressBar value={(value / clientValue) * 100} />
          </View>
        </Card>
      )}

      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="label" tone="muted">
          Validità della proposta
        </AppText>
        <SegmentedControl
          options={[
            { value: '7', label: '7 giorni' },
            { value: '14', label: '14 giorni' },
            { value: '30', label: '30 giorni' },
            { value: '60', label: '60 giorni' },
          ]}
          value={String(expiresInDays)}
          onChange={(next) => onExpiry(Number(next))}
          scrollable
        />
      </View>
    </>
  );
}

// ---------------------------------------------------------------------------
// Passo 4 — operazioni
// ---------------------------------------------------------------------------

function StepItems({
  items,
  onChange,
  proposalAmount,
  itemsTotal,
}: {
  items: DraftItem[];
  onChange: (items: DraftItem[]) => void;
  proposalAmount: number;
  itemsTotal: number;
}) {
  const theme = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const catalog = useInstruments(search.trim() || undefined);

  const addInstrument = (instrument: InstrumentCatalogItem) => {
    const next: DraftItem = {
      key: `${instrument.id}-${Date.now()}`,
      instrumentId: instrument.id,
      instrumentName: instrument.name,
      assetClassKey: instrument.assetClass.key,
      colorHex: instrument.assetClass.colorHex,
      action: 'BUY',
      amount: '',
    };
    onChange([...items, next]);
    setPickerOpen(false);
    setSearch('');
  };

  /** Ripartisce l'importo della proposta in parti uguali fra le operazioni. */
  const distribute = () => {
    if (items.length === 0 || proposalAmount <= 0) return;
    const share = Math.floor(proposalAmount / items.length);
    const remainder = proposalAmount - share * items.length;
    onChange(
      items.map((item, index) => ({
        ...item,
        amount: String(index === 0 ? share + remainder : share),
      })),
    );
  };

  const difference = proposalAmount - itemsTotal;

  return (
    <>
      <AppText variant="caption" tone="muted">
        Aggiungi gli strumenti coinvolti. La somma delle operazioni deve corrispondere all&apos;importo
        della proposta.
      </AppText>

      <Button label="Aggiungi strumento" onPress={() => setPickerOpen(true)} variant="secondary" icon="plus" />

      {items.length === 0 ? (
        <EmptyState
          icon="layers"
          title="Nessuna operazione"
          message="Aggiungi almeno uno strumento dal catalogo."
          compact
        />
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          {items.map((item, index) => (
            <Card key={item.key}>
              <View style={{ gap: theme.spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  {item.colorHex && <ColorDot color={item.colorHex} size={10} />}
                  <AppText variant="bodyStrong" style={{ flex: 1 }} numberOfLines={2}>
                    {item.instrumentName}
                  </AppText>
                  <IconButton
                    icon="trash-2"
                    label="Rimuovi"
                    tone="muted"
                    size={17}
                    onPress={() => onChange(items.filter((_, position) => position !== index))}
                  />
                </View>

                <SegmentedControl
                  options={[
                    { value: 'BUY', label: 'Acquisto' },
                    { value: 'SELL', label: 'Vendita' },
                    { value: 'SWITCH', label: 'Switch' },
                  ]}
                  value={item.action}
                  onChange={(action) =>
                    onChange(
                      items.map((current, position) =>
                        position === index ? { ...current, action: action as DraftItem['action'] } : current,
                      ),
                    )
                  }
                  compact
                />

                <TextField
                  value={item.amount}
                  onChangeText={(value) =>
                    onChange(
                      items.map((current, position) =>
                        position === index ? { ...current, amount: value } : current,
                      ),
                    )
                  }
                  placeholder="0"
                  keyboardType="numeric"
                  suffix="EUR"
                />
              </View>
            </Card>
          ))}

          {/* Riepilogo degli importi con scostamento evidenziato */}
          <Card variant="outlined">
            <View style={{ gap: theme.spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <AppText variant="caption" tone="muted">
                  Totale operazioni
                </AppText>
                <AppText variant="amountSmall">{formatCurrency(itemsTotal, 'EUR', 0)}</AppText>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <AppText variant="caption" tone="muted">
                  Importo della proposta
                </AppText>
                <AppText variant="amountSmall">{formatCurrency(proposalAmount, 'EUR', 0)}</AppText>
              </View>
              {Math.abs(difference) > 0.5 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <AppText variant="caption" tone="warning">
                    Differenza
                  </AppText>
                  <AppText variant="amountSmall" tone="warning">
                    {formatCurrency(difference, 'EUR', 0)}
                  </AppText>
                </View>
              )}
              <Button label="Ripartisci in parti uguali" onPress={distribute} variant="ghost" icon="divide" />
            </View>
          </Card>
        </View>
      )}

      {/* Catalogo strumenti */}
      <BottomSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Catalogo strumenti"
        subtitle="Cerca per nome, ISIN o emittente"
      >
        <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.base }}>
          <TextField icon="search" value={search} onChangeText={setSearch} placeholder="Cerca…" autoCapitalize="none" />

          {catalog.isLoading ? (
            <ListSkeleton rows={4} />
          ) : (catalog.data ?? []).length === 0 ? (
            <EmptyState icon="search" title="Nessuno strumento trovato" compact />
          ) : (
            (catalog.data ?? []).map((instrument) => (
              <Pressable
                key={instrument.id}
                onPress={() => addInstrument(instrument)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                  paddingVertical: theme.spacing.md,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <ColorDot color={instrument.assetClass.colorHex} size={10} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {instrument.name}
                  </AppText>
                  <AppText variant="micro" tone="faint" numberOfLines={1}>
                    {instrument.assetClass.label} · {instrument.isin} · {instrument.issuer}
                  </AppText>
                </View>
                <Feather name="plus-circle" size={20} color={theme.colors.accent} />
              </Pressable>
            ))
          )}
        </View>
      </BottomSheet>
    </>
  );
}

// ---------------------------------------------------------------------------
// Passo 5 — allocazione proposta
// ---------------------------------------------------------------------------

function StepAllocation({
  enabled,
  onToggle,
  allocation,
  onChange,
  total,
}: {
  enabled: boolean;
  onToggle: (value: boolean) => void;
  allocation: DraftAllocation[];
  onChange: (value: DraftAllocation[]) => void;
  total: number;
}) {
  const theme = useTheme();

  const adjust = (key: string, delta: number) => {
    onChange(
      allocation.map((row) =>
        row.key === key ? { ...row, proposedPct: Math.max(0, Math.min(100, row.proposedPct + delta)) } : row,
      ),
    );
  };

  return (
    <>
      <Card>
        <Pressable
          onPress={() => onToggle(!enabled)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}
        >
          <View style={{ flex: 1, gap: 3 }}>
            <AppText variant="bodyStrong">Includi l&apos;asset allocation proposta</AppText>
            <AppText variant="caption" tone="muted">
              Il cliente vedrà il confronto fra la composizione attuale e quella proposta.
            </AppText>
          </View>
          <View
            style={{
              width: 52,
              height: 31,
              borderRadius: 16,
              padding: 3,
              backgroundColor: enabled ? theme.colors.positive : theme.colors.borderStrong,
              justifyContent: 'center',
              alignItems: enabled ? 'flex-end' : 'flex-start',
            }}
          >
            <View style={{ width: 25, height: 25, borderRadius: 13, backgroundColor: '#FFFFFF' }} />
          </View>
        </Pressable>
      </Card>

      {!enabled ? (
        <EmptyState
          icon="pie-chart"
          title="Passo facoltativo"
          message="Puoi inviare la proposta anche senza indicare la nuova composizione del portafoglio."
          compact
        />
      ) : allocation.length === 0 ? (
        <ListSkeleton rows={4} />
      ) : (
        <>
          <Card variant={Math.abs(total - 100) > 0.5 ? 'outlined' : 'raised'}>
            <View style={{ gap: theme.spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <AppText variant="caption" tone="muted">
                  Totale allocazione
                </AppText>
                <AppText
                  variant="amountSmall"
                  tone={Math.abs(total - 100) > 0.5 ? 'warning' : 'positive'}
                >
                  {total.toFixed(0)}%
                </AppText>
              </View>
              <ProgressBar
                value={total}
                color={Math.abs(total - 100) > 0.5 ? theme.colors.warning : theme.colors.positive}
              />
            </View>
          </Card>

          <View style={{ gap: theme.spacing.md }}>
            {allocation.map((row) => (
              <Card key={row.key}>
                <View style={{ gap: theme.spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                    <ColorDot color={row.colorHex} />
                    <AppText variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                      {row.label}
                    </AppText>
                    <Badge label={`oggi ${row.currentPct}%`} tone="neutral" />
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.base }}>
                    <IconButton
                      icon="minus"
                      label={`Riduci ${row.label}`}
                      onPress={() => adjust(row.key, -1)}
                      background
                    />
                    <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                      <AppText variant="title">{row.proposedPct}%</AppText>
                      <ProgressBar value={row.proposedPct} color={row.colorHex} />
                    </View>
                    <IconButton
                      icon="plus"
                      label={`Aumenta ${row.label}`}
                      onPress={() => adjust(row.key, 1)}
                      background
                    />
                  </View>
                </View>
              </Card>
            ))}
          </View>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Passo 6 — riepilogo
// ---------------------------------------------------------------------------

function StepSummary({
  clientName,
  title,
  description,
  rationale,
  amount,
  expiresInDays,
  items,
  allocation,
  attachDocument,
  onToggleDocument,
}: {
  clientName: string;
  title: string;
  description: string;
  rationale: string;
  amount: number;
  expiresInDays: number;
  items: DraftItem[];
  allocation: DraftAllocation[];
  attachDocument: boolean;
  onToggleDocument: (value: boolean) => void;
}) {
  const theme = useTheme();

  return (
    <>
      <Card>
        <View style={{ gap: theme.spacing.base }}>
          <AppText variant="micro" tone="faint" uppercase>
            Riepilogo
          </AppText>
          <AppText variant="title">{title}</AppText>
          <AppText variant="display">{formatCurrency(amount, 'EUR', 2)}</AppText>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
            <Badge label={clientName} tone="brand" icon="user" />
            <Badge label={`valida ${expiresInDays} giorni`} tone="neutral" icon="clock" />
            <Badge label={`${items.length} operazioni`} tone="accent" icon="layers" />
          </View>
        </View>
      </Card>

      <Card>
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="micro" tone="faint" uppercase>
            Descrizione
          </AppText>
          <AppText variant="caption" tone="muted">
            {description}
          </AppText>
          {rationale.trim().length > 0 && (
            <>
              <AppText variant="micro" tone="faint" uppercase style={{ marginTop: theme.spacing.sm }}>
                Motivazione
              </AppText>
              <AppText variant="caption" tone="muted">
                {rationale}
              </AppText>
            </>
          )}
        </View>
      </Card>

      <Card>
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="micro" tone="faint" uppercase>
            Operazioni
          </AppText>
          {items.map((item) => (
            <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              {item.colorHex && <ColorDot color={item.colorHex} size={9} />}
              <AppText variant="caption" style={{ flex: 1 }} numberOfLines={1}>
                {item.instrumentName}
              </AppText>
              <AppText variant="micro" tone="faint">
                {item.action === 'BUY' ? 'Acquisto' : item.action === 'SELL' ? 'Vendita' : 'Switch'}
              </AppText>
              <AppText variant="amountSmall">{formatCurrency(parseAmount(item.amount), 'EUR', 0)}</AppText>
            </View>
          ))}
        </View>
      </Card>

      {allocation.length > 0 && (
        <Card>
          <View style={{ gap: theme.spacing.md }}>
            <AppText variant="micro" tone="faint" uppercase>
              Asset allocation proposta
            </AppText>
            {allocation.map((row) => (
              <View key={row.key} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                <ColorDot color={row.colorHex} />
                <AppText variant="caption" style={{ flex: 1 }} numberOfLines={1}>
                  {row.label}
                </AppText>
                <AppText variant="micro" tone="faint">
                  {row.currentPct}%
                </AppText>
                <Feather name="arrow-right" size={12} color={theme.colors.textFaint} />
                <AppText variant="label">{row.proposedPct}%</AppText>
              </View>
            ))}
          </View>
        </Card>
      )}

      <Card>
        <Pressable
          onPress={() => onToggleDocument(!attachDocument)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}
        >
          <Feather name="file-text" size={20} color={theme.colors.negative} />
          <View style={{ flex: 1, gap: 3 }}>
            <AppText variant="bodyStrong">Allega la scheda proposta in PDF</AppText>
            <AppText variant="caption" tone="muted">
              Generata automaticamente e consultabile dal cliente nell&apos;app.
            </AppText>
          </View>
          <Feather
            name={attachDocument ? 'check-square' : 'square'}
            size={22}
            color={attachDocument ? theme.colors.accent : theme.colors.borderStrong}
          />
        </Pressable>
      </Card>

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
          Dopo l&apos;invio il cliente riceve la proposta nella propria app e può accettarla o
          rifiutarla. Nel prototipo l&apos;accettazione simula l&apos;esperienza utente e non
          costituisce firma elettronica qualificata.
        </AppText>
      </View>
    </>
  );
}
