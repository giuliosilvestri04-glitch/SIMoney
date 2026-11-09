import React, { useCallback, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { useTheme } from '@/lib/theme-context';
import { formatCurrency, formatDateShort, formatDateLong } from '@/lib/format';
import { AppText } from '@/components/ui/AppText';

export interface ChartPoint {
  date: string;
  totalValue: number;
}

interface LineChartProps {
  points: ChartPoint[];
  currency?: string;
  height?: number;
  /** Colore della linea; per difetto segue il segno della performance. */
  color?: string;
  /** Riga tratteggiata sul valore iniziale del periodo. */
  showBaseline?: boolean;
  showAxisLabels?: boolean;
  /** Notifica il punto sotto il dito, per aggiornare l'intestazione. */
  onScrub?: (point: ChartPoint | null) => void;
  interactive?: boolean;
}

const PADDING_TOP = 14;
const PADDING_BOTTOM = 6;

/**
 * Grafico dell'evoluzione del patrimonio.
 *
 * Scritto su misura con `react-native-svg` invece di usare una libreria di
 * charting: il disegno richiesto è semplice, e così l'app non si porta dietro
 * un motore grafico che peserebbe sull'avvio.
 *
 * È INTERATTIVO: tenendo il dito sul grafico compare il mirino con il valore
 * del giorno, il gesto tipico delle app finanziarie.
 */
export function LineChart({
  points,
  currency = 'EUR',
  height = 180,
  color,
  showBaseline = true,
  showAxisLabels = true,
  onScrub,
  interactive = true,
}: LineChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const lastHapticIndex = useRef<number | null>(null);

  const values = useMemo(() => points.map((point) => point.totalValue), [points]);

  const geometry = useMemo(() => {
    if (points.length < 2 || width <= 0) return null;

    const min = Math.min(...values);
    const max = Math.max(...values);
    // Margine verticale: la linea non deve mai toccare i bordi.
    const span = max - min || Math.max(1, max * 0.01);
    const padded = { min: min - span * 0.12, max: max + span * 0.12 };
    const plotHeight = height - PADDING_TOP - PADDING_BOTTOM;

    const x = (index: number) => (index / (points.length - 1)) * width;
    const y = (value: number) =>
      PADDING_TOP + plotHeight - ((value - padded.min) / (padded.max - padded.min)) * plotHeight;

    const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(2)},${y(point.totalValue).toFixed(2)}`).join(' ');
    const area = `${line} L${width.toFixed(2)},${height - PADDING_BOTTOM} L0,${height - PADDING_BOTTOM} Z`;

    return { x, y, line, area, min, max };
  }, [points, values, width, height]);

  const rising = values.length > 1 && values[values.length - 1] >= values[0];
  const lineColor = color ?? (rising ? theme.colors.positive : theme.colors.negative);

  const handleScrub = useCallback(
    (locationX: number) => {
      if (!geometry || points.length < 2 || width <= 0) return;
      const ratio = Math.max(0, Math.min(1, locationX / width));
      const index = Math.round(ratio * (points.length - 1));

      if (index !== lastHapticIndex.current) {
        lastHapticIndex.current = index;
        if (Platform.OS !== 'web') void Haptics.selectionAsync();
      }

      setActiveIndex(index);
      onScrub?.(points[index]);
    },
    [geometry, onScrub, points, width],
  );

  const endScrub = useCallback(() => {
    setActiveIndex(null);
    lastHapticIndex.current = null;
    onScrub?.(null);
  }, [onScrub]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => interactive,
        onMoveShouldSetPanResponder: () => interactive,
        // Il gesto orizzontale appartiene al grafico, quello verticale allo scroll.
        onMoveShouldSetPanResponderCapture: (_event, gesture) =>
          interactive && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: (event) => handleScrub(event.nativeEvent.locationX),
        onPanResponderMove: (event) => handleScrub(event.nativeEvent.locationX),
        onPanResponderRelease: endScrub,
        onPanResponderTerminate: endScrub,
      }),
    [endScrub, handleScrub, interactive],
  );

  const activePoint = activeIndex !== null ? points[activeIndex] : null;
  const gradientId = 'chartFill';

  return (
    <View>
      {/* Valore sotto il dito: appare sopra il grafico senza spostarne il layout. */}
      <View style={{ height: 34, justifyContent: 'center' }}>
        {activePoint ? (
          <View style={{ gap: 1 }}>
            <AppText variant="amountSmall">{formatCurrency(activePoint.totalValue, currency, 0)}</AppText>
            <AppText variant="micro" tone="faint">
              {formatDateLong(activePoint.date).toUpperCase()}
            </AppText>
          </View>
        ) : (
          <AppText variant="micro" tone="faint" uppercase>
            {interactive ? 'Tieni premuto sul grafico per i dettagli' : 'Andamento del periodo'}
          </AppText>
        )}
      </View>

      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={{ height, width: '100%' }}
        {...panResponder.panHandlers}
      >
        {geometry && (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={lineColor} stopOpacity={theme.dark ? 0.28 : 0.2} />
                <Stop offset="1" stopColor={lineColor} stopOpacity={0} />
              </LinearGradient>
            </Defs>

            <Path d={geometry.area} fill={`url(#${gradientId})`} />

            {showBaseline && (
              <Line
                x1={0}
                y1={geometry.y(values[0])}
                x2={width}
                y2={geometry.y(values[0])}
                stroke={theme.colors.chartGrid}
                strokeWidth={1}
                strokeDasharray="3 4"
              />
            )}

            <Path
              d={geometry.line}
              stroke={lineColor}
              strokeWidth={2.2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {activeIndex !== null && (
              <>
                <Line
                  x1={geometry.x(activeIndex)}
                  y1={PADDING_TOP - 6}
                  x2={geometry.x(activeIndex)}
                  y2={height - PADDING_BOTTOM}
                  stroke={theme.colors.borderStrong}
                  strokeWidth={1}
                />
                <Circle
                  cx={geometry.x(activeIndex)}
                  cy={geometry.y(values[activeIndex])}
                  r={7}
                  fill={lineColor}
                  fillOpacity={0.18}
                />
                <Circle
                  cx={geometry.x(activeIndex)}
                  cy={geometry.y(values[activeIndex])}
                  r={4}
                  fill={lineColor}
                  stroke={theme.colors.surface}
                  strokeWidth={2}
                />
              </>
            )}

            {/* Punto finale: ancora visivamente la serie al valore corrente. */}
            {activeIndex === null && (
              <Circle
                cx={geometry.x(points.length - 1)}
                cy={geometry.y(values[values.length - 1])}
                r={3.5}
                fill={lineColor}
                stroke={theme.colors.surface}
                strokeWidth={2}
              />
            )}
          </Svg>
        )}
      </View>

      {showAxisLabels && points.length > 1 && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          <AppText variant="micro" tone="faint">
            {formatDateShort(points[0].date)}
          </AppText>
          <AppText variant="micro" tone="faint">
            {formatDateShort(points[Math.floor(points.length / 2)].date)}
          </AppText>
          <AppText variant="micro" tone="faint">
            {formatDateShort(points[points.length - 1].date)}
          </AppText>
        </View>
      )}
    </View>
  );
}
