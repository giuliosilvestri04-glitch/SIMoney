import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme-context';
import { formatMonthName, parseDate, toISODate, WEEKDAYS_SHORT } from '@/lib/format';
import { AppText } from '@/components/ui/AppText';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';

interface DatePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (isoDate: string) => void;
  value?: string | null;
  /** Prima data disponibile nello storico. */
  minDate?: string;
  /** Ultima data disponibile (per difetto: oggi). */
  maxDate?: string;
  title?: string;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Selettore di data a calendario.
 *
 * Scritto su misura anziché usare il picker nativo di sistema: serve poter
 * DISABILITARE le date fuori dallo storico disponibile e mostrare scorciatoie
 * utili ("oggi", "un anno fa"), cosa che il componente di sistema non consente.
 * Il risultato è anche identico su Android e iOS.
 */
export function DatePickerSheet({
  visible,
  onClose,
  onSelect,
  value,
  minDate,
  maxDate,
  title = 'Scegli una data',
}: DatePickerSheetProps) {
  const theme = useTheme();

  const today = useMemo(() => new Date(), []);
  const min = minDate ? parseDate(minDate) : null;
  const max = maxDate ? parseDate(maxDate) : today;
  const selected = value ? parseDate(value) : null;

  const [cursor, setCursor] = useState<Date>(() => startOfMonth(selected ?? max));

  const cells = useMemo(() => {
    const first = startOfMonth(cursor);
    const offset = (first.getDay() + 6) % 7; // settimana che inizia di lunedì
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();

    const result: (Date | null)[] = Array.from({ length: offset }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      result.push(new Date(cursor.getFullYear(), cursor.getMonth(), day));
    }
    while (result.length % 7 !== 0) result.push(null);
    return result;
  }, [cursor]);

  const isDisabled = (date: Date): boolean => {
    if (min && date < min) return true;
    if (max && date > max) return true;
    return false;
  };

  const canGoBack = !min || startOfMonth(cursor) > startOfMonth(min);
  const canGoForward = !max || addMonths(cursor, 1) <= startOfMonth(max);

  const pick = (date: Date) => {
    onSelect(toISODate(date));
    onClose();
  };

  const shortcuts = useMemo(() => {
    const base = max ?? today;
    const candidates = [
      { label: 'Oggi', date: base },
      { label: '1 mese fa', date: new Date(base.getFullYear(), base.getMonth() - 1, base.getDate()) },
      { label: '6 mesi fa', date: new Date(base.getFullYear(), base.getMonth() - 6, base.getDate()) },
      { label: '1 anno fa', date: new Date(base.getFullYear() - 1, base.getMonth(), base.getDate()) },
      { label: 'Inizio anno', date: new Date(base.getFullYear(), 0, 1) },
    ];
    return candidates.filter((item) => !isDisabled(item.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [max, today, minDate]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} scrollable={false}>
      <View style={{ gap: theme.spacing.base, paddingBottom: theme.spacing.sm }}>
        {/* Navigazione fra i mesi */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            onPress={() => canGoBack && setCursor(addMonths(cursor, -1))}
            disabled={!canGoBack}
            hitSlop={12}
            accessibilityLabel="Mese precedente"
            style={{ opacity: canGoBack ? 1 : 0.3, padding: 6 }}
          >
            <Feather name="chevron-left" size={22} color={theme.colors.text} />
          </Pressable>

          <AppText variant="headline">
            {formatMonthName(cursor.getMonth())} {cursor.getFullYear()}
          </AppText>

          <Pressable
            onPress={() => canGoForward && setCursor(addMonths(cursor, 1))}
            disabled={!canGoForward}
            hitSlop={12}
            accessibilityLabel="Mese successivo"
            style={{ opacity: canGoForward ? 1 : 0.3, padding: 6 }}
          >
            <Feather name="chevron-right" size={22} color={theme.colors.text} />
          </Pressable>
        </View>

        {/* Intestazione dei giorni */}
        <View style={{ flexDirection: 'row' }}>
          {WEEKDAYS_SHORT.map((day, index) => (
            <View key={`${day}-${index}`} style={{ flex: 1, alignItems: 'center' }}>
              <AppText variant="micro" tone="faint">
                {day}
              </AppText>
            </View>
          ))}
        </View>

        {/* Griglia dei giorni */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {cells.map((date, index) => {
            if (!date) return <View key={`empty-${index}`} style={{ width: `${100 / 7}%`, height: 44 }} />;

            const disabled = isDisabled(date);
            const isSelected = selected ? sameDay(date, selected) : false;
            const isToday = sameDay(date, today);

            return (
              <Pressable
                key={toISODate(date)}
                onPress={() => !disabled && pick(date)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={toISODate(date)}
                accessibilityState={{ selected: isSelected, disabled }}
                style={({ pressed }) => ({
                  width: `${100 / 7}%`,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSelected ? theme.colors.brand : 'transparent',
                    borderWidth: !isSelected && isToday ? 1 : 0,
                    borderColor: theme.colors.borderStrong,
                  }}
                >
                  <AppText
                    variant="caption"
                    style={{
                      color: isSelected
                        ? theme.colors.onBrand
                        : disabled
                          ? theme.colors.textFaint
                          : theme.colors.text,
                      opacity: disabled ? 0.4 : 1,
                      fontWeight: isSelected || isToday ? '600' : '400',
                    }}
                  >
                    {date.getDate()}
                  </AppText>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Scorciatoie */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {shortcuts.map((shortcut) => (
            <Pressable
              key={shortcut.label}
              onPress={() => pick(shortcut.date)}
              style={({ pressed }) => ({
                paddingHorizontal: theme.spacing.md,
                height: 34,
                borderRadius: theme.radius.pill,
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surfaceAlt,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <AppText variant="label" tone="muted">
                {shortcut.label}
              </AppText>
            </Pressable>
          ))}
        </View>

        <Button label="Annulla" onPress={onClose} variant="secondary" />
      </View>
    </BottomSheet>
  );
}
