import React, { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/lib/theme-context';
import { formatCurrency } from '@/lib/format';
import type { HistoryRange, PortfolioHistory } from '@/api/types';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Delta } from '@/components/ui/Delta';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { LineChart, type ChartPoint } from '@/components/charts/LineChart';

/** Periodi offerti dal selettore. Etichette brevi: devono stare in una riga. */
export const RANGE_OPTIONS: { value: HistoryRange; label: string }[] = [
  { value: '1D', label: '1G' },
  { value: '1W', label: '1S' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1A' },
  { value: 'MAX', label: 'Max' },
];

interface PortfolioChartProps {
  history?: PortfolioHistory;
  range: HistoryRange;
  onRangeChange: (range: HistoryRange) => void;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  title?: string;
  /** Mostra il valore del periodo in alto (quando non c'è già un'intestazione). */
  showHeaderValue?: boolean;
}

/**
 * Card "evoluzione del patrimonio".
 *
 * Riusata identica nelle tre aree — cliente, dettaglio cliente del consulente,
 * patrimonio aziendale della direzione — perché il gesto di lettura dev'essere
 * lo stesso ovunque.
 */
export function PortfolioChart({
  history,
  range,
  onRangeChange,
  loading,
  error,
  onRetry,
  title = 'Andamento',
  showHeaderValue = false,
}: PortfolioChartProps) {
  const theme = useTheme();
  const [scrubbed, setScrubbed] = useState<ChartPoint | null>(null);

  return (
    <Card>
      <View style={{ gap: theme.spacing.base }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <AppText variant="micro" tone="faint" uppercase>
            {title}
          </AppText>
          {history && !scrubbed && (
            <Delta percent={history.change.percent} absolute={history.change.absolute} variant="label" />
          )}
        </View>

        {showHeaderValue && history && (
          <AppText variant="display">
            {formatCurrency(
              scrubbed?.totalValue ?? history.points[history.points.length - 1]?.totalValue ?? 0,
              history.currency,
              0,
            )}
          </AppText>
        )}

        {error ? (
          <ErrorState error={error} onRetry={onRetry} compact />
        ) : loading && !history ? (
          <View style={{ gap: theme.spacing.md }}>
            <Skeleton height={28} width="40%" />
            <Skeleton height={180} radius={theme.radius.md} />
          </View>
        ) : history && history.points.length > 1 ? (
          <LineChart
            points={history.points}
            currency={history.currency}
            onScrub={setScrubbed}
            height={180}
          />
        ) : (
          <View style={{ height: 180, alignItems: 'center', justifyContent: 'center' }}>
            <AppText variant="caption" tone="faint">
              Dati insufficienti per questo periodo
            </AppText>
          </View>
        )}

        <SegmentedControl
          options={RANGE_OPTIONS}
          value={range}
          onChange={onRangeChange}
          scrollable
          compact
        />

        {history && history.points.length > 1 && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText variant="micro" tone="faint">
              MIN {formatCurrency(history.min, history.currency, 0)}
            </AppText>
            <AppText variant="micro" tone="faint">
              MAX {formatCurrency(history.max, history.currency, 0)}
            </AppText>
          </View>
        )}
      </View>
    </Card>
  );
}
