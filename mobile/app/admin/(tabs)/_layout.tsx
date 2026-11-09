import React from 'react';
import { Tabs } from 'expo-router/js-tabs';
import { tabIcon, useTabScreenOptions } from '@/components/ui/tabs';

/**
 * Navigazione della DIREZIONE.
 * Quattro voci: sintesi aziendale, analisi approfondite, rete commerciale,
 * profilo. Nessun dato operativo di singolo cliente in prima battuta.
 */
export default function AdminTabsLayout() {
  const screenOptions = useTabScreenOptions();

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen name="dashboard" options={{ title: 'Direzione', tabBarIcon: tabIcon('grid') }} />
      <Tabs.Screen name="analytics" options={{ title: 'Analisi', tabBarIcon: tabIcon('bar-chart-2') }} />
      <Tabs.Screen name="network" options={{ title: 'Rete', tabBarIcon: tabIcon('users') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profilo', tabBarIcon: tabIcon('user') }} />
    </Tabs>
  );
}
