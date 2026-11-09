import React from 'react';
import { ActivityIndicator, Pressable, View, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useTheme } from '@/lib/theme-context';
import { HIT_SIZE } from '@/lib/theme';
import { AppText } from './AppText';

type Variant = 'primary' | 'secondary' | 'ghost' | 'positive' | 'destructive';
type Size = 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Feather.glyphMap;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Riscontro tattile: riservato alle azioni che confermano qualcosa. */
  haptic?: boolean;
  style?: ViewStyle;
}

/**
 * Pulsante dell'app.
 * Altezza minima 48/56 px: aree toccabili ampie, raggiungibili con il pollice.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading,
  disabled,
  fullWidth = true,
  haptic,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const palette: Record<Variant, { background: string; text: string; border?: string }> = {
    primary: { background: theme.colors.brand, text: theme.colors.onBrand },
    secondary: {
      background: theme.dark ? theme.colors.surfaceAlt : theme.colors.brandSoft,
      text: theme.dark ? theme.colors.text : theme.colors.brand,
      border: theme.dark ? theme.colors.border : 'transparent',
    },
    ghost: { background: 'transparent', text: theme.colors.accent },
    positive: { background: theme.colors.positive, text: '#FFFFFF' },
    destructive: {
      background: theme.dark ? theme.colors.negativeSoft : theme.colors.negativeSoft,
      text: theme.colors.negative,
    },
  };

  const colors = palette[variant];
  const height = size === 'lg' ? 56 : Math.max(HIT_SIZE + 4, 48);

  const handlePress = () => {
    if (isDisabled) return;
    if (haptic && Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(isDisabled), busy: Boolean(loading) }}
      android_ripple={variant === 'ghost' ? undefined : { color: 'rgba(255,255,255,0.18)' }}
      style={({ pressed }) => [
        {
          height,
          borderRadius: theme.radius.md,
          backgroundColor: colors.background,
          borderWidth: colors.border ? 1 : 0,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: isDisabled ? 0.55 : pressed ? 0.9 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} size="small" />
      ) : (
        <>
          {icon && iconPosition === 'left' && <Feather name={icon} size={18} color={colors.text} />}
          <AppText
            variant={size === 'lg' ? 'headline' : 'bodyStrong'}
            style={{ color: colors.text }}
            numberOfLines={1}
          >
            {label}
          </AppText>
          {icon && iconPosition === 'right' && <Feather name={icon} size={18} color={colors.text} />}
        </>
      )}
    </Pressable>
  );
}

interface IconButtonProps {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  label: string;
  tone?: 'default' | 'muted' | 'accent' | 'onBrand';
  size?: number;
  background?: boolean;
  style?: ViewStyle;
}

export function IconButton({
  icon,
  onPress,
  label,
  tone = 'default',
  size = 20,
  background,
  style,
}: IconButtonProps) {
  const theme = useTheme();

  const color =
    tone === 'muted'
      ? theme.colors.textMuted
      : tone === 'accent'
        ? theme.colors.accent
        : tone === 'onBrand'
          ? theme.colors.onBrand
          : theme.colors.text;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      style={({ pressed }) => [
        {
          width: HIT_SIZE,
          height: HIT_SIZE,
          borderRadius: theme.radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: background ? theme.colors.surfaceSunken : 'transparent',
          opacity: pressed ? 0.6 : 1,
        },
        style,
      ]}
    >
      <Feather name={icon} size={size} color={color} />
    </Pressable>
  );
}

/** Riga di pulsanti affiancati, usata nelle azioni su una proposta. */
export function ButtonRow({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>{children}</View>;
}
