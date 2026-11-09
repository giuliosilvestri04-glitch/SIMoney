import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '@/lib/theme-context';

/**
 * Schermata ponte all'avvio.
 * Il reindirizzamento verso login o area del ruolo è gestito da `_layout.tsx`:
 * qui si mostra solo un'attesa breve e sobria.
 */
export default function Index() {
  const theme = useTheme();

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.brand,
      }}
    >
      <ActivityIndicator color="#FFFFFF" />
    </View>
  );
}
