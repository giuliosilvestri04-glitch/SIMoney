import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setSessionExpiredHandler } from '@/api/client';
import { loadBaseUrlOverride } from '@/api/config';
import { auth } from '@/api/endpoints';
import {
  clearSession,
  getRefreshToken,
  getSessionUser,
  restoreSession,
  saveSession,
} from '@/api/session';
import type { Role, SessionUser } from '@/api/types';

/**
 * Stato di autenticazione dell'app.
 *
 * All'avvio ripristina la sessione salvata: chi ha già fatto il login rientra
 * direttamente nella propria area, come ci si aspetta da un'app mobile.
 * Il RUOLO restituito dal backend decide quale navigazione mostrare.
 */

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: Status;
  user: SessionUser | null;
  role: Role | null;
  signIn: (email: string, password: string) => Promise<SessionUser>;
  signOut: () => Promise<void>;
  /** Richiamato dopo aver cambiato l'indirizzo del server. */
  reload: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);

  const bootstrap = useCallback(async () => {
    await loadBaseUrlOverride();
    const session = await restoreSession();
    setUser(session.user);
    setStatus(session.accessToken && session.user ? 'authenticated' : 'anonymous');
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // Il client HTTP segnala qui la sessione non più valida (refresh fallito).
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setStatus('anonymous');
      queryClient.clear();
    });
    return () => setSessionExpiredHandler(null);
  }, [queryClient]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await auth.login(email, password);
      await saveSession({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      });
      queryClient.clear();
      setUser(result.user);
      setStatus('authenticated');
      return result.user;
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    const refreshToken = getRefreshToken();
    // Il logout non deve mai bloccarsi per un problema di rete.
    try {
      await auth.logout(refreshToken);
    } catch {
      // ignorato volutamente
    }
    await clearSession();
    queryClient.clear();
    setUser(null);
    setStatus('anonymous');
  }, [queryClient]);

  const reload = useCallback(async () => {
    queryClient.clear();
    setStatus('loading');
    await bootstrap();
  }, [bootstrap, queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: user ?? getSessionUser(),
      role: (user?.role ?? null) as Role | null,
      signIn,
      signOut,
      reload,
    }),
    [status, user, signIn, signOut, reload],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve essere usato dentro AuthProvider');
  return context;
}

/** Cartella di primo livello dell'area di ciascun ruolo. */
export const ROLE_SEGMENT: Record<Role, string> = {
  CLIENT: 'client',
  ADVISOR: 'advisor',
  ADMIN: 'admin',
};

/** Percorso iniziale dell'area corrispondente al ruolo. */
export function homeRouteForRole(role: Role | null): string {
  switch (role) {
    case 'CLIENT':
      return '/client/home';
    case 'ADVISOR':
      return '/advisor/dashboard';
    case 'ADMIN':
      return '/admin/dashboard';
    default:
      return '/login';
  }
}
