import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { notFound } from '../lib/errors.js';
import {
  getAdvisorsBreakdown,
  getCompanyAllocation,
  getCompanyAumHistory,
  getCompanyOverview,
  getProposalsAnalytics,
  listCompanyClients,
} from '../services/analytics.service.js';
import { getClientOverview } from '../services/advisor.service.js';
import { getProposalForStaff, listAllProposals } from '../services/proposal.service.js';
import { auditSummary, listAudit, recordAudit } from '../services/audit.service.js';
import { AUDIT_ACTIONS, type HistoryRange, type ProposalStatus, type RiskProfile } from '../domain/enums.js';
import {
  clientIdParamSchema,
  historyQuerySchema,
  idParamSchema,
  okWithErrors,
  pageQueryProps,
  proposalStatusEnum,
  riskProfileEnum,
} from '../http/schemas.js';

/**
 * ============================================================================
 * AREA DIREZIONE (BOSS / ADMIN)
 * ============================================================================
 *
 * Indicatori aggregati sull'intera azienda, progettati per SCHERMATE MOBILE:
 * pochi numeri grandi, serie già pronte per il grafico, nessuna tabella desktop.
 */
export default async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', app.requireRole('ADMIN'));

  const security = [{ bearerAuth: [] }];

  // --- Analytics ------------------------------------------------------------

  app.get(
    '/admin/analytics/overview',
    {
      schema: {
        tags: ['Boss'],
        summary: 'Dashboard aziendale (KPI + grafici principali)',
        description:
          'Patrimonio complessivo, clienti, consulenti, patrimonio medio, variazioni, ' +
          'asset allocation aziendale e proposte per stato: tutta la schermata in una richiesta.',
        security,
        response: okWithErrors('KPI aziendali'),
      },
    },
    async (request) => {
      await recordAudit({ action: AUDIT_ACTIONS.ANALYTICS_VIEWED, entityType: 'Company', request });
      return { data: await getCompanyOverview() };
    },
  );

  app.get<{ Querystring: { range?: HistoryRange; from?: string; to?: string; maxPoints?: number } }>(
    '/admin/analytics/aum-history',
    {
      schema: {
        tags: ['Boss'],
        summary: 'Patrimonio aziendale nel tempo',
        description: 'Somma dei patrimoni di tutti i clienti, con gli stessi periodi dell\'area cliente.',
        security,
        querystring: historyQuerySchema,
        response: okWithErrors('Serie storica aggregata'),
      },
    },
    async (request) => ({ data: await getCompanyAumHistory(request.query) }),
  );

  app.get(
    '/admin/analytics/allocation',
    {
      schema: {
        tags: ['Boss'],
        summary: 'Asset allocation aziendale',
        security,
        response: okWithErrors('Ripartizione aggregata'),
      },
    },
    async () => ({ data: await getCompanyAllocation() }),
  );

  app.get(
    '/admin/analytics/proposals',
    {
      schema: {
        tags: ['Boss'],
        summary: 'Analisi delle proposte',
        description:
          'Imbuto per stato, tasso di accettazione, importo medio, tempo medio di risposta e ' +
          'andamento mensile degli ultimi 12 mesi.',
        security,
        response: okWithErrors('Analisi delle proposte'),
      },
    },
    async () => ({ data: await getProposalsAnalytics() }),
  );

  // --- Rete commerciale -----------------------------------------------------

  app.get(
    '/admin/advisors',
    {
      schema: {
        tags: ['Boss'],
        summary: 'Consulenti: patrimonio, clienti e tasso di accettazione',
        description: 'Confronto della rete commerciale, ordinato per patrimonio gestito.',
        security,
        response: okWithErrors('Elenco dei consulenti'),
      },
    },
    async () => ({ data: await getAdvisorsBreakdown() }),
  );

  app.get<{
    Querystring: { search?: string; advisorId?: string; riskProfile?: RiskProfile; page?: number; pageSize?: number };
  }>(
    '/admin/clients',
    {
      schema: {
        tags: ['Boss'],
        summary: 'Clienti dell\'azienda',
        security,
        querystring: {
          type: 'object',
          properties: {
            search: { type: 'string', maxLength: 80 },
            advisorId: { type: 'string' },
            riskProfile: { type: 'string', enum: riskProfileEnum },
            ...pageQueryProps,
          },
          additionalProperties: false,
        },
        response: okWithErrors('Elenco dei clienti'),
      },
    },
    async (request) => {
      const result = await listCompanyClients(request.query);
      return { data: result.items, meta: result.meta, totals: result.totals };
    },
  );

  app.get<{ Params: { clientId: string } }>(
    '/admin/clients/:clientId',
    {
      schema: {
        tags: ['Boss'],
        summary: 'Dettaglio di un cliente',
        security,
        params: clientIdParamSchema,
        response: okWithErrors('Dettaglio del cliente'),
      },
    },
    async (request) => {
      const client = await prisma.client.findUnique({
        where: { id: request.params.clientId },
        select: { id: true },
      });
      if (!client) throw notFound('Cliente non trovato.');
      return { data: await getClientOverview(client.id) };
    },
  );

  // --- Proposte -------------------------------------------------------------

  app.get<{
    Querystring: { status?: ProposalStatus; advisorId?: string; clientId?: string; page?: number; pageSize?: number };
  }>(
    '/admin/proposals',
    {
      schema: {
        tags: ['Boss'],
        summary: 'Tutte le proposte dell\'azienda',
        security,
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: proposalStatusEnum },
            advisorId: { type: 'string' },
            clientId: { type: 'string' },
            ...pageQueryProps,
          },
          additionalProperties: false,
        },
        response: okWithErrors('Elenco delle proposte'),
      },
    },
    async (request) => {
      const result = await listAllProposals(request.query);
      return { data: result.items, meta: result.meta };
    },
  );

  app.get<{ Params: { id: string } }>(
    '/admin/proposals/:id',
    {
      schema: {
        tags: ['Boss'],
        summary: 'Dettaglio di una proposta',
        security,
        params: idParamSchema,
        response: okWithErrors('Dettaglio della proposta'),
      },
    },
    async (request) => ({ data: await getProposalForStaff(request.params.id, {}, request) }),
  );

  // --- Audit ----------------------------------------------------------------

  app.get<{
    Querystring: { action?: string; userId?: string; from?: string; to?: string; page?: number; pageSize?: number };
  }>(
    '/admin/audit',
    {
      schema: {
        tags: ['Boss'],
        summary: 'Registro delle attività (audit log)',
        description:
          'Login, creazione e visualizzazione proposte, accettazioni e rifiuti, con utente, ' +
          'data/ora ed elemento coinvolto.',
        security,
        querystring: {
          type: 'object',
          properties: {
            action: { type: 'string', maxLength: 60 },
            userId: { type: 'string' },
            from: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            to: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            ...pageQueryProps,
          },
          additionalProperties: false,
        },
        response: okWithErrors('Voci di audit'),
      },
    },
    async (request) => {
      const result = await listAudit(request.query);
      return { data: result.items, meta: result.meta };
    },
  );

  app.get(
    '/admin/audit/summary',
    {
      schema: {
        tags: ['Boss'],
        summary: 'Riepilogo delle attività per tipo (ultimi 30 giorni)',
        security,
        response: okWithErrors('Conteggi per azione'),
      },
    },
    async () => ({ data: await auditSummary(30) }),
  );
}
