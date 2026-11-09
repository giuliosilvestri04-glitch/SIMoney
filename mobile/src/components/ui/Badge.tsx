import React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme-context';
import { AppText } from './AppText';
import type { ProposalStatus } from '@/api/types';

export type BadgeTone = 'neutral' | 'accent' | 'positive' | 'negative' | 'warning' | 'brand';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  icon?: keyof typeof Feather.glyphMap;
  /** Pallino colorato al posto dell'icona: più discreto nelle liste. */
  dot?: boolean;
  style?: ViewStyle;
}

export function Badge({ label, tone = 'neutral', icon, dot, style }: BadgeProps) {
  const theme = useTheme();

  const palette: Record<BadgeTone, { background: string; text: string }> = {
    neutral: { background: theme.colors.neutralSoft, text: theme.colors.textMuted },
    accent: { background: theme.colors.accentSoft, text: theme.colors.accent },
    positive: { background: theme.colors.positiveSoft, text: theme.colors.positive },
    negative: { background: theme.colors.negativeSoft, text: theme.colors.negative },
    warning: { background: theme.colors.warningSoft, text: theme.colors.warning },
    brand: { background: theme.colors.brandSoft, text: theme.dark ? theme.colors.text : theme.colors.brand },
  };

  const colors = palette[tone];

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          alignSelf: 'flex-start',
          paddingHorizontal: 9,
          paddingVertical: 4,
          borderRadius: theme.radius.sm,
          backgroundColor: colors.background,
        },
        style,
      ]}
    >
      {dot && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.text }} />}
      {icon && !dot && <Feather name={icon} size={11} color={colors.text} />}
      <AppText variant="micro" style={{ color: colors.text }}>
        {label}
      </AppText>
    </View>
  );
}

const STATUS_TONE: Record<ProposalStatus, BadgeTone> = {
  PENDING: 'warning',
  ACCEPTED: 'positive',
  REJECTED: 'negative',
  EXPIRED: 'neutral',
};

/**
 * Stato di una proposta.
 * Il colore è l'unico elemento cromatico forte della lista: lo stato deve
 * essere comprensibile in un istante, senza rendere l'interfaccia variopinta.
 */
export function StatusBadge({ status, label }: { status: ProposalStatus; label?: string }) {
  const fallback: Record<ProposalStatus, string> = {
    PENDING: 'In attesa',
    ACCEPTED: 'Accettata',
    REJECTED: 'Rifiutata',
    EXPIRED: 'Scaduta',
  };
  return <Badge label={label ?? fallback[status]} tone={STATUS_TONE[status]} dot />;
}

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  count?: number;
}

/** Filtro rapido a pillola, usato sopra le liste. */
export function Chip({ label, selected, onPress, count }: ChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: theme.spacing.md,
        height: 36,
        borderRadius: theme.radius.pill,
        backgroundColor: selected ? theme.colors.brand : theme.colors.surface,
        borderWidth: 1,
        borderColor: selected ? theme.colors.brand : theme.colors.border,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <AppText variant="label" style={{ color: selected ? theme.colors.onBrand : theme.colors.textMuted }}>
        {label}
      </AppText>
      {count !== undefined && count > 0 && (
        <AppText
          variant="micro"
          style={{ color: selected ? theme.colors.onBrand : theme.colors.textFaint }}
        >
          {count}
        </AppText>
      )}
    </Pressable>
  );
}

/** Etichetta piccola e discreta per marcare il prototipo. */
export function PrototypeTag() {
  const theme = useTheme();
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: theme.radius.sm,
        borderWidth: 1,
        borderColor: theme.dark ? theme.colors.border : 'rgba(255,255,255,0.35)',
      }}
    >
      <AppText variant="micro" style={{ color: theme.colors.onBrand, opacity: 0.9 }}>
        PROTOTIPO
      </AppText>
    </View>
  );
}
