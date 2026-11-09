import React from 'react';
import { Tabs } from 'expo-router/js-tabs';
import { useClientHome } from '@/api/queries';
import { tabIcon, useTabScreenOptions } from '@/components/ui/tabs';

/**
 * Navigazione del CLIENTE.
 *
 * Cinque voci, tutte sostantivi brevi: Home, Portafoglio, Proposte, Documenti,
 * Profilo. Sulle proposte compare il numero di quelle in attesa, così la cosa
 * che richiede un'azione è visibile senza entrare.
 */
export default function ClientTabsLayout() {
  const screenOptions = useTabScreenOptions();

  // Dato già in cache dalla home: nessuna richiesta aggiuntiva per il badge.
  const home = useClientHome();
  const pending = home.data?.counters.proposals.PENDING ?? 0;

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen
        name="portfolio"
        options={{ title: 'Portafoglio', tabBarIcon: tabIcon('pie-chart') }}
      />
      <Tabs.Screen
        name="proposals"
        options={{
          title: 'Proposte',
          tabBarIcon: tabIcon('inbox'),
          tabBarBadge: pending > 0 ? pending : undefined,
        }}
      />
      <Tabs.Screen name="documents" options={{ title: 'Documenti', tabBarIcon: tabIcon('folder') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profilo', tabBarIcon: tabIcon('user') }} />
    </Tabs>
  );
}
