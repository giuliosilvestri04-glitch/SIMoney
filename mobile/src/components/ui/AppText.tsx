import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '@/lib/theme-context';
import type { typography } from '@/lib/theme';

export type TextVariant = keyof typeof typography;
export type TextTone =
  | 'default'
  | 'muted'
  | 'faint'
  | 'accent'
  | 'positive'
  | 'negative'
  | 'warning'
  | 'onBrand';

interface AppTextProps extends TextProps {
  variant?: TextVariant;
  tone?: TextTone;
  /** Maiuscoletto spaziato per le etichette di sezione. */
  uppercase?: boolean;
  align?: TextStyle['textAlign'];
}

/**
 * Unico componente testuale dell'app.
 * Impedisce che dimensioni, pesi e colori si moltiplichino schermata per
 * schermata: la gerarchia tipografica resta coerente ovunque.
 */
export function AppText({
  variant = 'body',
  tone = 'default',
  uppercase,
  align,
  style,
  ...props
}: AppTextProps) {
  const theme = useTheme();

  const toneColor: Record<TextTone, string> = {
    default: theme.colors.text,
    muted: theme.colors.textMuted,
    faint: theme.colors.textFaint,
    accent: theme.colors.accent,
    positive: theme.colors.positive,
    negative: theme.colors.negative,
    warning: theme.colors.warning,
    onBrand: theme.colors.onBrand,
  };

  return (
    <Text
      {...props}
      // Limita l'ingrandimento dei font di sistema: protegge i layout densi
      // senza impedire l'accessibilità.
      maxFontSizeMultiplier={props.maxFontSizeMultiplier ?? 1.35}
      style={[
        theme.typography[variant],
        { color: toneColor[tone] },
        uppercase && { textTransform: 'uppercase', letterSpacing: 0.6 },
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
