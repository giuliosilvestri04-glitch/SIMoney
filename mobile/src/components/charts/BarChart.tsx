import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/lib/theme-context';
import { AppText } from '@/components/ui/AppText';

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  /** Valore secondario impilato sotto (es. accettate su create). */
  secondary?: number;
  color?: string;
  secondaryColor?: string;
  /** Testo mostrato quando la barra è selezionata. */
  detail?: string;
}

interface BarChartProps {
  data: BarDatum[];
  height?: number;
  formatValue?: (value: number) => string;
}

/**
 * Istogramma compatto.
 *
 * Costruito con semplici `View`: per poche barre l'SVG non serve, e il
 * rendering nativo è più leggero. Toccando una barra compare il dettaglio,
 * così non servono etichette su ogni colonna (che a questa larghezza
 * sarebbero illeggibili).
 */
export function BarChart({ data, height = 130, formatValue }: BarChartProps) {
  const theme = useTheme();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const max = Math.max(1, ...data.map((item) => item.value));
  const selected = data.find((item) => item.key === selectedKey) ?? null;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ height: 18, justifyContent: 'center' }}>
        {selected ? (
          <AppText variant="caption" numberOfLines={1}>
            <AppText variant="caption" tone="muted">
              {selected.label}:{' '}
            </AppText>
            {selected.detail ?? (formatValue ? formatValue(selected.value) : String(selected.value))}
          </AppText>
        ) : (
          <AppText variant="micro" tone="faint" uppercase>
            Tocca una barra per il dettaglio
          </AppText>
        )}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height }}>
        {data.map((item) => {
          const isSelected = item.key === selectedKey;
          const barHeight = Math.max(3, (item.value / max) * (height - 22));
          const secondaryHeight = item.secondary
            ? Math.max(2, (item.secondary / max) * (height - 22))
            : 0;

          return (
            <Pressable
              key={item.key}
              onPress={() => setSelectedKey(isSelected ? null : item.key)}
              style={{ flex: 1, alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}: ${item.value}`}
            >
              <View
                style={{
                  width: '100%',
                  height: barHeight,
                  borderRadius: 5,
                  overflow: 'hidden',
                  backgroundColor: item.color ?? theme.colors.accent,
                  opacity: selectedKey && !isSelected ? 0.35 : 1,
                  justifyContent: 'flex-end',
                }}
              >
                {secondaryHeight > 0 && (
                  <View
                    style={{
                      height: Math.min(secondaryHeight, barHeight),
                      backgroundColor: item.secondaryColor ?? theme.colors.positive,
                    }}
                  />
                )}
              </View>
              <AppText variant="micro" tone={isSelected ? 'default' : 'faint'} numberOfLines={1}>
                {item.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

interface HorizontalBarsProps {
  data: { key: string; label: string; value: number; display: string; color?: string }[];
  onPress?: (key: string) => void;
}

/**
 * Barre orizzontali: confronto fra consulenti o categorie.
 * Su smartphone è la forma più leggibile per un ranking, perché le etichette
 * restano orizzontali e lunghe quanto serve.
 */
export function HorizontalBars({ data, onPress }: HorizontalBarsProps) {
  const theme = useTheme();
  const max = Math.max(1, ...data.map((item) => item.value));

  return (
    <View style={{ gap: theme.spacing.md }}>
      {data.map((item) => {
        const row = (
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm }}>
              <AppText variant="caption" numberOfLines={1} style={{ flex: 1 }}>
                {item.label}
              </AppText>
              <AppText variant="label" numberOfLines={1}>
                {item.display}
              </AppText>
            </View>
            <View
              style={{
                height: 8,
                borderRadius: 4,
                backgroundColor: theme.colors.surfaceSunken,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${Math.max(2, (item.value / max) * 100)}%`,
                  height: '100%',
                  borderRadius: 4,
                  backgroundColor: item.color ?? theme.colors.accent,
                }}
              />
            </View>
          </View>
        );

        if (!onPress) return <View key={item.key}>{row}</View>;
        return (
          <Pressable
            key={item.key}
            onPress={() => onPress(item.key)}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            {row}
          </Pressable>
        );
      })}
    </View>
  );
}
