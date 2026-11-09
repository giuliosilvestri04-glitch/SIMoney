import type { FastifyInstance, FastifyRequest } from 'fastify';
import { unauthorized } from '../lib/errors.js';
import { assertAdvisorOwnsClient, requireAdvisorId } from '../services/access.service.js';
import { getAdvisorDashboard, getClientOverview, listAdvisorClients } from '../services/advisor.service.js';
import {
  getAllocation,
  getHistory,
  getInvestments,
  getSnapshot,
  getTransactions,
} from '../services/portfolio.service.js';
import {
  createProposal,
  getProposalForStaff,
  listAdvisorProposals,
  listInstruments,
  type CreateProposalInput,
} from '../services/proposal.service.js';
import { listClientDocuments } from '../services/document.service.js';
import { recordAudit } from '../services/audit.service.js';
import { AUDIT_ACTIONS, type HistoryRange, type ProposalStatus, type RiskProfile } from '../domain/enums.js';
import {
  clientIdParamSchema,
  createProposalBodySchema,
  dateQuerySchema,
  historyQuerySchema,
  idParamSchema,
  okWithErrors,
  pageQueryProps,
  proposalStatusEnum,
  requiredDateQuerySchema,
  riskProfileEnum,
} from '../http/schemas.js';

/**
 * ============================================================================
 * AREA CONSULENTE
 * ============================================================================
 *
 * Ogni rotta che riceve un `:clientId` passa da `assertAdvisorOwnsClient`.
 * Se il cliente esiste ma è di un altro consulente la risposta è 404: non si
 * rivela l'esistenza di posizioni fuori dal perimetro.
 */
