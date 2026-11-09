import React from 'react';
import { View } from 'react-native';
import { useClientProfile } from '@/api/queries';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme-context';
import { formatDate } from '@/lib/format';
import { Card, Section } from '@/components/ui/Card';
import { DataRow } from '@/components/ui/Rows';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { ErrorState, Skeleton } from '@/components/ui/States';
import {
  AccountCard,
  AdvisorContactCard,
  SignOutButton,
  SystemCard,
} from '@/components/domain/ProfileCommon';

const RISK_DESCRIPTION: Record<string, string> = {
  PRUDENTE: 'Priorità alla conservazione del capitale',
  BILANCIATO: 'Equilibrio fra crescita e stabilità',
  DINAMICO: 'Crescita con volatilità accettata',
  AGGRESSIVO: 'Massima crescita, alta volatilità',
};

/** PROFILO DEL CLIENTE: dati del rapporto, consulente, stato del prototipo. */
export default function ClientProfileScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const profile = useClientProfile();

  return (
    <Screen
      header={<ScreenHeader title="Profilo" />}
      refreshing={profile.isRefetching}
      onRefresh={() => void profile.refetch()}
    >
      <AccountCard user={user} caption={profile.data ? `Cliente ${profile.data.clientCode}` : undefined} />

      {profile.isError ? (
        <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
      ) : profile.isLoading ? (
        <Card>
          <View style={{ gap: theme.spacing.md }}>
            <Skeleton height={16} width="50%" />
            <Skeleton height={16} width="70%" />
            <Skeleton height={16} width="40%" />
          </View>
        </Card>
      ) : profile.data ? (
        <>
          <Section title="Il tuo rapporto">
            <Card>
              <View style={{ gap: theme.spacing.xs }}>
                <DataRow label="Codice cliente" value={profile.data.clientCode} />
                <DataRow
                  label="Profilo di rischio"
                  value={profile.data.riskProfile}
                  hint={RISK_DESCRIPTION[profile.data.riskProfile]}
                />
                <DataRow label="Cliente dal" value={formatDate(profile.data.onboardedAt)} />
                <DataRow label="Città" value={profile.data.city} />
                <DataRow label="IBAN" value={profile.data.ibanMasked} />
                <DataRow label="Codice fiscale" value={profile.data.taxCodeMasked} />
              </View>
            </Card>
          </Section>

          <AdvisorContactCard advisor={profile.data.advisor} />
        </>
      ) : null}

      <SystemCard />

      <SignOutButton />
    </Screen>
  );
}
