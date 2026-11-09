import type { FastifyInstance, FastifyRequest } from 'fastify';
import { unauthorized } from '../lib/errors.js';
import { requireClientId } from '../services/access.service.js';
import {
  getAllocation,
  getClientHome,
  getClientProfile,
  getHistory,
  getInvestmentDetail,
  getInvestments,
  getSnapshot,
  getSummary,
  getTransactions,
} from '../services/portfolio.service.js';
import {
  getClientProposal,
  listClientProposals,
  respondToProposal,
} from '../services/proposal.service.js';
import { listClientDocuments } from '../services/document.service.js';
import {
  dateQuerySchema,
  historyQuerySchema,
  idParamSchema,
  okWithErrors,
  pageQueryProps,
  proposalResponseBodySchema,
  proposalStatusEnum,
  requiredDateQuerySchema,
} from '../http/schemas.js';
import type { HistoryRange, ProposalStatus } from '../domain/enums.js';

/**
 * ============================================================================
 * AREA CLIENTE
 * ============================================================================
 *
 * Nessuna rotta accetta un `clientId`: l'identità del cliente è derivata dal
 * token a ogni richiesta. Modificare un identificativo per vedere i dati di un
 * altro cliente è quindi strutturalmente impossibile (requisito 26).
 */
export default async function clientRoutes(app: FastifyInstance) {
  // Autenticazione + ruolo su tutte le rotte del gruppo.
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', app.requireRole('CLIENT'));

  const clientId = async (request: FastifyRequest) => {
    if (!request.auth) throw unauthorized();
    return requireClientId(request.auth);
  };

  // --- Schermata principale -------------------------------------------------

  app.get(
    '/client/home',
    {
      schema: {
        tags: ['Cliente'],
        summary: 'Home cliente (schermata completa in una sola richiesta)',
        description:
          'Patrimonio, variazioni, mini-grafico 6 mesi, asset allocation, proposte in attesa e ' +
          'attività recenti. Endpoint "screen-oriented": evita 5 chiamate all\'avvio dell\'app.',
        security: [{ bearerAuth: [] }],
        response: okWithErrors('Dati della home'),
      },
    },
    async (request) => ({ data: await getClientHome(await clientId(request)) }),
  );

  app.get(
    '/client/profile',
    {
      schema: {
        tags: ['Cliente'],
        summary: 'Anagrafica del cliente e consulente di riferimento',
        security: [{ bearerAuth: [] }],
        response: okWithErrors('Profilo cliente'),
      },
    },
    async (request) => ({ data: await getClientProfile(await clientId(request)) }),
  );

  // --- Patrimonio -----------------------------------------------------------

  app.get(
    '/client/portfolio/summary',
    {
      schema: {
        tags: ['Cliente'],
        summary: 'Patrimonio totale, variazioni e asset allocation',
        security: [{ bearerAuth: [] }],
        response: okWithErrors('Riepilogo del portafoglio'),
      },
    },
    async (request) => ({ data: await getSummary(await clientId(request)) }),
  );

  app.get<{ Querystring: { range?: HistoryRange; from?: string; to?: string; maxPoints?: number } }>(
    '/client/portfolio/history',
    {
      schema: {
        tags: ['Cliente'],
        summary: 'Evoluzione del patrimonio nel tempo',
        description:
          'Serie storica per il grafico interattivo. Periodi: 1D, 1W, 1M, 3M, 6M, YTD, 1Y, MAX ' +
          'oppure intervallo personalizzato con `from`/`to`. I punti sono ridotti lato server ' +
          '(`maxPoints`) per non appesantire il rendering su smartphone.',
        security: [{ bearerAuth: [] }],
        querystring: historyQuerySchema,
        response: okWithErrors('Serie storica del patrimonio'),
      },
    },
    async (request) => ({ data: await getHistory(await clientId(request), request.query) }),
  );

  app.get<{ Querystring: { date: string } }>(
    '/client/portfolio/snapshot',
    {
      schema: {
        tags: ['Cliente'],
        summary: 'Patrimonio a una data specifica (calendario/storico)',
        description:
          'Restituisce il patrimonio e la sua composizione alla data selezionata. ' +
          'Se la data non ha una rilevazione, viene usata la più recente precedente ' +
          '(`approximated: true`).',
        security: [{ bearerAuth: [] }],
        querystring: requiredDateQuerySchema,
        response: okWithErrors('Fotografia del patrimonio alla data'),
      },
    },
    async (request) => ({ data: await getSnapshot(await clientId(request), request.query.date) }),
  );

  app.get<{ Querystring: { date?: string } }>(
    '/client/portfolio/allocation',
    {
      schema: {
        tags: ['Cliente'],
        summary: 'Asset allocation (corrente o a una data)',
        security: [{ bearerAuth: [] }],
        querystring: dateQuerySchema,
        response: okWithErrors('Ripartizione per asset class'),
      },
    },
    async (request) => ({ data: await getAllocation(await clientId(request), request.query.date) }),
  );

  // --- Investimenti ---------------------------------------------------------

  app.get(
    '/client/investments',
    {
      schema: {
        tags: ['Cliente'],
        summary: 'Elenco degli investimenti',
        description: 'Posizioni con controvalore, peso, prezzo medio, prezzo corrente e P&L.',
        security: [{ bearerAuth: [] }],
        response: okWithErrors('Elenco delle posizioni'),
      },
    },
    async (request) => ({ data: await getInvestments(await clientId(request)) }),
  );

  app.get<{ Params: { id: string } }>(
    '/client/investments/:id',
    {
      schema: {
        tags: ['Cliente'],
        summary: 'Dettaglio di un investimento',
        description: 'Include gli ultimi movimenti collegati allo strumento.',
        security: [{ bearerAuth: [] }],
        params: idParamSchema,
        response: okWithErrors('Dettaglio della posizione'),
      },
    },
    async (request) => ({
      data: await getInvestmentDetail(await clientId(request), request.params.id),
    }),
  );

  app.get<{ Querystring: { page?: number; pageSize?: number } }>(
    '/client/transactions',
    {
      schema: {
        tags: ['Cliente'],
        summary: 'Movimenti del portafoglio',
        security: [{ bearerAuth: [] }],
        querystring: { type: 'object', properties: pageQueryProps, additionalProperties: false },
        response: okWithErrors('Elenco dei movimenti'),
      },
    },
    async (request) => {
      const result = await getTransactions(await clientId(request), request.query);
      return { data: result.items, meta: result.meta };
    },
  );

  // --- Proposte -------------------------------------------------------------

  app.get<{ Querystring: { status?: ProposalStatus; page?: number; pageSize?: number } }>(
    '/client/proposals',
    {
      schema: {
        tags: ['Cliente'],
        summary: 'Proposte di investimento ricevute',
        description: 'Filtrabili per stato: IN ATTESA, ACCETTATA, RIFIUTATA, SCADUTA.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: { status: { type: 'string', enum: proposalStatusEnum }, ...pageQueryProps },
          additionalProperties: false,
        },
        response: okWithErrors('Elenco delle proposte'),
      },
    },
    async (request) => {
      const result = await listClientProposals(await clientId(request), request.query);
      return { data: result.items, meta: result.meta };
    },
  );

  app.get<{ Params: { id: string } }>(
    '/client/proposals/:id',
    {
      schema: {
        tags: ['Cliente'],
        summary: 'Dettaglio di una proposta',
        description:
          'Operazioni proposte, confronto asset allocation attuale/proposta e documenti allegati. ' +
          'La prima apertura registra la presa visione.',
        security: [{ bearerAuth: [] }],
        params: idParamSchema,
        response: okWithErrors('Dettaglio della proposta'),
      },
    },
    async (request) => ({
      data: await getClientProposal(await clientId(request), request.params.id, request),
    }),
  );

  app.post<{ Params: { id: string }; Body: { note?: string } }>(
    '/client/proposals/:id/accept',
    {
      schema: {
        tags: ['Cliente'],
        summary: 'Accettazione della proposta',
        description:
          'Simula l\'esperienza utente di accettazione all\'interno del prototipo. ' +
          'NON è una firma elettronica qualificata e non sostituisce il sistema ufficiale ' +
          'dell\'azienda: la risposta contiene un avviso esplicito.',
        security: [{ bearerAuth: [] }],
        params: idParamSchema,
        body: proposalResponseBodySchema,
        response: {
          ...okWithErrors('Accettazione registrata'),
          409: { description: 'Proposta non più modificabile (già risposta o scaduta)', type: 'object', additionalProperties: true },
        },
      },
    },
    async (request) => ({
      data: await respondToProposal(
        await clientId(request),
        request.params.id,
        'ACCEPTED',
        request.body?.note,
        request,
      ),
    }),
  );

  app.post<{ Params: { id: string }; Body: { note?: string } }>(
    '/client/proposals/:id/reject',
    {
      schema: {
        tags: ['Cliente'],
        summary: 'Rifiuto della proposta',
        description: 'Registra il rifiuto, con nota facoltativa per il consulente.',
        security: [{ bearerAuth: [] }],
        params: idParamSchema,
        body: proposalResponseBodySchema,
        response: {
          ...okWithErrors('Rifiuto registrato'),
          409: { description: 'Proposta non più modificabile', type: 'object', additionalProperties: true },
        },
      },
    },
    async (request) => ({
      data: await respondToProposal(
        await clientId(request),
        request.params.id,
        'REJECTED',
        request.body?.note,
        request,
      ),
    }),
  );

  // --- Documenti ------------------------------------------------------------

  app.get<{ Querystring: { category?: string } }>(
    '/client/documents',
    {
      schema: {
        tags: ['Cliente'],
        summary: 'Documenti del cliente',
        description:
          'PDF fittizi (schede proposta, rendiconti, contratti). Il campo `downloadPath` indica ' +
          'l\'endpoint da cui aprire o scaricare il file.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: ['PROPOSAL', 'REPORT', 'CONTRACT', 'STATEMENT'] },
          },
          additionalProperties: false,
        },
        response: okWithErrors('Elenco dei documenti'),
      },
    },
    async (request) => ({
      data: await listClientDocuments(await clientId(request), request.query.category),
    }),
  );
}
