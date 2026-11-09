import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { createTheme, type Theme } from './theme';

/**
 * Il tema segue l'impostazione di sistema dello smartphone (chiaro/scuro).
 * Nessun componente importa direttamente i colori: passano tutti da `useTheme()`.
 */
const ThemeContext = createContext<Theme>(createTheme(false));

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const theme = useMemo(() => createTheme(scheme === 'dark'), [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
