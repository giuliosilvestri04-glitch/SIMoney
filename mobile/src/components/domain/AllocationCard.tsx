import React, { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/lib/theme-context';
import { formatCurrency, formatPercent } from '@/lib/format';
import type { AllocationSlice } from '@/api/types';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ColorDot, ProgressBar } from '@/components/ui/Rows';
import { DonutChart } from '@/components/charts/DonutChart';
import { EmptyState } from '@/components/ui/States';

interface AllocationCardProps {
  allocation: AllocationSlice[];
  currency?: string;
  title?: string;
  subtitle?: string;
  /** Solo l'elenco, senza ciambella: usato nelle schermate già dense. */
  compact?: boolean;
  totalLabel?: string;
}

/**
 * Asset allocation.
 *
 * Le categorie NON sono fisse nel codice: etichette, ordine e colori arrivano
 * dal backend (`/meta/asset-classes` e i DTO di allocazione). Aggiungerne una
 * non richiede modifiche all'app.
 */
export function AllocationCard({
  allocation,
  currency = 'EUR',
  title = 'Asset allocation',
  subtitle,
  compact,
  totalLabel = 'Totale',
}: AllocationCardProps) {
  const theme = useTheme();
  const [highlighted, setHighlighted] = useState<string | null>(null);

  if (allocation.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="pie-chart"
          title="Nessuna allocazione disponibile"
          message="Non ci sono dati di composizione per questo periodo."
          compact
        />
      </Card>
    );
  }

  const rows = [...allocation].sort((a, b) => b.weightPct - a.weightPct);

  return (
    <Card>
      <View style={{ gap: theme.spacing.base }}>
        <View style={{ gap: 2 }}>
          <AppText variant="micro" tone="faint" uppercase>
            {title}
          </AppText>
          {subtitle && (
            <AppText variant="caption" tone="muted">
              {subtitle}
            </AppText>
          )}
        </View>

        {!compact && (
          <View style={{ alignItems: 'center', paddingVertical: theme.spacing.xs }}>
            <DonutChart
              slices={allocation}
              currency={currency}
              centerLabel={totalLabel}
              onSelect={(slice) => setHighlighted(slice?.key ?? null)}
            />
          </View>
        )}

        <View style={{ gap: theme.spacing.md }}>
          {rows.map((slice) => {
            const dimmed = highlighted !== null && highlighted !== slice.key;
            return (
              <View key={slice.key} style={{ gap: 6, opacity: dimmed ? 0.45 : 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  <ColorDot color={slice.colorHex} />
                  <AppText variant="caption" style={{ flex: 1 }} numberOfLines={1}>
                    {slice.label}
                  </AppText>
                  <AppText variant="label">{formatPercent(slice.weightPct, 1, false)}</AppText>
                  <AppText variant="caption" tone="muted" style={{ minWidth: 92, textAlign: 'right' }}>
                    {formatCurrency(slice.value, currency, 0)}
                  </AppText>
                </View>
                <ProgressBar value={slice.weightPct} color={slice.colorHex} height={5} />
              </View>
            );
          })}
        </View>
      </View>
    </Card>
  );
}
