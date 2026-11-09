import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useCompanyOverview } from '@/api/queries';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme-context';
import { formatCurrency, formatNumber } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Card, Section } from '@/components/ui/Card';
import { DataRow } from '@/components/ui/Rows';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { AccountCard, SignOutButton, SystemCard } from '@/components/domain/ProfileCommon';

/** PROFILO DIREZIONE: sintesi aziendale, accesso all'audit, stato del prototipo. */
export default function AdminProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const overview = useCompanyOverview();

  return (
    <Screen header={<ScreenHeader title="Profilo" />}>
      <AccountCard user={user} caption="Accesso alle informazioni aziendali" />

      {overview.data && (
        <Section title="Azienda in sintesi">
          <Card>
            <View style={{ gap: theme.spacing.xs }}>
              <DataRow
                label="Patrimonio complessivo"
                value={formatCurrency(overview.data.kpi.assetsUnderManagement, overview.data.kpi.currency, 0)}
              />
              <DataRow label="Clienti" value={formatNumber(overview.data.kpi.clients)} />
              <DataRow label="Consulenti" value={formatNumber(overview.data.kpi.advisors)} />
              <DataRow label="Proposte totali" value={formatNumber(overview.data.kpi.proposalsTotal)} />
            </View>
          </Card>
        </Section>
      )}

      <Section title="Controlli">
        <Card>
          <View style={{ gap: theme.spacing.md }}>
            <Button
              label="Registro attività"
              onPress={() => router.push('/admin/audit')}
              variant="secondary"
              icon="list"
            />
            <Button
              label="Tutte le proposte"
              onPress={() => router.push('/admin/proposals')}
              variant="secondary"
              icon="send"
            />
          </View>
        </Card>
      </Section>

      <SystemCard />

      <SignOutButton />
    </Screen>
  );
}
