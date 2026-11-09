import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { onlineManager } from '@tanstack/react-query';
import { Stack } from 'expo-router/stack';
import { useRouter, useSegments, SplashScreen } from 'expo-router';
import { AuthProvider, homeRouteForRole, ROLE_SEGMENT, useAuth } from '@/lib/auth';
import { bindAppStateToQueries, createQueryClient } from '@/lib/query-client';
import { ThemeProvider, useTheme } from '@/lib/theme-context';
import { OfflineBanner } from '@/components/ui/States';

/**
 * Radice dell'applicazione.
 *
 * Ordine dei provider (dal più esterno):
 *   gesti → safe area → cache dati → tema → autenticazione → navigazione.
 * `AuthProvider` sta dentro `QueryClientProvider` perché al login/logout
 * svuota la cache dei dati del ruolo precedente.
 */

// La schermata di avvio resta finché non sappiamo se l'utente è già autenticato:
// evita il lampeggio "login → area privata" a ogni apertura.
void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const theme = useTheme();
  const { status, role } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [online, setOnline] = useState(true);

  useEffect(() => onlineManager.subscribe(() => setOnline(onlineManager.isOnline())), []);

  useEffect(() => {
    if (status === 'loading') return;
    void SplashScreen.hideAsync();

    const group = segments[0];
    const onLoginScreen = group === 'login';

    if (status === 'anonymous' && !onLoginScreen) {
      router.replace('/login');
      return;
    }

    if (status !== 'authenticated') return;

    // Dopo il login l'utente viene portato AUTOMATICAMENTE nell'area del ruolo.
    if (onLoginScreen || group === undefined) {
      router.replace(homeRouteForRole(role));
      return;
    }

    // Protezione lato app: nessuno può trovarsi nell'area di un altro ruolo.
    // (Il controllo che conta resta comunque quello del backend.)
    const roleAreas = Object.values(ROLE_SEGMENT);
    if (role && roleAreas.includes(group) && group !== ROLE_SEGMENT[role]) {
      router.replace(homeRouteForRole(role));
    }
  }, [status, role, segments, router]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {!online && <OfflineBanner />}
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
        <Stack.Screen name="client" />
        <Stack.Screen name="advisor" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="server" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);

  useEffect(() => bindAppStateToQueries(), []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <RootNavigator />
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
