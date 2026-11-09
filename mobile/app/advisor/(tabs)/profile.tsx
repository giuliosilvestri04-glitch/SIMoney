import React from 'react';
import { View } from 'react-native';
import { useCurrentUser } from '@/api/queries';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme-context';
import { Card, Section } from '@/components/ui/Card';
import { DataRow } from '@/components/ui/Rows';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { AccountCard, SignOutButton, SystemCard } from '@/components/domain/ProfileCommon';

/** PROFILO DEL CONSULENTE. */
export default function AdvisorProfileScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const me = useCurrentUser();

  const profile = me.data?.profile.type === 'ADVISOR' ? me.data.profile : null;

  return (
    <Screen
      header={<ScreenHeader title="Profilo" />}
      refreshing={me.isRefetching}
      onRefresh={() => void me.refetch()}
    >
      <AccountCard user={user} caption={profile ? `Consulente ${profile.code}` : undefined} />

      {profile && (
        <Section title="Dati professionali">
          <Card>
            <View style={{ gap: theme.spacing.xs }}>
              <DataRow label="Codice consulente" value={profile.code} />
              <DataRow label="Filiale" value={profile.officeCity} />
              <DataRow label="Clienti assegnati" value={String(profile.clientsCount)} />
            </View>
          </Card>
        </Section>
      )}

      <SystemCard />

      <SignOutButton />
    </Screen>
  );
}
