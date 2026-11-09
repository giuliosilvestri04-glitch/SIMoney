import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { defaultBaseUrl, getBaseUrl, setBaseUrlOverride } from '@/api/config';
import { system } from '@/api/endpoints';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme-context';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { Badge } from '@/components/ui/Badge';

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok'; service: string; version: string; environment: string }
  | { status: 'failed'; message: string };

/**
 * Indirizzo del backend della demo.
 *
 * Serve perché il prototipo viene mostrato su dispositivi e reti diverse:
 * in ufficio, su hotspot, con il backend su un portatile. Senza questa
 * schermata ogni cambio di rete richiederebbe una nuova build.
 */
export default function ServerScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { reload } = useAuth();

  const automatic = defaultBaseUrl();
  const current = getBaseUrl();

  const [value, setValue] = useState(current === automatic ? '' : current);
  const [test, setTest] = useState<TestState>({ status: 'idle' });
  const [saving, setSaving] = useState(false);

  const effective = value.trim() ? value.trim().replace(/\/+$/, '') : automatic;

  const runTest = async () => {
    setTest({ status: 'testing' });
    try {
      // Si applica l'indirizzo prima del test, così si prova davvero quello nuovo.
      await setBaseUrlOverride(value.trim() || null);
      const health = await system.health();
      setTest({
        status: 'ok',
        service: health.service,
        version: health.version,
        environment: health.environment,
      });
    } catch {
      setTest({
        status: 'failed',
        message:
          'Nessuna risposta da questo indirizzo. Verifica che il backend sia avviato e che lo smartphone sia sulla stessa rete Wi-Fi del computer.',
      });
    }
  };

  const save = async () => {
    setSaving(true);
    await setBaseUrlOverride(value.trim() || null);
    await reload();
    setSaving(false);
    router.back();
  };

  return (
    <Screen
      tabBarPadding={false}
      header={<ScreenHeader title="Server della demo" back onBack={() => router.back()} />}
    >
      <Card>
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="micro" tone="faint" uppercase>
            Indirizzo in uso
          </AppText>
          <AppText variant="bodyStrong" selectable>
            {effective}
          </AppText>
          <Badge
            label={value.trim() ? 'Impostato manualmente' : 'Rilevato automaticamente'}
            tone={value.trim() ? 'accent' : 'neutral'}
            icon={value.trim() ? 'edit-3' : 'zap'}
          />
        </View>
      </Card>

      <Card>
        <View style={{ gap: theme.spacing.base }}>
          <TextField
            label="Indirizzo personalizzato"
            icon="server"
            value={value}
            onChangeText={(next) => {
              setValue(next);
              setTest({ status: 'idle' });
            }}
            placeholder={automatic}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            hint="Lascia vuoto per usare il rilevamento automatico in sviluppo."
          />

          <Button
            label={test.status === 'testing' ? 'Verifica in corso…' : 'Verifica connessione'}
            onPress={() => void runTest()}
            variant="secondary"
            icon="activity"
            loading={test.status === 'testing'}
          />

          {test.status === 'ok' && (
            <View
              style={{
                flexDirection: 'row',
                gap: theme.spacing.sm,
                padding: theme.spacing.md,
                borderRadius: theme.radius.sm,
                backgroundColor: theme.colors.positiveSoft,
              }}
            >
              <Feather name="check-circle" size={16} color={theme.colors.positive} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="label" style={{ color: theme.colors.positive }}>
                  Backend raggiungibile
                </AppText>
                <AppText variant="micro" style={{ color: theme.colors.positive }}>
                  {test.service} · v{test.version} · {test.environment}
                </AppText>
              </View>
            </View>
          )}

          {test.status === 'failed' && (
            <View
              style={{
                flexDirection: 'row',
                gap: theme.spacing.sm,
                padding: theme.spacing.md,
                borderRadius: theme.radius.sm,
                backgroundColor: theme.colors.negativeSoft,
              }}
            >
              <Feather name="alert-circle" size={16} color={theme.colors.negative} />
              <AppText variant="caption" style={{ color: theme.colors.negative, flex: 1 }}>
                {test.message}
              </AppText>
            </View>
          )}

          <Button label="Salva e applica" onPress={() => void save()} loading={saving} icon="check" />

          {value.trim().length > 0 && (
            <Button
              label="Torna al rilevamento automatico"
              onPress={() => {
                setValue('');
                setTest({ status: 'idle' });
              }}
              variant="ghost"
            />
          )}
        </View>
      </Card>

      <Card variant="outlined">
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="label">Come trovare l&apos;indirizzo</AppText>
          <AppText variant="caption" tone="muted">
            Avvia il backend con <AppText variant="caption">npm run dev</AppText>: nel terminale compare
            l&apos;indirizzo di rete, ad esempio <AppText variant="caption">http://192.168.1.100:4000</AppText>.
            Lo smartphone deve essere collegato alla stessa rete Wi-Fi del computer.
          </AppText>
          <AppText variant="caption" tone="muted">
            Nelle build consegnate all&apos;azienda l&apos;indirizzo viene impostato in fase di compilazione
            con la variabile <AppText variant="caption">EXPO_PUBLIC_API_URL</AppText>.
          </AppText>
        </View>
      </Card>
    </Screen>
  );
}
