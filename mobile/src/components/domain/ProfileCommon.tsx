import React, { useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { getBaseUrl } from '@/api/config';
import { useDataSource } from '@/api/queries';
import type { AdvisorContact, SessionUser } from '@/api/types';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme-context';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, Section } from '@/components/ui/Card';
import { DataRow } from '@/components/ui/Rows';

/** Blocchi comuni alle schermate "Profilo" dei tre ruoli. */

export function AccountCard({ user, caption }: { user: SessionUser | null; caption?: string }) {
  const theme = useTheme();
  if (!user) return null;

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.base }}>
        <Avatar name={user.fullName} color={user.avatarColor} size={56} />
        <View style={{ flex: 1, gap: 3 }}>
          <AppText variant="title" numberOfLines={1}>
            {user.fullName}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {user.email}
          </AppText>
          {caption && (
            <AppText variant="micro" tone="faint" numberOfLines={1}>
              {caption}
            </AppText>
          )}
        </View>
      </View>
    </Card>
  );
}

/** Scheda del consulente di riferimento, con contatti attivabili. */
export function AdvisorContactCard({ advisor }: { advisor: AdvisorContact }) {
  const theme = useTheme();

  const call = () => {
    if (!advisor.phone) return;
    void Linking.openURL(`tel:${advisor.phone.replace(/\s/g, '')}`);
  };

  const mail = () => {
    void Linking.openURL(`mailto:${advisor.email}`);
  };

  return (
    <Section title="Il tuo consulente">
      <Card>
        <View style={{ gap: theme.spacing.base }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <Avatar name={advisor.name} color={theme.colors.brand} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {advisor.name}
              </AppText>
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                Filiale di {advisor.officeCity}
              </AppText>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <View style={{ flex: 1 }}>
              <Button label="Scrivi" onPress={mail} variant="secondary" icon="mail" />
            </View>
            {advisor.phone && (
              <View style={{ flex: 1 }}>
                <Button label="Chiama" onPress={call} variant="secondary" icon="phone" />
              </View>
            )}
          </View>
        </View>
      </Card>
    </Section>
  );
}

/**
 * Stato del prototipo: sorgente dati e server.
 *
 * In demo è utile mostrarlo: dimostra che l'app gira su dati simulati e che
 * l'integrazione con i sistemi reali è una sostituzione successiva.
 */
export function SystemCard() {
  const theme = useTheme();
  const router = useRouter();
  const dataSource = useDataSource();

  return (
    <Section title="Prototipo">
      <Card>
        <View style={{ gap: theme.spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Feather name="database" size={15} color={theme.colors.textFaint} />
            <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
              Sorgente dati
            </AppText>
            <Badge
              label={dataSource.data ? (dataSource.data.name === 'mock' ? 'Dati dimostrativi' : 'Sistema reale') : '—'}
              tone={dataSource.data?.name === 'mock' ? 'neutral' : 'positive'}
              dot
            />
          </View>

          <DataRow label="Server" value={getBaseUrl().replace(/^https?:\/\//, '')} />

          <Button
            label="Impostazioni server"
            onPress={() => router.push('/server')}
            variant="secondary"
            icon="settings"
          />

          <AppText variant="micro" tone="faint">
            {dataSource.data?.disclaimer ??
              'Prototipo dimostrativo con dati fittizi. Non collegato a sistemi reali.'}
          </AppText>
        </View>
      </Card>
    </Section>
  );
}

export function SignOutButton() {
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  const confirm = () => {
    Alert.alert('Uscire dall\'app?', 'Dovrai accedere di nuovo con le tue credenziali.', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Esci',
        style: 'destructive',
        onPress: () => {
          setBusy(true);
          void signOut().finally(() => setBusy(false));
        },
      },
    ]);
  };

  return <Button label="Esci" onPress={confirm} variant="destructive" icon="log-out" loading={busy} />;
}
