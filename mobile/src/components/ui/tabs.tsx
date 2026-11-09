import React from 'react';
import { Platform, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme-context';

/**
 * Aspetto della barra di navigazione inferiore, condiviso dalle tre aree.
 *
 * La navigazione principale è in basso: è la zona raggiungibile con il pollice
 * mentre si tiene il telefono con una mano. Cliente, consulente e direzione
 * hanno voci diverse ma lo stesso comportamento.
 */
export function useTabScreenOptions() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return {
    headerShown: false,
    tabBarActiveTintColor: theme.dark ? theme.colors.accent : theme.colors.brand,
    tabBarInactiveTintColor: theme.colors.textFaint,
    tabBarStyle: {
      backgroundColor: theme.colors.surface,
      borderTopColor: theme.colors.border,
      borderTopWidth: 1,
      height: 58 + insets.bottom,
      paddingBottom: insets.bottom > 0 ? insets.bottom - 4 : 8,
      paddingTop: 8,
      elevation: 0,
    },
    tabBarLabelStyle: {
      fontSize: 11,
      fontWeight: '600' as const,
      marginTop: 2,
    },
    tabBarItemStyle: { paddingVertical: 2 },
    tabBarHideOnKeyboard: Platform.OS === 'android',
    tabBarBadgeStyle: {
      backgroundColor: theme.colors.negative,
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '700' as const,
      minWidth: 18,
      lineHeight: 14,
    },
  };
}

/** Icona di una voce della barra inferiore. */
export function tabIcon(name: keyof typeof Feather.glyphMap) {
  const Icon = ({ color, size }: { focused: boolean; color: ColorValue; size: number }) => (
    <Feather name={name} size={size - 2} color={color as string} />
  );
  Icon.displayName = `TabIcon(${name})`;
  return Icon;
}
