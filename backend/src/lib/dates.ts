import { badRequest } from './errors.js';
import type { HistoryRange } from '../domain/enums.js';

/**
 * Tutte le date del dominio sono normalizzate a mezzanotte UTC: lo storico è
 * giornaliero e deve restituire lo stesso valore indipendentemente dal fuso
 * orario dello smartphone.
 */

export function startOfUTCDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

/** `YYYY-MM-DD` */
export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseISODate(value: string, field = 'date'): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw badRequest(`Formato data non valido per "${field}": atteso YYYY-MM-DD.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw badRequest(`Data non valida per "${field}": ${value}`);
  }
  return parsed;
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export interface ResolvedRange {
  range: HistoryRange;
  from: Date;
  to: Date;
}

/**
 * Traduce il selettore di periodo della UI (1D, 1W, ... MAX, oppure from/to)
 * in un intervallo di date concreto.
 *
 * @param reference data "oggi" del sistema (ultimo giorno disponibile)
 * @param earliest  prima data disponibile nello storico (per MAX)
 */
export function resolveRange(
  range: HistoryRange | undefined,
  reference: Date,
  earliest: Date,
  custom?: { from?: string; to?: string },
): ResolvedRange {
  const to = custom?.to ? parseISODate(custom.to, 'to') : reference;

  if (custom?.from) {
    const from = parseISODate(custom.from, 'from');
    if (from > to) throw badRequest('Il parametro "from" deve precedere "to".');
    return { range: 'CUSTOM', from, to };
  }

  const effective: HistoryRange = range ?? '1Y';
  let from: Date;

  switch (effective) {
    case '1D':
      from = addDays(to, -1);
      break;
    case '1W':
      from = addDays(to, -7);
      break;
    case '1M':
      from = addMonths(to, -1);
      break;
    case '3M':
      from = addMonths(to, -3);
      break;
    case '6M':
      from = addMonths(to, -6);
      break;
    case 'YTD':
      from = new Date(Date.UTC(to.getUTCFullYear(), 0, 1));
      break;
    case '1Y':
      from = addMonths(to, -12);
      break;
    case 'MAX':
    case 'CUSTOM':
      from = earliest;
      break;
    default:
      from = addMonths(to, -12);
  }

  if (from < earliest) from = earliest;
  return { range: effective, from, to };
}

/**
 * Riduce una serie a `maxPoints` mantenendo primo e ultimo punto.
 * Serve a tenere leggeri i grafici sullo smartphone: 730 punti giornalieri
 * diventano ~120, senza perdere la forma della curva.
 */
export function downsample<T>(points: T[], maxPoints: number): T[] {
  if (points.length <= maxPoints || maxPoints < 2) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  const result: T[] = [];
  for (let i = 0; i < maxPoints; i += 1) {
    result.push(points[Math.round(i * step)]);
  }
  // Garantisce che l'ultimo punto reale sia sempre presente.
  result[result.length - 1] = points[points.length - 1];
  return result;
}
