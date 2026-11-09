import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme-context';
import { formatCurrency, formatDateLong, formatPercent } from '@/lib/format';
import type { PortfolioSnapshot } from '@/api/types';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Delta } from '@/components/ui/Delta';
import { ColorDot } from '@/components/ui/Rows';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { DatePickerSheet } from './DatePickerSheet';

interface HistoricalSnapshotProps {
  date: string | null;
  onDateChange: (date: string) => void;
  snapshot?: PortfolioSnapshot;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  minDate?: string;
  maxDate?: string;
  title?: string;
}

/**
 * "Patrimonio a una data".
 *
 * Requisito 11: scegliendo un giorno sul calendario cambiano il totale E la
 * composizione. I dati provengono dallo storico reale simulato del backend,
 * non da valori fissi.
 */
export function HistoricalSnapshot({
  date,
  onDateChange,
  snapshot,
  loading,
  error,
  onRetry,
  minDate,
  maxDate,
  title = 'Patrimonio a una data',
}: HistoricalSnapshotProps) {
  const theme = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <Card>
        <View style={{ gap: theme.spacing.base }}>
          <View style={{ gap: 2 }}>
            <AppText variant="micro" tone="faint" uppercase>
              {title}
            </AppText>
            <AppText variant="caption" tone="muted">
              Scegli un giorno per vedere il patrimonio e la sua composizione a quella data.
            </AppText>
          </View>

          {/* Attivatore del calendario: area toccabile ampia, stile campo. */}
          <Pressable
            onPress={() => setPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Scegli una data"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
              height: 52,
              paddingHorizontal: theme.spacing.base,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surfaceAlt,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Feather name="calendar" size={18} color={theme.colors.accent} />
            <AppText variant="bodyStrong" style={{ flex: 1 }}>
              {date ? formatDateLong(date) : 'Seleziona una data'}
            </AppText>
            <Feather name="chevron-down" size={18} color={theme.colors.textFaint} />
          </Pressable>

          {error ? (
            <ErrorState error={error} onRetry={onRetry} compact />
          ) : loading ? (
            <View style={{ gap: theme.spacing.md }}>
              <Skeleton height={34} width="60%" />
              <Skeleton height={14} width="40%" />
              <Skeleton height={80} />
            </View>
          ) : snapshot ? (
            <View style={{ gap: theme.spacing.base }}>
              <View style={{ gap: 6 }}>
                <AppText variant="display">
                  {formatCurrency(snapshot.totalValue, snapshot.currency, 2)}
                </AppText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                  {snapshot.changeFromPreviousDay && (
                    <Delta
                      percent={snapshot.changeFromPreviousDay.percent}
                      absolute={snapshot.changeFromPreviousDay.absolute}
                      variant="label"
                      caption="sul giorno prima"
                    />
                  )}
                </View>
              </View>

              {snapshot.approximated && (
                <View
                  style={{
                    flexDirection: 'row',
                    gap: theme.spacing.sm,
                    padding: theme.spacing.md,
                    borderRadius: theme.radius.sm,
                    backgroundColor: theme.colors.warningSoft,
                  }}
                >
                  <Feather name="info" size={14} color={theme.colors.warning} />
                  <AppText variant="caption" style={{ color: theme.colors.warning, flex: 1 }}>
                    Nessuna rilevazione in questa data: mostrati i valori dell&apos;ultimo giorno disponibile
                    ({formatDateLong(snapshot.date)}).
                  </AppText>
                </View>
              )}

              <View style={{ gap: theme.spacing.md }}>
                {snapshot.allocation.map((slice) => (
                  <View
                    key={slice.key}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}
                  >
                    <ColorDot color={slice.colorHex} />
                    <AppText variant="caption" style={{ flex: 1 }} numberOfLines={1}>
                      {slice.label}
                    </AppText>
                    <AppText variant="micro" tone="faint" style={{ minWidth: 44, textAlign: 'right' }}>
                      {formatPercent(slice.weightPct, 1, false)}
                    </AppText>
                    <AppText variant="amountSmall" style={{ minWidth: 104, textAlign: 'right' }}>
                      {formatCurrency(slice.value, snapshot.currency, 0)}
                    </AppText>
                  </View>
                ))}
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
                <AppText variant="caption" tone="muted">
                  Investito {formatCurrency(snapshot.investedValue, snapshot.currency, 0)}
                </AppText>
                <AppText variant="caption" tone="muted">
                  Liquidità {formatCurrency(snapshot.cashValue, snapshot.currency, 0)}
                </AppText>
              </View>
            </View>
          ) : null}
        </View>
      </Card>

      <DatePickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={onDateChange}
        value={date}
        minDate={minDate}
        maxDate={maxDate}
      />
    </>
  );
}
