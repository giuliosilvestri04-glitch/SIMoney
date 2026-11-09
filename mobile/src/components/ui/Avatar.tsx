import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { useTheme } from '@/lib/theme-context';
import { initialsOf } from '@/lib/format';
import { AppText } from './AppText';

interface AvatarProps {
  name: string;
  color?: string;
  size?: number;
  initials?: string;
  style?: ViewStyle;
}

/**
 * Iniziali su fondo colorato.
 * Nessuna fotografia: i dati sono fittizi e l'app resta leggera (nessuna
 * immagine da scaricare).
 */
export function Avatar({ name, color, size = 44, initials, style }: AvatarProps) {
  const theme = useTheme();
  const background = color ?? theme.colors.brand;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
      accessible
      accessibilityLabel={name}
    >
      <AppText
        variant={size >= 56 ? 'headline' : 'label'}
        style={{ color: '#FFFFFF', letterSpacing: 0.3 }}
      >
        {initials ?? initialsOf(name)}
      </AppText>
    </View>
  );
}
