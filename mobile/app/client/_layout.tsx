import React from 'react';
import { Stack } from 'expo-router/stack';
import { useTheme } from '@/lib/theme-context';

/**
 * AREA CLIENTE.
 *
 * Le schermate di dettaglio (investimento, proposta, movimenti) si aprono
 * SOPRA la barra inferiore: è il comportamento atteso su mobile quando si
 * scende in profondità, e lascia più spazio ai contenuti.
 */
export default function ClientLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="proposal/[id]" />
      <Stack.Screen name="investment/[id]" />
      <Stack.Screen name="investments" />
      <Stack.Screen name="transactions" />
    </Stack>
  );
}
