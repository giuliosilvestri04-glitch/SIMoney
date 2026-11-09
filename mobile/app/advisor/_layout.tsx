import React from 'react';
import { Stack } from 'expo-router/stack';
import { useTheme } from '@/lib/theme-context';

/**
 * AREA CONSULENTE.
 * La creazione di una proposta si apre come schermata modale a tutta altezza:
 * è un flusso guidato che merita un contesto isolato, da cui si esce solo
 * inviando o annullando.
 */
export default function AdvisorLayout() {
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
      <Stack.Screen name="client/[id]" />
      <Stack.Screen name="proposal/[id]" />
      <Stack.Screen
        name="new-proposal"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
    </Stack>
  );
}
