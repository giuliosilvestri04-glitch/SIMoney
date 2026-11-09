import React, { useEffect, useRef } from 'react';
import { Animated, View, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ApiError } from '@/api/client';
import { useTheme } from '@/lib/theme-context';
import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';

/**
 * Stati non-felici dell'interfaccia.
 *
 * Requisito 41: caricamento, errore, timeout, assenza di connessione e dati
 * mancanti devono SEMPRE avere una rappresentazione comprensibile.
 * Nessuna schermata bianca, in nessun caso.
 */

// --- Scheletri di caricamento ----------------------------------------------

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

/** Blocco pulsante che anticipa la forma del contenuto in arrivo. */
export function Skeleton({ width = '100%', height = 16, radius, style }: SkeletonProps) {
  const theme = useTheme();
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 750, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius ?? theme.radius.sm,
          backgroundColor: theme.colors.skeleton,
          opacity: pulse,
        },
        style,
      ]}
    />
  );
}

/** Scheletro della schermata patrimonio: intestazione, grafico, righe. */
export function PortfolioSkeleton() {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.base }}>
      <Card>
        <View style={{ gap: theme.spacing.md }}>
          <Skeleton width="45%" height={12} />
          <Skeleton width="70%" height={34} />
          <Skeleton width="35%" height={18} />
        </View>
      </Card>
      <Card>
        <View style={{ gap: theme.spacing.base }}>
          <Skeleton width="30%" height={12} />
          <Skeleton height={150} radius={theme.radius.md} />
          <Skeleton width="60%" height={32} radius={theme.radius.pill} />
        </View>
      </Card>
      <Card>
        <View style={{ gap: theme.spacing.base }}>
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <Skeleton width={36} height={36} radius={18} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="55%" height={13} />
                <Skeleton width="30%" height={11} />
              </View>
              <Skeleton width={64} height={16} />
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

/** Scheletro generico per le liste. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.md }}>
      {Array.from({ length: rows }).map((_, index) => (
        <Card key={index}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <Skeleton width={44} height={44} radius={22} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="60%" height={14} />
              <Skeleton width="35%" height={12} />
            </View>
            <Skeleton width={70} height={18} />
          </View>
        </Card>
      ))}
    </View>
  );
}

// --- Errore -----------------------------------------------------------------

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  /** Compatta: dentro una card, senza occupare l'intera schermata. */
  compact?: boolean;
}

function describeError(error: unknown): { title: string; message: string; icon: keyof typeof Feather.glyphMap; retry: boolean } {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'network':
        return {
          icon: 'wifi-off',
          title: 'Connessione assente',
          message: error.message,
          retry: true,
        };
      case 'timeout':
        return {
          icon: 'clock',
          title: 'Il server non risponde',
          message: 'La richiesta ha impiegato troppo tempo. Verifica la connessione e riprova.',
          retry: true,
        };
      case 'server':
        return { icon: 'alert-triangle', title: 'Servizio non disponibile', message: error.message, retry: true };
      case 'auth':
        return { icon: 'lock', title: 'Accesso non consentito', message: error.message, retry: false };
      default:
        return { icon: 'alert-circle', title: 'Qualcosa non ha funzionato', message: error.message, retry: false };
    }
  }

  return {
    icon: 'alert-circle',
    title: 'Qualcosa non ha funzionato',
    message: 'Si è verificato un problema imprevisto. Riprova.',
    retry: true,
  };
}

export function ErrorState({ error, onRetry, compact }: ErrorStateProps) {
  const theme = useTheme();
  const info = describeError(error);

  const content = (
    <View style={{ alignItems: 'center', gap: theme.spacing.md, paddingVertical: compact ? 0 : theme.spacing.xl }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.negativeSoft,
        }}
      >
        <Feather name={info.icon} size={24} color={theme.colors.negative} />
      </View>
      <View style={{ gap: 6, alignItems: 'center' }}>
        <AppText variant="headline">{info.title}</AppText>
        <AppText variant="caption" tone="muted" align="center" style={{ maxWidth: 300 }}>
          {info.message}
        </AppText>
      </View>
      {onRetry && info.retry && (
        <Button label="Riprova" onPress={onRetry} variant="secondary" icon="refresh-cw" fullWidth={false} />
      )}
    </View>
  );

  if (compact) return content;
  return <Card>{content}</Card>;
}

// --- Vuoto ------------------------------------------------------------------

interface EmptyStateProps {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
  compact?: boolean;
}

export function EmptyState({ icon = 'inbox', title, message, action, compact }: EmptyStateProps) {
  const theme = useTheme();

  const content = (
    <View style={{ alignItems: 'center', gap: theme.spacing.md, paddingVertical: compact ? theme.spacing.md : theme.spacing.xl }}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surfaceSunken,
        }}
      >
        <Feather name={icon} size={22} color={theme.colors.textFaint} />
      </View>
      <View style={{ gap: 4, alignItems: 'center' }}>
        <AppText variant="bodyStrong">{title}</AppText>
        {message && (
          <AppText variant="caption" tone="muted" align="center" style={{ maxWidth: 280 }}>
            {message}
          </AppText>
        )}
      </View>
      {action && <Button label={action.label} onPress={action.onPress} variant="secondary" fullWidth={false} />}
    </View>
  );

  if (compact) return content;
  return <Card>{content}</Card>;
}

// --- Banner di connessione --------------------------------------------------

export function OfflineBanner() {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
        backgroundColor: theme.colors.warningSoft,
      }}
    >
      <Feather name="wifi-off" size={13} color={theme.colors.warning} />
      <AppText variant="micro" style={{ color: theme.colors.warning }}>
        NESSUNA CONNESSIONE — DATI NON AGGIORNATI
      </AppText>
    </View>
  );
}
