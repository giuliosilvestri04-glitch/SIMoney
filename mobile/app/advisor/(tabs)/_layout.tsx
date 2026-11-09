import React from 'react';
import { Tabs } from 'expo-router/js-tabs';
import { useAdvisorDashboard } from '@/api/queries';
import { tabIcon, useTabScreenOptions } from '@/components/ui/tabs';

/**
 * Navigazione del CONSULENTE.
 * Quattro voci: il lavoro quotidiano è "guarda i clienti, gestisci le proposte".
 */
export default function AdvisorTabsLayout() {
  const screenOptions = useTabScreenOptions();

  // Dato già in cache dalla dashboard: il badge non costa una richiesta in più.
  const dashboard = useAdvisorDashboard();
  const pending = dashboard.data?.kpi.pendingProposals ?? 0;

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', tabBarIcon: tabIcon('grid') }} />
      <Tabs.Screen name="clients" options={{ title: 'Clienti', tabBarIcon: tabIcon('users') }} />
      <Tabs.Screen
        name="proposals"
        options={{
          title: 'Proposte',
          tabBarIcon: tabIcon('send'),
          tabBarBadge: pending > 0 ? pending : undefined,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profilo', tabBarIcon: tabIcon('user') }} />
    </Tabs>
  );
}
