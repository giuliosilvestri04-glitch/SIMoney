/**
 * ============================================================================
 * PUNTO DI ASTRAZIONE DELLA SORGENTE DATI  (architettura Guardian)
 * ============================================================================
 *
 * Questo file definisce il CONTRATTO che il resto dell'applicazione conosce.
 * I servizi (portfolio, analytics, proposte) parlano esclusivamente con
 * `PortfolioDataProvider` e con i DTO qui sotto: non sanno, e non devono
 * sapere, se i dati arrivino dal database del prototipo, da Guardian o da una
 * sorgente futura.
 *
 *   Portfolio Service
 *          ↓
 *   PortfolioDataProvider        ← questo file
 *     ├── MockDataProvider       → database del prototipo   (ATTIVO oggi)
 *     └── GuardianDataProvider   → Guardian API             (integrazione futura)
 *
 * I DTO sono modellati sul DOMINIO e sui bisogni dell'app mobile, NON sulla
 * forma delle risposte Guardian, che oggi non è nota. Quando le API reali
 * saranno disponibili, la traduzione avverrà interamente dentro
 * `guardian/guardian.provider.ts`: nessun servizio, nessuna rotta e nessuna
 * schermata dell'app dovrà cambiare.
 */

import type { HistoryRange, InstrumentType, TransactionType } from '../domain/enums.js';

// ---------------------------------------------------------------------------
// DTO di dominio
// ---------------------------------------------------------------------------

export interface AssetClassRef {
  key: string;
  label: string;
  colorHex: string;
  orderIndex: number;
}

export interface AllocationSlice extends AssetClassRef {
  value: number;
  weightPct: number;
}

export interface PortfolioSummary {
  portfolioId: string;
  clientId: string;
  currency: string;
  asOf: string;
  totalValue: number;
  investedValue: number;
  cashValue: number;
  /** Utile/perdita complessiva rispetto al capitale investito. */
  pnlAbs: number;
  pnlPct: number;
  /** Variazioni pronte per la home dell'app: nessun calcolo lato client. */
  changes: {
    day: PerformanceChange;
    week: PerformanceChange;
    month: PerformanceChange;
    year: PerformanceChange;
  };
  holdingsCount: number;
  allocation: AllocationSlice[];
}

export interface PerformanceChange {
  absolute: number;
  percent: number;
}

export interface HistoryPoint {
  date: string;
  totalValue: number;
}

export interface PortfolioHistory {
  range: HistoryRange;
  from: string;
  to: string;
  currency: string;
  points: HistoryPoint[];
  /** Variazione tra il primo e l'ultimo punto del periodo richiesto. */
  change: PerformanceChange;
  min: number;
  max: number;
  /** Numero di punti giornalieri prima del downsampling. */
  sourcePoints: number;
}

export interface PortfolioSnapshotDTO {
  date: string;
  currency: string;
  totalValue: number;
  investedValue: number;
  cashValue: number;
  pnlAbs: number;
  pnlPct: number;
  allocation: AllocationSlice[];
  /** Variazione rispetto al giorno precedente disponibile. */
  changeFromPreviousDay: PerformanceChange | null;
  /** True se la data richiesta non esisteva e si è usata la più vicina precedente. */
  approximated: boolean;
}

export interface HoldingDTO {
  id: string;
  instrument: {
    isin: string;
    name: string;
    type: InstrumentType;
    issuer: string;
    currency: string;
  };
  assetClass: AssetClassRef;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  costBasis: number;
  marketValue: number;
  weightPct: number;
  pnlAbs: number;
  pnlPct: number;
  openedAt: string;
}

export interface TransactionDTO {
  id: string;
  date: string;
  type: TransactionType;
  amount: number;
  quantity: number | null;
  price: number | null;
  currency: string;
  description: string;
  instrument: { isin: string; name: string } | null;
}

export interface PagedResult<T> {
  items: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number; hasNext: boolean };
}

export interface HistoryQuery {
  range?: HistoryRange;
  from?: string;
  to?: string;
  /** Punti massimi restituiti: protegge il grafico mobile. */
  maxPoints?: number;
}

export interface ProviderStatus {
  name: DataProviderName;
  available: boolean;
  /** Descrizione leggibile mostrata da `GET /system/data-source`. */
  description: string;
  configured: boolean;
  readOnly: boolean;
}

export type DataProviderName = 'mock' | 'guardian';

// ---------------------------------------------------------------------------
// Contratto
// ---------------------------------------------------------------------------

/**
 * Sorgente dei dati di patrimonio di un cliente.
 *
 * Regole per qualsiasi implementazione futura (incluso Guardian):
 *  - `clientId` è l'identificativo INTERNO del prototipo. La mappatura verso un
 *    eventuale identificativo esterno è responsabilità del provider.
 *  - Gli importi sono espressi nella valuta indicata dal DTO, già arrotondati.
 *  - Le date sono stringhe `YYYY-MM-DD`.
 *  - Un provider non deve mai lanciare errori di rete grezzi: deve tradurli in
 *    `AppError` (503 / 501) perché l'app mobile possa mostrare un messaggio.
 */
export interface PortfolioDataProvider {
  readonly name: DataProviderName;

  /** Controllo di disponibilità. Non deve mai lanciare eccezioni. */
  isAvailable(): Promise<boolean>;

  status(): Promise<ProviderStatus>;

  /** Elenco delle asset class configurate (categorie NON hard-coded). */
  getAssetClasses(): Promise<AssetClassRef[]>;

  getPortfolioSummary(clientId: string): Promise<PortfolioSummary>;

  getHistory(clientId: string, query: HistoryQuery): Promise<PortfolioHistory>;

  /** Patrimonio a una data specifica: alimenta il calendario/storico dell'app. */
  getSnapshotAt(clientId: string, date: string): Promise<PortfolioSnapshotDTO>;

  /** Asset allocation, opzionalmente a una data passata. */
  getAllocation(clientId: string, date?: string): Promise<AllocationSlice[]>;

  getHoldings(clientId: string): Promise<HoldingDTO[]>;

  getTransactions(
    clientId: string,
    query: { page?: number; pageSize?: number },
  ): Promise<PagedResult<TransactionDTO>>;

  /**
   * Serie aggregata su più clienti: alimenta le analytics del boss e del
   * consulente senza N chiamate separate.
   */
  getAggregatedHistory(clientIds: string[], query: HistoryQuery): Promise<PortfolioHistory>;

  /**
   * Valore corrente del patrimonio per un insieme di clienti.
   * Evita N chiamate a `getPortfolioSummary` nelle liste e nelle analytics.
   */
  getLatestValues(clientIds: string[]): Promise<ClientValue[]>;

  /** Asset allocation aggregata su più clienti (allocazione aziendale/di portafoglio clienti). */
  getAggregatedAllocation(clientIds: string[]): Promise<AllocationSlice[]>;
}

export interface ClientValue {
  clientId: string;
  portfolioId: string;
  currency: string;
  asOf: string;
  totalValue: number;
  pnlAbs: number;
  pnlPct: number;
  /** Variazione rispetto a un anno prima: usata nella lista clienti del consulente. */
  yearChangePct: number;
}
