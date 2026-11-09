import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme-context';
import { AppText } from './AppText';
import { IconButton } from './Button';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Frazione dell'altezza dello schermo occupata al massimo. */
  maxHeightRatio?: number;
  scrollable?: boolean;
  /** Contenuto fisso in fondo, fuori dall'area scorrevole (azioni). */
  footer?: React.ReactNode;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

/**
 * Foglio modale che sale dal basso.
 *
 * È il contenitore mobile per eccellenza: calendario, dettagli, conferme e
 * filtri si aprono così, restando ancorati al pollice e chiudibili con uno
 * swipe verso il basso o toccando fuori.
 *
 * Implementato con `Animated` e `PanResponder` della libreria standard: nessuna
 * dipendenza aggiuntiva, avvio dell'app più leggero.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  maxHeightRatio = 0.88,
  scrollable = true,
  footer,
}: BottomSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  const animateIn = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220, mass: 0.7 }),
      Animated.timing(backdrop, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [backdrop, translateY]);

  const animateOut = useCallback(
    (afterClose?: () => void) => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: 200, useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 0, duration: 160, useNativeDriver: true }),
      ]).start(() => afterClose?.());
    },
    [backdrop, translateY],
  );

  useEffect(() => {
    if (visible) {
      translateY.setValue(SCREEN_HEIGHT);
      animateIn();
    }
  }, [visible, animateIn, translateY]);

  const handleClose = useCallback(() => {
    animateOut(onClose);
  }, [animateOut, onClose]);

  // Trascinamento verso il basso per chiudere.
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_event, gesture) => {
        if (gesture.dy > 0) translateY.setValue(gesture.dy);
      },
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dy > 110 || gesture.vy > 0.85) {
          animateOut(onClose);
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 240 }).start();
        }
      },
    }),
  ).current;

  const maxHeight = SCREEN_HEIGHT * maxHeightRatio;
  const Container = scrollable ? ScrollView : View;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={{ ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const), opacity: backdrop }}>
          <Pressable
            accessibilityLabel="Chiudi"
            onPress={handleClose}
            style={{ flex: 1, backgroundColor: theme.colors.overlay }}
          />
        </Animated.View>

        <Animated.View
          style={{
            transform: [{ translateY }],
            maxHeight,
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            paddingBottom: Math.max(insets.bottom, theme.spacing.base),
            ...theme.elevation(3),
          }}
        >
          {/* Maniglia di trascinamento */}
          <View {...panResponder.panHandlers} style={{ paddingTop: theme.spacing.md, paddingBottom: theme.spacing.sm }}>
            <View
              style={{
                alignSelf: 'center',
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: theme.colors.borderStrong,
              }}
            />
          </View>

          {(title || subtitle) && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                paddingHorizontal: theme.spacing.lg,
                paddingBottom: theme.spacing.md,
                gap: theme.spacing.md,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                {title && <AppText variant="title">{title}</AppText>}
                {subtitle && (
                  <AppText variant="caption" tone="muted">
                    {subtitle}
                  </AppText>
                )}
              </View>
              <IconButton icon="x" label="Chiudi" onPress={handleClose} tone="muted" background />
            </View>
          )}

          <Container
            style={scrollable ? { flexGrow: 0 } : undefined}
            contentContainerStyle={
              scrollable
                ? { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.base }
                : undefined
            }
            {...(scrollable
              ? { showsVerticalScrollIndicator: false, bounces: Platform.OS === 'ios' }
              : { style: { paddingHorizontal: theme.spacing.lg } })}
          >
            {children}
          </Container>

          {footer && (
            <View
              style={{
                paddingHorizontal: theme.spacing.lg,
                paddingTop: theme.spacing.md,
                borderTopWidth: 1,
                borderTopColor: theme.colors.border,
              }}
            >
              {footer}
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}