export default async function advisorRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', app.requireRole('ADVISOR'));

  const advisorId = async (request: FastifyRequest) => {
    if (!request.auth) throw unauthorized();
    return requireAdvisorId(request.auth);
  };

  /** Risolve il cliente verificando che appartenga al consulente autenticato. */
  const ownedClientId = async (request: FastifyRequest, clientId: string) =>
    assertAdvisorOwnsClient(await advisorId(request), clientId);

  const security = [{ bearerAuth: [] }];

  // --- Dashboard ------------------------------------------------------------

  app.get(
    '/advisor/dashboard',
    {
      schema: {
        tags: ['Consulente'],
        summary: 'Dashboard del consulente',
        description:
          'Patrimonio gestito, numero clienti, proposte per stato, andamento a 12 mesi, ' +
          'migliori clienti e proposte in scadenza. Tutta la schermata in una richiesta.',
        security,
        response: okWithErrors('Dati della dashboard'),
      },
    },
    async (request) => ({ data: await getAdvisorDashboard(await advisorId(request)) }),
  );

  // --- Clienti --------------------------------------------------------------

  app.get<{
    Querystring: {
      search?: string;
      riskProfile?: RiskProfile;
      onlyPendingProposals?: boolean;
      sort?: 'value_desc' | 'value_asc' | 'name_asc' | 'performance_desc' | 'performance_asc';
      page?: number;
      pageSize?: number;
    };
  }>(
    '/advisor/clients',
    {
      schema: {
        tags: ['Consulente'],
        summary: 'Clienti assegnati, con ricerca e filtri',
        description:
          'Ricerca per nome, email, codice cliente o città. Filtri per profilo di rischio e ' +
          'presenza di proposte in attesa. Ordinamento per patrimonio, performance o nome.',
        security,
        querystring: {
          type: 'object',
          properties: {
            search: { type: 'string', maxLength: 80 },
            riskProfile: { type: 'string', enum: riskProfileEnum },
            onlyPendingProposals: { type: 'boolean', default: false },
            sort: {
              type: 'string',
              enum: ['value_desc', 'value_asc', 'name_asc', 'performance_desc', 'performance_asc'],
              default: 'value_desc',
            },
            ...pageQueryProps,
          },
          additionalProperties: false,
        },
        response: okWithErrors('Elenco clienti'),
      },
    },
    async (request) => {
      const result = await listAdvisorClients(await advisorId(request), request.query);
      return { data: result.items, meta: result.meta, totals: result.totals };
    },
  );

  app.get<{ Params: { clientId: string } }>(
    '/advisor/clients/:clientId',
    {
      schema: {
        tags: ['Consulente'],
        summary: 'Dettaglio cliente',
        description: 'Anagrafica, patrimonio, allocazione, andamento e stato delle proposte.',
        security,
        params: clientIdParamSchema,
        response: okWithErrors('Dettaglio del cliente'),
      },
    },
    async (request) => {
      const clientId = await ownedClientId(request, request.params.clientId);
      await recordAudit({
        action: AUDIT_ACTIONS.CLIENT_VIEWED,
        entityType: 'Client',
        entityId: clientId,
        request,
      });
      return { data: await getClientOverview(clientId) };
    },
  );

  app.get<{ Params: { clientId: string }; Querystring: { range?: HistoryRange; from?: string; to?: string; maxPoints?: number } }>(
    '/advisor/clients/:clientId/portfolio/history',
    {
      schema: {
        tags: ['Consulente'],
        summary: 'Evoluzione del patrimonio di un cliente',
        security,
        params: clientIdParamSchema,
        querystring: historyQuerySchema,
        response: okWithErrors('Serie storica'),
      },
    },
    async (request) => ({
      data: await getHistory(await ownedClientId(request, request.params.clientId), request.query),
    }),
  );

  app.get<{ Params: { clientId: string }; Querystring: { date: string } }>(
    '/advisor/clients/:clientId/portfolio/snapshot',
    {
      schema: {
        tags: ['Consulente'],
        summary: 'Patrimonio di un cliente a una data',
        security,
        params: clientIdParamSchema,
        querystring: requiredDateQuerySchema,
        response: okWithErrors('Fotografia alla data'),
      },
    },
    async (request) => ({
      data: await getSnapshot(await ownedClientId(request, request.params.clientId), request.query.date),
    }),
  );

  app.get<{ Params: { clientId: string }; Querystring: { date?: string } }>(
    '/advisor/clients/:clientId/portfolio/allocation',
    {
      schema: {
        tags: ['Consulente'],
        summary: 'Asset allocation di un cliente',
        security,
        params: clientIdParamSchema,
        querystring: dateQuerySchema,
        response: okWithErrors('Ripartizione per asset class'),
      },
    },
    async (request) => ({
      data: await getAllocation(await ownedClientId(request, request.params.clientId), request.query.date),
    }),
  );

  app.get<{ Params: { clientId: string } }>(
    '/advisor/clients/:clientId/investments',
    {
      schema: {
        tags: ['Consulente'],
        summary: 'Investimenti di un cliente',
        security,
        params: clientIdParamSchema,
        response: okWithErrors('Elenco delle posizioni'),
      },
    },
    async (request) => ({
      data: await getInvestments(await ownedClientId(request, request.params.clientId)),
    }),
  );

  app.get<{ Params: { clientId: string }; Querystring: { page?: number; pageSize?: number } }>(
    '/advisor/clients/:clientId/transactions',
    {
      schema: {
        tags: ['Consulente'],
        summary: 'Movimenti di un cliente',
        security,
        params: clientIdParamSchema,
        querystring: { type: 'object', properties: pageQueryProps, additionalProperties: false },
        response: okWithErrors('Elenco dei movimenti'),
      },
    },
    async (request) => {
      const result = await getTransactions(
        await ownedClientId(request, request.params.clientId),
        request.query,
      );
      return { data: result.items, meta: result.meta };
    },
  );

  app.get<{ Params: { clientId: string }; Querystring: { status?: ProposalStatus; page?: number; pageSize?: number } }>(
    '/advisor/clients/:clientId/proposals',
    {
      schema: {
        tags: ['Consulente'],
        summary: 'Proposte inviate a un cliente',
        security,
        params: clientIdParamSchema,
        querystring: {
          type: 'object',
          properties: { status: { type: 'string', enum: proposalStatusEnum }, ...pageQueryProps },
          additionalProperties: false,
        },
        response: okWithErrors('Elenco delle proposte'),
      },
    },
    async (request) => {
      const clientId = await ownedClientId(request, request.params.clientId);
      const result = await listAdvisorProposals(await advisorId(request), { ...request.query, clientId });
      return { data: result.items, meta: result.meta };
    },
  );

  app.get<{ Params: { clientId: string } }>(
    '/advisor/clients/:clientId/documents',
    {
      schema: {
        tags: ['Consulente'],
        summary: 'Documenti di un cliente',
        security,
        params: clientIdParamSchema,
        response: okWithErrors('Elenco dei documenti'),
      },
    },
    async (request) => ({
      data: await listClientDocuments(await ownedClientId(request, request.params.clientId)),
    }),
  );

  // --- Proposte -------------------------------------------------------------

  app.get<{ Querystring: { status?: ProposalStatus; clientId?: string; page?: number; pageSize?: number } }>(
    '/advisor/proposals',
    {
      schema: {
        tags: ['Consulente'],
        summary: 'Tutte le proposte del consulente',
        security,
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: proposalStatusEnum },
            clientId: { type: 'string' },
            ...pageQueryProps,
          },
          additionalProperties: false,
        },
        response: okWithErrors('Elenco delle proposte'),
      },
    },
    async (request) => {
      const result = await listAdvisorProposals(await advisorId(request), request.query);
      return { data: result.items, meta: result.meta };
    },
  );

  app.get<{ Params: { id: string } }>(
    '/advisor/proposals/:id',
    {
      schema: {
        tags: ['Consulente'],
        summary: 'Dettaglio di una proposta creata dal consulente',
        security,
        params: idParamSchema,
        response: okWithErrors('Dettaglio della proposta'),
      },
    },
    async (request) => ({
      data: await getProposalForStaff(request.params.id, { advisorId: await advisorId(request) }, request),
    }),
  );

  app.post<{ Body: CreateProposalInput }>(
    '/advisor/proposals',
    {
      schema: {
        tags: ['Consulente'],
        summary: 'Creazione di una proposta di investimento',
        description: [
          'Flusso guidato del wizard mobile: cliente → titolo → descrizione → importo →',
          'operazioni → asset allocation proposta → documento → riepilogo → invio.',
          '',
          'Controlli applicati:',
          '- il cliente deve essere assegnato al consulente;',
          '- la somma delle operazioni deve coincidere con l\'importo (tolleranza 1%);',
          '- l\'asset allocation proposta deve sommare 100%;',
          '- viene generata automaticamente la scheda PDF (disattivabile con `attachDocument: false`).',
        ].join('\n'),
        security,
        body: createProposalBodySchema,
        response: {
          ...okWithErrors('Proposta creata'),
          422: { description: 'Dati non coerenti (importi o allocazione)', type: 'object', additionalProperties: true },
        },
      },
    },
    async (request, reply) => {
      const proposal = await createProposal(await advisorId(request), request.body, request);
      reply.status(201);
      return { data: proposal };
    },
  );

  // --- Catalogo -------------------------------------------------------------

  app.get<{ Querystring: { search?: string; assetClassKey?: string } }>(
    '/advisor/catalog/instruments',
    {
      schema: {
        tags: ['Consulente'],
        summary: 'Catalogo strumenti per la creazione delle proposte',
        security,
        querystring: {
          type: 'object',
          properties: {
            search: { type: 'string', maxLength: 80 },
            assetClassKey: { type: 'string', maxLength: 40 },
          },
          additionalProperties: false,
        },
        response: okWithErrors('Elenco degli strumenti'),
      },
    },
    async (request) => ({ data: await listInstruments(request.query) }),
  );
}
