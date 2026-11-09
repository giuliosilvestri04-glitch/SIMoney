import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme-context';
import { formatPercent, formatSignedCurrency } from '@/lib/format';
import { AppText, type TextVariant } from './AppText';

interface DeltaProps {
  percent: number;
  absolute?: number;
  currency?: string;
  variant?: TextVariant;
  /** Etichetta del periodo, es. "ultimo mese". */
  caption?: string;
  /** Sfondo colorato: usato sull'intestazione del patrimonio. */
  filled?: boolean;
  onBrand?: boolean;
  style?: ViewStyle;
}

/**
 * Indicatore di variazione.
 *
 * Il segno è veicolato da TRE elementi insieme — freccia, segno numerico e
 * colore — così l'informazione resta leggibile anche a chi non distingue
 * bene rosso e verde.
 */
export function Delta({
  percent,
  absolute,
  currency = 'EUR',
  variant = 'bodyStrong',
  caption,
  filled,
  onBrand,
  style,
}: DeltaProps) {
  const theme = useTheme();
  const positive = percent > 0;
  const flat = percent === 0;

  const color = onBrand
    ? flat
      ? 'rgba(255,255,255,0.75)'
      : positive
        ? '#7BE0B0'
        : '#FF9C8F'
    : flat
      ? theme.colors.textMuted
      : positive
        ? theme.colors.positive
        : theme.colors.negative;

  const background = filled
    ? onBrand
      ? 'rgba(255,255,255,0.14)'
      : flat
        ? theme.colors.neutralSoft
        : positive
          ? theme.colors.positiveSoft
          : theme.colors.negativeSoft
    : 'transparent';

  const iconSize = variant === 'caption' || variant === 'micro' ? 12 : 15;

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          alignSelf: 'flex-start',
          backgroundColor: background,
          paddingHorizontal: filled ? 9 : 0,
          paddingVertical: filled ? 5 : 0,
          borderRadius: theme.radius.sm,
        },
        style,
      ]}
    >
      {!flat && (
        <Feather name={positive ? 'trending-up' : 'trending-down'} size={iconSize} color={color} />
      )}
      <AppText variant={variant} style={{ color }}>
        {formatPercent(percent)}
      </AppText>
      {absolute !== undefined && (
        <AppText variant="caption" style={{ color, opacity: 0.85 }}>
          ({formatSignedCurrency(absolute, currency, 0)})
        </AppText>
      )}
      {caption && (
        <AppText variant="caption" style={{ color: onBrand ? 'rgba(255,255,255,0.7)' : theme.colors.textFaint }}>
          {caption}
        </AppText>
      )}
    </View>
  );
}
