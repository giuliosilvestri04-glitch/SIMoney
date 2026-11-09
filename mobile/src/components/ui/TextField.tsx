import React, { useState } from 'react';
import { Pressable, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme-context';
import { AppText } from './AppText';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  hint?: string;
  error?: string | null;
  icon?: keyof typeof Feather.glyphMap;
  /** Occhio per mostrare/nascondere la password. */
  revealable?: boolean;
  /** Suffisso fisso, es. "EUR" o "%". */
  suffix?: string;
  multiline?: boolean;
  containerStyle?: ViewStyle;
}

/**
 * Campo di testo.
 *
 * Altezza 52 px, etichetta sempre visibile sopra al campo (non un placeholder
 * che scompare digitando) e messaggio di errore sotto: sono le tre cose che
 * rendono usabile un modulo su smartphone.
 */
export function TextField({
  label,
  hint,
  error,
  icon,
  revealable,
  suffix,
  multiline,
  containerStyle,
  ...props
}: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(Boolean(revealable));

  const borderColor = error
    ? theme.colors.negative
    : focused
      ? theme.colors.accent
      : theme.colors.border;

  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      {label && (
        <AppText variant="label" tone="muted">
          {label}
        </AppText>
      )}

      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          gap: theme.spacing.sm,
          minHeight: multiline ? 96 : 52,
          paddingHorizontal: theme.spacing.base,
          paddingVertical: multiline ? theme.spacing.md : 0,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor,
          backgroundColor: theme.colors.surface,
        }}
      >
        {icon && <Feather name={icon} size={18} color={focused ? theme.colors.accent : theme.colors.textFaint} />}

        <TextInput
          {...props}
          multiline={multiline}
          secureTextEntry={revealable ? hidden : props.secureTextEntry}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
          placeholderTextColor={theme.colors.textFaint}
          style={[
            theme.typography.body,
            {
              flex: 1,
              color: theme.colors.text,
              paddingVertical: multiline ? 0 : 14,
              textAlignVertical: multiline ? 'top' : 'center',
              minHeight: multiline ? 72 : undefined,
            },
          ]}
        />

        {suffix && (
          <AppText variant="label" tone="faint">
            {suffix}
          </AppText>
        )}

        {revealable && (
          <Pressable
            onPress={() => setHidden((value) => !value)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostra password' : 'Nascondi password'}
          >
            <Feather name={hidden ? 'eye' : 'eye-off'} size={18} color={theme.colors.textFaint} />
          </Pressable>
        )}
      </View>

      {(error || hint) && (
        <AppText variant="caption" tone={error ? 'negative' : 'faint'}>
          {error ?? hint}
        </AppText>
      )}
    </View>
  );
}
