import React from 'react';
import {
  RefreshControl,
  ScrollView,
  StatusBar,
  View,
  type ScrollViewProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme-context';
import { AppText } from './AppText';
import { IconButton } from './Button';

/**
 * Impalcatura delle schermate.
 *
 * Si occupa di: safe area (notch, barra gesti, isola dinamica), scorrimento
 * verticale, "tira per aggiornare", spazio per la tab bar e colore di sfondo.
 * Ogni schermata parte da qui: nessuna gestisce gli inset per conto proprio.
 */

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Intestazione fissa, non scorrevole. */
  header?: React.ReactNode;
  /** Barra di azioni ancorata in fondo (es. Accetta / Rifiuta). */
  footer?: React.ReactNode;
  padded?: boolean;
  /** Spazio extra in fondo quando la schermata è dentro una tab bar. */
  tabBarPadding?: boolean;
  background?: string;
  contentStyle?: ViewStyle;
  scrollProps?: Partial<ScrollViewProps>;
}

export const TAB_BAR_HEIGHT = 60;

export function Screen({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
  header,
  footer,
  padded = true,
  tabBarPadding = true,
  background,
  contentStyle,
  scrollProps,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const contentPadding: ViewStyle = {
    paddingHorizontal: padded ? theme.spacing.base : 0,
    paddingTop: header ? theme.spacing.base : insets.top + theme.spacing.base,
    paddingBottom:
      (tabBarPadding ? TAB_BAR_HEIGHT + insets.bottom : insets.bottom) + theme.spacing.xl,
    gap: theme.spacing.base,
  };

  const body = scroll ? (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[contentPadding, contentStyle]}
      // L'indicatore di aggiornamento deve restare sotto l'intestazione fissa.
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.textMuted}
            colors={[theme.colors.accent]}
            progressBackgroundColor={theme.colors.surface}
          />
        ) : undefined
      }
      {...scrollProps}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, contentPadding, contentStyle]}>{children}</View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: background ?? theme.colors.background }}>
      <StatusBar
        barStyle={theme.dark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      {header}
      {body}
      {footer && (
        <View
          style={{
            paddingHorizontal: theme.spacing.base,
            paddingTop: theme.spacing.md,
            paddingBottom: Math.max(insets.bottom, theme.spacing.base),
            backgroundColor: theme.colors.surface,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
          }}
        >
          {footer}
        </View>
      )}
    </View>
  );
}

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Mostra la freccia indietro: automatico nelle schermate di dettaglio. */
  back?: boolean;
  onBack?: () => void;
  action?: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void };
  /** Riga aggiuntiva sotto al titolo (filtri, segmenti). */
  below?: React.ReactNode;
  transparent?: boolean;
}

/** Intestazione standard: titolo, indietro, azione. */
export function ScreenHeader({
  title,
  subtitle,
  back,
  onBack,
  action,
  below,
  transparent,
}: ScreenHeaderProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View
      style={{
        paddingTop: insets.top + theme.spacing.sm,
        paddingHorizontal: theme.spacing.base,
        paddingBottom: theme.spacing.md,
        backgroundColor: transparent ? 'transparent' : theme.colors.background,
        borderBottomWidth: transparent ? 0 : 1,
        borderBottomColor: theme.colors.border,
        gap: theme.spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        {back && (
          <IconButton
            icon="chevron-left"
            label="Indietro"
            size={24}
            onPress={() => (onBack ? onBack() : router.back())}
            style={{ marginLeft: -12 }}
          />
        )}
        <View style={{ flex: 1, gap: 1 }}>
          <AppText variant="title" numberOfLines={1}>
            {title}
          </AppText>
          {subtitle && (
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {subtitle}
            </AppText>
          )}
        </View>
        {action && (
          <IconButton icon={action.icon} label={action.label} onPress={action.onPress} tone="accent" background />
        )}
      </View>
      {below}
    </View>
  );
}

interface BrandHeaderProps {
  children: React.ReactNode;
  /** Angoli inferiori arrotondati sopra il contenuto. */
  rounded?: boolean;
}

/**
 * Intestazione scura a tutta larghezza.
 * Usata per il patrimonio in home: il numero più importante dell'app merita
 * uno sfondo dedicato, non una card come le altre.
 */
export function BrandHeader({ children, rounded = true }: BrandHeaderProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        backgroundColor: theme.dark ? theme.colors.surface : theme.colors.brand,
        paddingTop: insets.top + theme.spacing.md,
        paddingHorizontal: theme.spacing.base,
        paddingBottom: theme.spacing.lg,
        borderBottomLeftRadius: rounded ? theme.radius.xl : 0,
        borderBottomRightRadius: rounded ? theme.radius.xl : 0,
      }}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      {children}
    </View>
  );
}
