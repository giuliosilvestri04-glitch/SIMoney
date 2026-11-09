import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { useTheme } from '@/lib/theme-context';
import { formatCurrencyShort, formatPercent } from '@/lib/format';
import { AppText } from '@/components/ui/AppText';

export interface DonutSlice {
  key: string;
  label: string;
  colorHex: string;
  value: number;
  weightPct: number;
}

interface DonutChartProps {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  currency?: string;
  /** Etichetta al centro quando nessuna fetta è selezionata. */
  centerLabel?: string;
  centerValue?: string;
  onSelect?: (slice: DonutSlice | null) => void;
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDegrees: number) {
  const angle = ((angleDegrees - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}

/** Settore ad anello fra due angoli. */
function arcPath(cx: number, cy: number, outer: number, inner: number, start: number, end: number): string {
  const startOuter = polarToCartesian(cx, cy, outer, end);
  const endOuter = polarToCartesian(cx, cy, outer, start);
  const startInner = polarToCartesian(cx, cy, inner, start);
  const endInner = polarToCartesian(cx, cy, inner, end);
  const largeArc = end - start <= 180 ? '0' : '1';

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outer} ${outer} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${inner} ${inner} 0 ${largeArc} 1 ${endInner.x} ${endInner.y}`,
    'Z',
  ].join(' ');
}

/**
 * Ciambella dell'asset allocation.
 *
 * Perché una ciambella e non una torta: il centro ospita il totale, e su
 * schermo piccolo il confronto fra spessori è più leggibile di quello fra
 * spicchi. Toccando una fetta si isola la categoria.
 */
export function DonutChart({
  slices,
  size = 168,
  thickness = 26,
  currency = 'EUR',
  centerLabel = 'Totale',
  centerValue,
  onSelect,
}: DonutChartProps) {
  const theme = useTheme();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const visible = useMemo(() => slices.filter((slice) => slice.weightPct > 0), [slices]);
  const total = useMemo(() => visible.reduce((sum, slice) => sum + slice.value, 0), [visible]);

  const segments = useMemo(() => {
    const GAP = visible.length > 1 ? 1.6 : 0;
    let cursor = 0;
    return visible.map((slice) => {
      const sweep = (slice.weightPct / 100) * 360;
      const start = cursor;
      const end = cursor + sweep;
      cursor = end;
      return { slice, start: start + GAP / 2, end: Math.max(start + GAP / 2, end - GAP / 2) };
    });
  }, [visible]);

  const selected = visible.find((slice) => slice.key === selectedKey) ?? null;
  const center = size / 2;
  const outer = center;
  const inner = center - thickness;

  const handlePress = (key: string) => {
    const next = selectedKey === key ? null : key;
    setSelectedKey(next);
    onSelect?.(visible.find((slice) => slice.key === next) ?? null);
  };

  if (visible.length === 0) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <AppText variant="caption" tone="faint">
          Nessun dato
        </AppText>
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G>
          {segments.map(({ slice, start, end }) => {
            const dimmed = selectedKey !== null && selectedKey !== slice.key;
            return (
              <Path
                key={slice.key}
                d={arcPath(center, center, outer, inner, start, end)}
                fill={slice.colorHex}
                opacity={dimmed ? 0.22 : 1}
                onPress={() => handlePress(slice.key)}
              />
            );
          })}
          <Circle cx={center} cy={center} r={inner} fill={theme.colors.surface} />
        </G>
      </Svg>

      {/* Centro: totale, oppure la categoria selezionata. */}
      <Pressable
        onPress={() => {
          setSelectedKey(null);
          onSelect?.(null);
        }}
        style={{
          position: 'absolute',
          top: thickness,
          left: thickness,
          right: thickness,
          bottom: thickness,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        {selected ? (
          <>
            <AppText variant="micro" tone="faint" uppercase numberOfLines={1}>
              {selected.label}
            </AppText>
            <AppText variant="headline" numberOfLines={1}>
              {formatPercent(selected.weightPct, 1, false)}
            </AppText>
            <AppText variant="micro" tone="muted" numberOfLines={1}>
              {formatCurrencyShort(selected.value, currency)}
            </AppText>
          </>
        ) : (
          <>
            <AppText variant="micro" tone="faint" uppercase>
              {centerLabel}
            </AppText>
            <AppText variant="bodyStrong" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {centerValue ?? formatCurrencyShort(total, currency)}
            </AppText>
          </>
        )}
      </Pressable>
    </View>
  );
}
