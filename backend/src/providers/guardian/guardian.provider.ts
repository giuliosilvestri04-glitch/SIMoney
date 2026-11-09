import { notImplemented } from '../../lib/errors.js';
import { GuardianClient } from './guardian.client.js';
import type {
  AllocationSlice,
  AssetClassRef,
  ClientValue,
  HistoryQuery,
  HoldingDTO,
  PagedResult,
  PortfolioDataProvider,
  PortfolioHistory,
  PortfolioSnapshotDTO,
  PortfolioSummary,
  ProviderStatus,
  TransactionDTO,
} from '../types.js';

/**
 * ============================================================================
 * PROVIDER GUARDIAN — SCHELETRO PER L'INTEGRAZIONE FUTURA
 * ============================================================================
 *
 * Implementa lo STESSO contratto del provider mock (`PortfolioDataProvider`).
 * Questo è l'unico punto in cui, domani, i dati Guardian verranno tradotti nei
 * DTO di dominio del prototipo.
 *
 * Conseguenza architetturale: attivare Guardian significherà
 *
 *      DATA_PROVIDER=guardian
 *
 * e nient'altro. Servizi, rotte REST e app mobile restano invariati.
 *
 * Oggi ogni metodo fallisce in modo esplicito e controllato: NON viene mai
 * istanziato con la configurazione predefinita e NON esegue chiamate di rete.
 */
export class GuardianDataProvider implements PortfolioDataProvider {
  readonly name = 'guardian' as const;

  private readonly client: GuardianClient;

  constructor(client = new GuardianClient()) {
    this.client = client;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.client.isConfigured) return false;
    return this.client.ping();
  }

  async status(): Promise<ProviderStatus> {
    return {
      name: 'guardian',
      available: await this.isAvailable(),
      configured: this.client.isConfigured,
      readOnly: true,
      description:
        'Integrazione Guardian prevista ma non disponibile in questa fase del prototipo. ' +
        'Struttura pronta: mancano URL, credenziali e documentazione degli endpoint reali.',
    };
  }

  // --- Metodi del contratto -------------------------------------------------
  // Ognuno indica cosa dovrà fare quando le API saranno disponibili.

  /** Futuro: mappare le categorie Guardian sulle asset class configurate del prototipo. */
  async getAssetClasses(): Promise<AssetClassRef[]> {
    throw this.pending('getAssetClasses');
  }

  /** Futuro: leggere la posizione corrente e comporre `PortfolioSummary`. */
  async getPortfolioSummary(_clientId: string): Promise<PortfolioSummary> {
    throw this.pending('getPortfolioSummary');
  }

  /** Futuro: leggere la serie storica e applicare lo stesso downsampling del mock. */
  async getHistory(_clientId: string, _query: HistoryQuery): Promise<PortfolioHistory> {
    throw this.pending('getHistory');
  }

  /** Futuro: valorizzazione puntuale alla data richiesta dal calendario dell'app. */
  async getSnapshotAt(_clientId: string, _date: string): Promise<PortfolioSnapshotDTO> {
    throw this.pending('getSnapshotAt');
  }

  async getAllocation(_clientId: string, _date?: string): Promise<AllocationSlice[]> {
    throw this.pending('getAllocation');
  }

  async getHoldings(_clientId: string): Promise<HoldingDTO[]> {
    throw this.pending('getHoldings');
  }

  async getTransactions(
    _clientId: string,
    _query: { page?: number; pageSize?: number },
  ): Promise<PagedResult<TransactionDTO>> {
    throw this.pending('getTransactions');
  }

  async getAggregatedHistory(_clientIds: string[], _query: HistoryQuery): Promise<PortfolioHistory> {
    throw this.pending('getAggregatedHistory');
  }

  /** Futuro: valori correnti in blocco, per liste clienti e analytics. */
  async getLatestValues(_clientIds: string[]): Promise<ClientValue[]> {
    throw this.pending('getLatestValues');
  }

  async getAggregatedAllocation(_clientIds: string[]): Promise<AllocationSlice[]> {
    throw this.pending('getAggregatedAllocation');
  }

  private pending(operation: string) {
    return notImplemented(
      `Operazione "${operation}" non disponibile: il provider Guardian sarà implementato quando ` +
        'le API reali e le credenziali saranno accessibili. Usare DATA_PROVIDER=mock.',
    );
  }
}
