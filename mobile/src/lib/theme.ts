import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * ============================================================================
 * DESIGN SYSTEM
 * ============================================================================
 *
 * Impostazione fintech: sobria, ad alto contrasto, poche tinte.
 * Il colore è usato per SIGNIFICARE (segno della performance, stato di una
 * proposta, categoria di asset), mai per decorare.
 *
 * Tutto è definito qui: schermate e componenti non contengono valori esadecimali.
 */

const palette = {
  navy900: '#0A1729',
  navy800: '#0F2740',
  navy700: '#173654',
  blue600: '#2563EB',
  blue500: '#3B82F6',
  blue400: '#60A5FA',
  green700: '#067A52',
  green500: '#12A46C',
  green400: '#2FB27C',
  red700: '#B4342A',
  red500: '#DC5445',
  red400: '#E2695C',
  amber700: '#A9650B',
  amber500: '#D08A17',
  slate900: '#0F1B2D',
  slate700: '#3D4C62',
  slate600: '#5B6B82',
  slate500: '#7A8AA0',
  slate400: '#9AA8BC',
  slate300: '#C6D0DC',
  slate200: '#E3E8EF',
  slate100: '#EEF1F6',
  slate50: '#F4F6F9',
  white: '#FFFFFF',
  ink950: '#070C14',
  ink900: '#0B121C',
  ink850: '#111A26',
  ink800: '#16202E',
  ink700: '#1E2A3A',
  ink600: '#28374A',
};

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceSunken: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  onBrand: string;
  brand: string;
  brandSoft: string;
  accent: string;
  accentSoft: string;
  positive: string;
  positiveSoft: string;
  negative: string;
  negativeSoft: string;
  warning: string;
  warningSoft: string;
  neutralSoft: string;
  overlay: string;
  skeleton: string;
  tabBar: string;
  chartGrid: string;
  chartFillFrom: string;
  chartFillTo: string;
}

const lightColors: ThemeColors = {
  background: palette.slate50,
  surface: palette.white,
  surfaceAlt: '#FAFBFD',
  surfaceSunken: palette.slate100,
  border: palette.slate200,
  borderStrong: palette.slate300,
  text: palette.slate900,
  textMuted: palette.slate600,
  textFaint: palette.slate500,
  onBrand: palette.white,
  brand: palette.navy800,
  brandSoft: '#E8EDF4',
  accent: palette.blue600,
  accentSoft: '#E4EDFD',
  positive: palette.green700,
  positiveSoft: '#E2F4EC',
  negative: palette.red700,
  negativeSoft: '#FBEAE8',
  warning: palette.amber700,
  warningSoft: '#FBF0DE',
  neutralSoft: palette.slate100,
  overlay: 'rgba(8, 15, 26, 0.45)',
  skeleton: palette.slate100,
  tabBar: 'rgba(255,255,255,0.94)',
  chartGrid: palette.slate200,
  chartFillFrom: 'rgba(37, 99, 235, 0.18)',
  chartFillTo: 'rgba(37, 99, 235, 0.01)',
};

const darkColors: ThemeColors = {
  background: palette.ink900,
  surface: palette.ink850,
  surfaceAlt: palette.ink800,
  surfaceSunken: palette.ink800,
  border: palette.ink700,
  borderStrong: palette.ink600,
  text: '#F1F5FA',
  textMuted: palette.slate400,
  textFaint: '#74839A',
  onBrand: palette.white,
  brand: palette.navy700,
  brandSoft: '#1B2C41',
  accent: palette.blue400,
  accentSoft: '#16283F',
  positive: palette.green400,
  positiveSoft: '#122C25',
  negative: palette.red400,
  negativeSoft: '#31201F',
  warning: palette.amber500,
  warningSoft: '#2E2618',
  neutralSoft: palette.ink700,
  overlay: 'rgba(2, 6, 12, 0.6)',
  skeleton: palette.ink700,
  tabBar: 'rgba(17, 26, 38, 0.94)',
  chartGrid: palette.ink700,
  chartFillFrom: 'rgba(96, 165, 250, 0.22)',
  chartFillTo: 'rgba(96, 165, 250, 0.01)',
};

/** Scala di spaziatura: multipli di 4, come da griglia mobile. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 44,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

/**
 * Tipografia. `tabular-nums` su tutti gli importi: le cifre restano allineate
 * durante gli aggiornamenti, dettaglio che distingue una app finanziaria.
 */
const numeric: TextStyle = { fontVariant: ['tabular-nums'] };

export const typography = {
  hero: { fontSize: 38, lineHeight: 44, fontWeight: '700', letterSpacing: -1, ...numeric } as TextStyle,
  display: { fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.6, ...numeric } as TextStyle,
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.3 } as TextStyle,
  headline: { fontSize: 17, lineHeight: 23, fontWeight: '600', letterSpacing: -0.2 } as TextStyle,
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' } as TextStyle,
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' } as TextStyle,
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' } as TextStyle,
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' } as TextStyle,
  micro: { fontSize: 11, lineHeight: 15, fontWeight: '600', letterSpacing: 0.4 } as TextStyle,
  amount: { fontSize: 17, lineHeight: 22, fontWeight: '600', ...numeric } as TextStyle,
  amountSmall: { fontSize: 15, lineHeight: 20, fontWeight: '600', ...numeric } as TextStyle,
} as const;

/** Ombre discrete: su Android si usa l'elevazione nativa. */
export function elevation(level: 0 | 1 | 2 | 3, dark: boolean): ViewStyle {
  if (level === 0) return {};
  if (Platform.OS === 'android') return { elevation: level * 1.5 };
  const opacity = dark ? 0.4 : 0.07 + level * 0.015;
  return {
    shadowColor: dark ? '#000000' : '#0B1B33',
    shadowOpacity: opacity,
    shadowRadius: level * 5,
    shadowOffset: { width: 0, height: level * 2 },
  };
}

export interface Theme {
  dark: boolean;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  elevation: (level: 0 | 1 | 2 | 3) => ViewStyle;
}

export function createTheme(dark: boolean): Theme {
  return {
    dark,
    colors: dark ? darkColors : lightColors,
    spacing,
    radius,
    typography,
    elevation: (level) => elevation(level, dark),
  };
}

/** Altezza minima delle aree toccabili (linee guida iOS/Android). */
export const HIT_SIZE = 44;

/**
 * Colori delle asset class: il backend fornisce già `colorHex` per ogni
 * categoria, questi valori servono solo come riserva.
 */
export const FALLBACK_SERIES_COLORS = [
  palette.blue600,
  '#0EA5E9',
  '#7C3AED',
  palette.slate500,
  '#F59E0B',
  '#14B8A6',
  '#EC4899',
  '#65A30D',
];
