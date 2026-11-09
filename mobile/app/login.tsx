import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { ApiError } from '@/api/client';
import { useDemoAccounts } from '@/api/queries';
import type { DemoAccount, Role } from '@/api/types';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme-context';
import { AppText } from '@/components/ui/AppText';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button, IconButton } from '@/components/ui/Button';
import { Badge, PrototypeTag } from '@/components/ui/Badge';
import { TextField } from '@/components/ui/TextField';
import { Divider } from '@/components/ui/Card';

/** Marchio dell'app disegnato in SVG: nessuna immagine da caricare. */
function BrandMark({ size = 46 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect x={8} y={58} width={17} height={34} rx={7} fill="#FFFFFF" />
      <Rect x={34} y={42} width={17} height={50} rx={7} fill="#FFFFFF" />
      <Rect x={60} y={24} width={17} height={68} rx={7} fill="#FFFFFF" opacity={0.9} />
      <Path
        d="M6 52 L36 30 L62 38 L94 8"
        stroke="#4C8DFF"
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={94} cy={8} r={7} fill="#4C8DFF" />
    </Svg>
  );
}

const ROLE_LABELS: Record<Role, string> = {
  CLIENT: 'Cliente',
  ADVISOR: 'Consulente',
  ADMIN: 'Direzione',
};

const ROLE_TONE: Record<Role, 'accent' | 'positive' | 'warning'> = {
  CLIENT: 'accent',
  ADVISOR: 'positive',
  ADMIN: 'warning',
};

/**
 * Accesso all'app.
 *
 * Il backend restituisce il RUOLO: l'app decide da sé quale area aprire, senza
 * che l'utente scelga nulla.
 *
 * Il pannello "Account dimostrativi" esiste perché il prototipo va presentato:
 * durante la demo si passa da cliente a consulente a direzione in due tocchi.
 */
export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoOpen, setDemoOpen] = useState(false);

  const demo = useDemoAccounts();

  const handleLogin = async (credentials?: { email: string; password: string }) => {
    const payload = credentials ?? { email, password };
    if (!payload.email.trim() || !payload.password) {
      setError('Inserisci email e password.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await signIn(payload.email, payload.password);
      // Il reindirizzamento verso l'area del ruolo avviene nel layout radice.
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
      } else {
        setError('Accesso non riuscito. Riprova.');
      }
      setSubmitting(false);
    }
  };

  const loginWithDemoAccount = (account: DemoAccount) => {
    setDemoOpen(false);
    setEmail(account.email);
    setPassword(account.password);
    void handleLogin({ email: account.email, password: account.password });
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.brand }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Intestazione */}
          <View
            style={{
              paddingTop: insets.top + theme.spacing.lg,
              paddingHorizontal: theme.spacing.lg,
              paddingBottom: theme.spacing.xxl,
              gap: theme.spacing.lg,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <PrototypeTag />
              <IconButton
                icon="settings"
                label="Impostazioni server"
                tone="onBrand"
                onPress={() => router.push('/server')}
              />
            </View>

            <View style={{ gap: theme.spacing.base, marginTop: theme.spacing.md }}>
              <BrandMark size={48} />
              <View style={{ gap: 6 }}>
                {/* Nome dell'app: si adatta se lo schermo è stretto, senza andare a capo */}
                <AppText
                  variant="hero"
                  style={{ color: theme.colors.onBrand }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  SIMoney
                </AppText>
                <AppText variant="body" style={{ color: 'rgba(255,255,255,0.72)', maxWidth: 300 }}>
                  Il tuo portafoglio, l&apos;andamento e le proposte del consulente. In un&apos;unica app.
                </AppText>
              </View>
            </View>
          </View>

          {/* Modulo di accesso */}
          <View
            style={{
              flex: 1,
              backgroundColor: theme.colors.background,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              paddingHorizontal: theme.spacing.lg,
              paddingTop: theme.spacing.xl,
              paddingBottom: Math.max(insets.bottom, theme.spacing.lg) + theme.spacing.lg,
              gap: theme.spacing.lg,
            }}
          >
            <AppText variant="title">Accedi</AppText>

            <View style={{ gap: theme.spacing.base }}>
              <TextField
                label="Email"
                icon="mail"
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setError(null);
                }}
                placeholder="nome.cognome@cliente.demo.local"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="username"
                returnKeyType="next"
                editable={!submitting}
              />

              <TextField
                label="Password"
                icon="lock"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setError(null);
                }}
                placeholder="••••••••"
                revealable
                autoCapitalize="none"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => void handleLogin()}
                editable={!submitting}
                error={error}
              />
            </View>

            <Button
              label="Accedi"
              onPress={() => void handleLogin()}
              loading={submitting}
              size="lg"
              icon="arrow-right"
              iconPosition="right"
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <View style={{ flex: 1 }}>
                <Divider />
              </View>
              <AppText variant="micro" tone="faint" uppercase>
                oppure
              </AppText>
              <View style={{ flex: 1 }}>
                <Divider />
              </View>
            </View>

            <Button
              label="Usa un account dimostrativo"
              onPress={() => setDemoOpen(true)}
              variant="secondary"
              icon="users"
            />

            <View style={{ gap: theme.spacing.sm, alignItems: 'center' }}>
              <AppText variant="micro" tone="faint" align="center">
                Prototipo dimostrativo con dati fittizi. Non collegato a sistemi reali.
              </AppText>
              <Pressable onPress={() => router.push('/server')} hitSlop={10}>
                <AppText variant="micro" tone="accent">
                  Configura il server della demo
                </AppText>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Elenco degli account dimostrativi */}
      <BottomSheet
        visible={demoOpen}
        onClose={() => setDemoOpen(false)}
        title="Account dimostrativi"
        subtitle="Tocca un profilo per entrare direttamente nella sua area."
      >
        {demo.isLoading && (
          <AppText variant="caption" tone="muted">
            Caricamento degli account…
          </AppText>
        )}

        {demo.isError && (
          <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.base }}>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <Feather name="alert-circle" size={16} color={theme.colors.negative} />
              <AppText variant="caption" tone="negative" style={{ flex: 1 }}>
                Non riesco a contattare il backend del prototipo. Verifica che sia avviato e che
                l&apos;indirizzo del server sia corretto.
              </AppText>
            </View>
            <Button
              label="Impostazioni server"
              onPress={() => {
                setDemoOpen(false);
                router.push('/server');
              }}
              variant="secondary"
              icon="settings"
            />
          </View>
        )}

        {demo.data && (
          <View style={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.base }}>
            {demo.data.accounts.map((account) => (
              <Pressable
                key={account.email}
                onPress={() => loginWithDemoAccount(account)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                  padding: theme.spacing.base,
                  borderRadius: theme.radius.md,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  backgroundColor: pressed ? theme.colors.surfaceSunken : theme.colors.surfaceAlt,
                })}
              >
                <View style={{ flex: 1, gap: 5 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                    <AppText variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {account.name}
                    </AppText>
                    <Badge label={ROLE_LABELS[account.role]} tone={ROLE_TONE[account.role]} />
                  </View>
                  <AppText variant="micro" tone="faint" numberOfLines={1}>
                    {account.detail}
                  </AppText>
                  <AppText variant="micro" tone="muted" numberOfLines={1}>
                    {account.email}
                  </AppText>
                </View>
                <Feather name="log-in" size={18} color={theme.colors.accent} />
              </Pressable>
            ))}

            <AppText variant="micro" tone="faint" align="center" style={{ marginTop: theme.spacing.sm }}>
              {demo.data.note}
            </AppText>
          </View>
        )}
      </BottomSheet>
    </View>
  );
}
