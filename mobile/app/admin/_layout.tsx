import React from 'react';
import { Stack } from 'expo-router/stack';
import { useTheme } from '@/lib/theme-context';

/** AREA DIREZIONE (boss). */
export default function AdminLayout() {
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
      <Stack.Screen name="proposals" />
      <Stack.Screen name="audit" />
    </Stack>
  );
}
