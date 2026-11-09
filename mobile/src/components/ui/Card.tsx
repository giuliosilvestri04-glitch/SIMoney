import React from 'react';
import { Pressable, View, type ViewProps, type ViewStyle } from 'react-native';
import { useTheme } from '@/lib/theme-context';
import { AppText } from './AppText';

interface CardProps extends ViewProps {
  /** `flat` elimina l'ombra: utile per le card dentro liste lunghe. */
  variant?: 'raised' | 'flat' | 'outlined';
  padded?: boolean;
  onPress?: () => void;
}

/**
 * Contenitore base dell'interfaccia.
 * La UI mobile è costruita a card: ogni blocco informativo ha un solo bordo,
 * un solo raggio e una sola ombra, definiti qui.
 */
export function Card({ variant = 'raised', padded = true, style, onPress, children, ...props }: CardProps) {
  const theme = useTheme();

  const base: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: padded ? theme.spacing.base : 0,
    borderWidth: variant === 'outlined' ? 1 : theme.dark ? 1 : 0,
    borderColor: theme.colors.border,
    ...(variant === 'raised' ? theme.elevation(1) : {}),
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        android_ripple={{ color: theme.colors.surfaceSunken }}
        style={({ pressed }) => [base, pressed && { opacity: 0.85 }, style]}
        {...props}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[base, style]} {...props}>
      {children}
    </View>
  );
}

interface SectionProps {
  title?: string;
  action?: { label: string; onPress: () => void };
  children: React.ReactNode;
  style?: ViewStyle;
}

/** Blocco con intestazione e, facoltativamente, un'azione testuale a destra. */
export function Section({ title, action, children, style }: SectionProps) {
  const theme = useTheme();

  return (
    <View style={[{ gap: theme.spacing.md }, style]}>
      {(title || action) && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: theme.spacing.xs,
          }}
        >
          {title ? (
            <AppText variant="micro" tone="faint" uppercase>
              {title}
            </AppText>
          ) : (
            <View />
          )}
          {action && (
            <Pressable onPress={action.onPress} hitSlop={12}>
              <AppText variant="label" tone="accent">
                {action.label}
              </AppText>
            </Pressable>
          )}
        </View>
      )}
      {children}
    </View>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const theme = useTheme();
  return (
    <View
      style={{
        height: 1,
        backgroundColor: theme.colors.border,
        marginLeft: inset,
      }}
    />
  );
}
