import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useTheme } from '@/lib/theme-context';
import { AppText } from './AppText';

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Scorrevole quando le opzioni non entrano nella larghezza dello schermo. */
  scrollable?: boolean;
  compact?: boolean;
}

/**
 * Selettore a segmenti: è il controllo del periodo del grafico
 * (1G · 1S · 1M · 3M · 6M · 1A · Max) e dei filtri brevi.
 *
 * Ogni segmento ha un'area toccabile piena, senza margini morti: si usa con il
 * pollice mentre si scorre con l'altra mano.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  scrollable,
  compact,
}: SegmentedControlProps<T>) {
  const theme = useTheme();

  const handleChange = (next: T) => {
    if (next === value) return;
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    onChange(next);
  };

  const height = compact ? 34 : 40;

  const items = options.map((option) => {
    const selected = option.value === value;
    return (
      <Pressable
        key={option.value}
        onPress={() => handleChange(option.value)}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        accessibilityLabel={option.label}
        style={({ pressed }) => ({
          flex: scrollable ? undefined : 1,
          minWidth: scrollable ? 52 : undefined,
          height: height - 6,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.sm,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: selected ? theme.colors.surface : 'transparent',
          opacity: pressed ? 0.7 : 1,
          ...(selected ? theme.elevation(1) : {}),
        })}
      >
        <AppText
          variant="label"
          style={{ color: selected ? theme.colors.text : theme.colors.textMuted }}
          numberOfLines={1}
        >
          {option.label}
        </AppText>
      </Pressable>
    );
  });

  const containerStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 2,
    padding: 3,
    height,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceSunken,
  };

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={containerStyle}
        style={{ flexGrow: 0 }}
      >
        {items}
      </ScrollView>
    );
  }

  return <View style={containerStyle}>{items}</View>;
}
