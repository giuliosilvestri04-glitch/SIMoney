import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { ApiError } from '@/api/client';

/**
 * Configurazione della cache dati.
 *
 * Scelte legate agli obiettivi del progetto:
 *  - `staleTime` di un minuto: tornando su una schermata già vista i dati
 *    compaiono subito, senza una nuova richiesta (app percepita come veloce);
 *  - niente ritentativi su errori di autorizzazione o di validazione: sarebbero
 *    inutili e rallenterebbero la comparsa del messaggio;
 *  - ripresa automatica al ritorno della connessione.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: (failureCount, error) => {
          if (error instanceof ApiError) {
            if (!error.isRetryable) return false;
            return failureCount < 2;
          }
          return failureCount < 1;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
      },
      mutations: { retry: false },
    },
  });
}

/**
 * Collega lo stato della rete e il ciclo di vita dell'app a React Query.
 * Restituisce la funzione di pulizia.
 */
export function bindAppStateToQueries(): () => void {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    }),
  );

  const subscription = AppState.addEventListener('change', (status) => {
    if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
  });

  return () => subscription.remove();
}
