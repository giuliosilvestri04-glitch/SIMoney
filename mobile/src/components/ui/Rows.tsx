import React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme-context';
import { AppText } from './AppText';

/**
 * Righe di dati.
 * Sostituiscono le tabelle: su smartphone una tabella a più colonne è
 * illeggibile, una riga etichetta/valore no.
 */

interface DataRowProps {
  label: string;
  value: string;
  /** Secondo valore allineato a destra, sotto al principale. */
  hint?: string;
  tone?: 'default' | 'positive' | 'negative' | 'muted';
  icon?: keyof typeof Feather.glyphMap;
  onPress?: () => void;
}

export function DataRow({ label, value, hint, tone = 'default', icon, onPress }: DataRowProps) {
  const theme = useTheme();

  const valueTone = tone === 'muted' ? 'muted' : tone === 'default' ? 'default' : tone;

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.base,
        minHeight: 44,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flex: 1 }}>
        {icon && <Feather name={icon} size={15} color={theme.colors.textFaint} />}
        <AppText variant="caption" tone="muted" numberOfLines={2} style={{ flex: 1 }}>
          {label}
        </AppText>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <AppText variant="amountSmall" tone={valueTone}>
          {value}
        </AppText>
        {hint && (
          <AppText variant="micro" tone="faint">
            {hint}
          </AppText>
        )}
      </View>
      {onPress && <Feather name="chevron-right" size={18} color={theme.colors.textFaint} />}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      {content}
    </Pressable>
  );
}

interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Elemento a sinistra: avatar, pallino di categoria, icona. */
  leading?: React.ReactNode;
  value?: string;
  valueHint?: React.ReactNode;
  badge?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  style?: ViewStyle;
}

/** Riga di elenco (clienti, investimenti, documenti, movimenti). */
export function ListRow({
  title,
  subtitle,
  leading,
  value,
  valueHint,
  badge,
  onPress,
  chevron = true,
  style,
}: ListRowProps) {
  const theme = useTheme();

  const content = (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          minHeight: 56,
        },
        style,
      ]}
    >
      {leading}
      <View style={{ flex: 1, gap: 3 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle && (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </AppText>
        )}
        {badge}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 3 }}>
        {value && <AppText variant="amountSmall">{value}</AppText>}
        {valueHint}
      </View>
      {onPress && chevron && <Feather name="chevron-right" size={18} color={theme.colors.textFaint} />}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      android_ripple={{ color: theme.colors.surfaceSunken }}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {content}
    </Pressable>
  );
}

/** Pallino colorato che identifica una asset class. */
export function ColorDot({ color, size = 10 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

interface ProgressBarProps {
  value: number;
  color?: string;
  height?: number;
  background?: string;
}

/** Barra di riempimento: peso di una asset class, quota di un consulente. */
export function ProgressBar({ value, color, height = 6, background }: ProgressBarProps) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <View
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: background ?? theme.colors.surfaceSunken,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${clamped}%`,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: color ?? theme.colors.accent,
        }}
      />
    </View>
  );
}

interface KpiTileProps {
  label: string;
  value: string;
  hint?: React.ReactNode;
  icon?: keyof typeof Feather.glyphMap;
  onPress?: () => void;
}

/**
 * Riquadro indicatore per le dashboard.
 * Due per riga: su smartphone tre sarebbero illeggibili.
 */
export function KpiTile({ label, value, hint, icon, onPress }: KpiTileProps) {
  const theme = useTheme();

  const content = (
    <View
      style={{
        flex: 1,
        minWidth: 140,
        gap: 6,
        padding: theme.spacing.base,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surface,
        borderWidth: theme.dark ? 1 : 0,
        borderColor: theme.colors.border,
        ...theme.elevation(1),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon && <Feather name={icon} size={13} color={theme.colors.textFaint} />}
        <AppText variant="micro" tone="faint" uppercase numberOfLines={1}>
          {label}
        </AppText>
      </View>
      <AppText variant="amount" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
        {value}
      </AppText>
      {hint}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.8 : 1 })}>
      {content}
    </Pressable>
  );
}

/** Griglia a due colonne per i riquadri indicatore. */
export function KpiGrid({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>{children}</View>
  );
}
