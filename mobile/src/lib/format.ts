/**
 * Formattazione italiana di importi, percentuali e date.
 * Unico punto di verità: nessuna schermata formatta numeri per conto proprio.
 */

const CURRENCY_SYMBOLS: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', CHF: 'CHF' };

function symbolOf(currency = 'EUR'): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

/** `€ 247.350,00` */
export function formatCurrency(value: number, currency = 'EUR', decimals = 2): string {
  const amount = Math.abs(value).toLocaleString('it-IT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${value < 0 ? '−' : ''}${symbolOf(currency)} ${amount}`;
}

/** `€ 247.350` — per i titoli grandi, dove i centesimi sono rumore. */
export function formatCurrencyCompact(value: number, currency = 'EUR'): string {
  return formatCurrency(value, currency, 0);
}

/** `€ 1,2 Mln` — per le etichette degli assi e i KPI aziendali. */
export function formatCurrencyShort(value: number, currency = 'EUR'): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  const symbol = symbolOf(currency);
  if (abs >= 1_000_000_000) return `${sign}${symbol} ${(abs / 1_000_000_000).toLocaleString('it-IT', { maximumFractionDigits: 1 })} Mld`;
  if (abs >= 1_000_000) return `${sign}${symbol} ${(abs / 1_000_000).toLocaleString('it-IT', { maximumFractionDigits: 1 })} Mln`;
  if (abs >= 1_000) return `${sign}${symbol} ${(abs / 1_000).toLocaleString('it-IT', { maximumFractionDigits: abs >= 10_000 ? 0 : 1 })} mila`;
  return `${sign}${symbol} ${abs.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`;
}

/** `+8,42%` — il segno è sempre esplicito: è l'informazione principale. */
export function formatPercent(value: number, decimals = 2, explicitSign = true): string {
  const sign = value > 0 && explicitSign ? '+' : value < 0 ? '−' : '';
  const amount = Math.abs(value).toLocaleString('it-IT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${sign}${amount}%`;
}

/** `+€ 1.240,50` */
export function formatSignedCurrency(value: number, currency = 'EUR', decimals = 2): string {
  const formatted = formatCurrency(Math.abs(value), currency, decimals);
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `−${formatted}`;
  return formatted;
}

export function formatQuantity(value: number): string {
  return value.toLocaleString('it-IT', { maximumFractionDigits: 4 });
}

export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('it-IT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ---------------------------------------------------------------------------
// Date
// ---------------------------------------------------------------------------

const MONTHS = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

export const WEEKDAYS_SHORT = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

/** Converte `YYYY-MM-DD` o ISO in Date, senza scarti di fuso orario. */
export function parseDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}

/** `YYYY-MM-DD` (formato richiesto dalle API) */
export function toISODate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** `15/06/2026` */
export function formatDate(value: string | Date): string {
  const date = parseDate(value);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

/** `15 giugno 2026` */
export function formatDateLong(value: string | Date): string {
  const date = parseDate(value);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** `15 giu` */
export function formatDateShort(value: string | Date): string {
  const date = parseDate(value);
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

/** `giu 2026` */
export function formatMonthYear(value: string | Date): string {
  const date = parseDate(value);
  return `${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatMonthName(monthIndex: number): string {
  return MONTHS[monthIndex];
}

/** `15/06/2026, 14:32` */
export function formatDateTime(value: string | Date): string {
  const date = parseDate(value);
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `${formatDate(date)}, ${time}`;
}

/** `oggi`, `ieri`, `3 giorni fa`, poi la data. */
export function formatRelative(value: string | Date): string {
  const date = parseDate(value);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return 'oggi';
  if (days === 1) return 'ieri';
  if (days < 7) return `${days} giorni fa`;
  if (days < 30) return `${Math.floor(days / 7)} settimane fa`;
  return formatDate(date);
}

/** `fra 11 giorni`, `scade domani`, `scaduta` */
export function formatExpiry(days: number | null): string {
  if (days === null) return '';
  if (days <= 0) return 'scaduta';
  if (days === 1) return 'scade domani';
  return `scade fra ${days} giorni`;
}

export function initialsOf(fullName: string): string {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
