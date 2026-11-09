import { env } from '../../config/env.js';
import { notImplemented, serviceUnavailable } from '../../lib/errors.js';

/**
 * ============================================================================
 * CLIENT GUARDIAN — PREDISPOSIZIONE, NON IMPLEMENTAZIONE
 * ============================================================================
 *
 * IMPORTANTE
 * ----------
 * Le API Guardian NON sono disponibili in questa fase. Di conseguenza:
 *
 *   • qui NON è stato inventato alcun endpoint, percorso o schema di risposta;
 *   • questo client NON effettua alcuna chiamata di rete;
 *   • nessuna parte del prototipo dipende da questo file per funzionare.
 *
 * Cosa c'è, quindi: il punto esatto in cui, in futuro, andrà scritto il codice
 * di trasporto (autenticazione, timeout, retry, gestione errori), già isolato
 * dal resto dell'applicazione.
 *
 * COSA SERVIRÀ PER COMPLETARLO
 * ----------------------------
 *  1. URL di base del servizio            → GUARDIAN_BASE_URL
 *  2. Credenziali / modalità di auth       → GUARDIAN_API_KEY (o OAuth)
 *  3. Documentazione degli endpoint reali  → per implementare `request()`
 *  4. Mappatura identificativi cliente     → prototipo ↔ Guardian
 *
 * Finché questi elementi non sono noti, `DATA_PROVIDER` resta `mock`.
 */
export class GuardianClient {
  get isConfigured(): boolean {
    return env.guardian.isConfigured;
  }

  /**
   * Punto unico di uscita verso Guardian.
   *
   * Implementazione futura (traccia):
   *   const response = await fetch(`${env.guardian.baseUrl}${path}`, {
   *     headers: { Authorization: `Bearer ${env.guardian.apiKey}` },
   *     signal: AbortSignal.timeout(env.guardian.timeoutMs),
   *   });
   *   → tradurre gli errori HTTP in AppError (503/502) perché l'app mobile
   *     possa mostrare un messaggio comprensibile invece di una schermata vuota.
   */
  async request<T>(path: string): Promise<T> {
    if (!this.isConfigured) {
      throw serviceUnavailable(
        'Integrazione Guardian non configurata. Il prototipo funziona con la sorgente dati "mock".',
        'GUARDIAN_NOT_CONFIGURED',
      );
    }
    throw notImplemented(
      `Chiamata Guardian non implementata (${path}): in attesa della documentazione delle API reali.`,
    );
  }

  /** Verifica di raggiungibilità. Non esegue rete finché il client non è implementato. */
  async ping(): Promise<boolean> {
    return false;
  }
}
