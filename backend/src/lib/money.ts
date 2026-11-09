/**
 * Utilità monetarie.
 *
 * Nel prototipo gli importi sono numeri in virgola mobile: ogni valore che esce
 * da un calcolo passa da qui, così l'arrotondamento è centralizzato in un solo
 * punto. In produzione questo file sarebbe il punto di sostituzione verso
 * interi in centesimi o Decimal.
 */

/** Arrotonda a 2 decimali (importi). */
export function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Arrotonda a 2 decimali (percentuali). */
export function pct(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Arrotonda a 4 decimali (quantità/prezzi unitari). */
export function qty(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

export function sum(values: number[]): number {
  return money(values.reduce((acc, v) => acc + v, 0));
}

/** Variazione percentuale da `from` a `to`. Restituisce 0 se `from` è nullo. */
export function changePct(from: number, to: number): number {
  if (!from) return 0;
  return pct(((to - from) / from) * 100);
}

/**
 * Normalizza un insieme di pesi percentuali affinché la somma sia esattamente 100.
 * Evita che la UI mostri "99,98%" in un grafico a torta.
 */
export function normalizeWeights(weights: number[]): number[] {
  const rounded = weights.map((w) => pct(w));
  const total = rounded.reduce((acc, w) => acc + w, 0);
  if (rounded.length === 0 || total === 0) return rounded;
  const diff = pct(100 - total);
  let maxIndex = 0;
  for (let i = 1; i < rounded.length; i += 1) {
    if (rounded[i] > rounded[maxIndex]) maxIndex = i;
  }
  rounded[maxIndex] = pct(rounded[maxIndex] + diff);
  return rounded;
}
