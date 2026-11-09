import type { FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { badRequest, conflict, notFound, unprocessable } from '../lib/errors.js';
import { money, pct } from '../lib/money.js';
import { addDays } from '../lib/dates.js';
import { pageMeta, resolvePage } from '../lib/pagination.js';
import {
  AUDIT_ACTIONS,
  PROPOSAL_STATUS_LABELS,
  type ProposalAction,
  type ProposalStatus,
} from '../domain/enums.js';
import { getDataProvider } from '../providers/index.js';
import { recordAudit } from './audit.service.js';
import { assertAdvisorOwnsClient } from './access.service.js';
import { generateProposalDocument, toDocumentDTO } from './document.service.js';

/**
 * Proposte di investimento.
 *
 * NOTA IMPORTANTE SULL'ACCETTAZIONE (requisito 16)
 * -------------------------------------------------
 * L'app simula esclusivamente l'ESPERIENZA UTENTE di accettazione/rifiuto.
 * Non è una firma elettronica qualificata e non sostituisce il sistema
 * ufficiale dell'azienda: ogni risposta dell'API lo dichiara esplicitamente.
 */

const SIMULATION_DISCLAIMER =
  "Accettazione simulata all'interno del prototipo a scopo dimostrativo. " +
  "Non costituisce firma elettronica qualificata né sostituisce il sistema ufficiale dell'azienda.";

/**
 * Allinea allo stato SCADUTA le proposte non risposte oltre la scadenza.
 * Viene invocata prima di ogni lettura: nel prototipo evita un job schedulato
 * e garantisce che la demo mostri sempre stati coerenti.
 */
export async function expireOverdueProposals(scope?: { clientId?: string; advisorId?: string }) {
  await prisma.proposal.updateMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: new Date() },
      ...(scope?.clientId ? { clientId: scope.clientId } : {}),
      ...(scope?.advisorId ? { advisorId: scope.advisorId } : {}),
    },
    data: { status: 'EXPIRED' },
  });
}

type ProposalWithRelations = Awaited<ReturnType<typeof findProposalDetail>>;

function daysToExpiry(expiresAt: Date): number {
  return Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000);
}

function mapSummary(proposal: {
  id: string;
  code: string;
  title: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: Date;
  expiresAt: Date;
  respondedAt: Date | null;
  viewedAt: Date | null;
  client?: { id: string; clientCode: string; user: { firstName: string; lastName: string } } | null;
  advisor?: { id: string; user: { firstName: string; lastName: string } } | null;
  _count?: { documents: number; items: number };
}) {
  const status = proposal.status as ProposalStatus;
  return {
    id: proposal.id,
    code: proposal.code,
    title: proposal.title,
    amount: money(proposal.amount),
    currency: proposal.currency,
    status,
    statusLabel: PROPOSAL_STATUS_LABELS[status],
    createdAt: proposal.createdAt.toISOString(),
    expiresAt: proposal.expiresAt.toISOString(),
    daysToExpiry: status === 'PENDING' ? Math.max(0, daysToExpiry(proposal.expiresAt)) : null,
    respondedAt: proposal.respondedAt?.toISOString() ?? null,
    isRead: proposal.viewedAt !== null,
    documentsCount: proposal._count?.documents ?? 0,
    itemsCount: proposal._count?.items ?? 0,
    client: proposal.client
      ? {
          id: proposal.client.id,
          code: proposal.client.clientCode,
          name: `${proposal.client.user.firstName} ${proposal.client.user.lastName}`,
        }
      : null,
    advisor: proposal.advisor
      ? {
          id: proposal.advisor.id,
          name: `${proposal.advisor.user.firstName} ${proposal.advisor.user.lastName}`,
        }
      : null,
  };
}

async function findProposalDetail(proposalId: string) {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      client: { include: { user: true } },
      advisor: { include: { user: true } },
      items: { include: { assetClass: true, instrument: true } },
      allocations: { include: { assetClass: true } },
      documents: true,
      _count: { select: { documents: true, items: true } },
    },
  });
  if (!proposal) throw notFound('Proposta non trovata.');
  return proposal;
}

function mapDetail(proposal: NonNullable<ProposalWithRelations>) {
  return {
    ...mapSummary(proposal),
    description: proposal.description,
    rationale: proposal.rationale,
    responseNote: proposal.responseNote,
    advisorContact: {
      email: proposal.advisor.user.email,
      phone: proposal.advisor.user.phone,
      officeCity: proposal.advisor.officeCity,
    },
    items: proposal.items.map((item) => ({
      id: item.id,
      action: item.action as ProposalAction,
      instrumentName: item.instrumentName,
      isin: item.instrument?.isin ?? null,
      amount: money(item.amount),
      weightPct: item.weightPct === null ? null : pct(item.weightPct),
      note: item.note,
      assetClass: item.assetClass
        ? { key: item.assetClass.key, label: item.assetClass.label, colorHex: item.assetClass.colorHex }
        : null,
    })),
    allocation: proposal.allocations
      .sort((a, b) => a.assetClass.orderIndex - b.assetClass.orderIndex)
      .map((allocation) => ({
        key: allocation.assetClass.key,
        label: allocation.assetClass.label,
        colorHex: allocation.assetClass.colorHex,
        currentPct: pct(allocation.currentPct),
        proposedPct: pct(allocation.proposedPct),
        deltaPct: pct(allocation.proposedPct - allocation.currentPct),
      })),
    documents: proposal.documents.map(toDocumentDTO),
    simulationNotice: SIMULATION_DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------
// Lettura — CLIENTE
// ---------------------------------------------------------------------------

export async function listClientProposals(
  clientId: string,
  query: { status?: ProposalStatus; page?: number; pageSize?: number },
) {
  await expireOverdueProposals({ clientId });
  const { page, pageSize, skip, take } = resolvePage(query);

  const where = { clientId, ...(query.status ? { status: query.status } : {}) };

  const [total, rows] = await Promise.all([
    prisma.proposal.count({ where }),
    prisma.proposal.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip,
      take,
      include: {
        advisor: { include: { user: true } },
        _count: { select: { documents: true, items: true } },
      },
    }),
  ]);

  return { items: rows.map((row) => mapSummary(row)), meta: pageMeta(page, pageSize, total) };
}

/** Dettaglio proposta lato cliente: segna la presa visione e scrive l'audit. */
export async function getClientProposal(clientId: string, proposalId: string, request: FastifyRequest) {
  await expireOverdueProposals({ clientId });

  const proposal = await findProposalDetail(proposalId);
  if (proposal.clientId !== clientId) throw notFound('Proposta non trovata.');

  if (!proposal.viewedAt) {
    await prisma.proposal.update({ where: { id: proposal.id }, data: { viewedAt: new Date() } });
    proposal.viewedAt = new Date();
  }

  await recordAudit({
    action: AUDIT_ACTIONS.PROPOSAL_VIEWED,
    entityType: 'Proposal',
    entityId: proposal.id,
    metadata: { code: proposal.code },
    request,
  });

  return mapDetail(proposal);
}

/**
 * Accettazione o rifiuto da parte del cliente.
 * Unico punto in cui lo stato di una proposta cambia su input dell'utente.
 */
export async function respondToProposal(
  clientId: string,
  proposalId: string,
  decision: 'ACCEPTED' | 'REJECTED',
  note: string | undefined,
  request: FastifyRequest,
) {
  const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
  if (!proposal || proposal.clientId !== clientId) throw notFound('Proposta non trovata.');

  if (proposal.status !== 'PENDING') {
    throw conflict(
      `La proposta risulta già "${PROPOSAL_STATUS_LABELS[proposal.status as ProposalStatus]}" e non può essere modificata.`,
      'PROPOSAL_NOT_PENDING',
    );
  }

  if (proposal.expiresAt < new Date()) {
    await prisma.proposal.update({ where: { id: proposal.id }, data: { status: 'EXPIRED' } });
    throw conflict('La proposta è scaduta: contattare il consulente per una nuova proposta.', 'PROPOSAL_EXPIRED');
  }

  await prisma.proposal.update({
    where: { id: proposal.id },
    data: { status: decision, respondedAt: new Date(), responseNote: note ?? null },
  });

  await recordAudit({
    action: decision === 'ACCEPTED' ? AUDIT_ACTIONS.PROPOSAL_ACCEPTED : AUDIT_ACTIONS.PROPOSAL_REJECTED,
    entityType: 'Proposal',
    entityId: proposal.id,
    metadata: { code: proposal.code, amount: proposal.amount, note: note ?? null },
    request,
  });

  const detail = mapDetail(await findProposalDetail(proposal.id));

  return {
    proposal: detail,
    confirmation: {
      decision,
      decisionLabel: decision === 'ACCEPTED' ? 'Proposta accettata' : 'Proposta rifiutata',
      message:
        decision === 'ACCEPTED'
          ? 'La tua accettazione è stata registrata. Il consulente riceverà una notifica e procederà con le operazioni.'
          : 'Il rifiuto è stato registrato. Il consulente potrà proporti una soluzione alternativa.',
      respondedAt: new Date().toISOString(),
      notice: SIMULATION_DISCLAIMER,
    },
  };
}

// ---------------------------------------------------------------------------
// Lettura — CONSULENTE / DIREZIONE
// ---------------------------------------------------------------------------

export async function listAdvisorProposals(
  advisorId: string,
  query: { status?: ProposalStatus; clientId?: string; page?: number; pageSize?: number },
) {
  await expireOverdueProposals({ advisorId });
  const { page, pageSize, skip, take } = resolvePage(query);

  const where = {
    advisorId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.clientId ? { clientId: query.clientId } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.proposal.count({ where }),
    prisma.proposal.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      skip,
      take,
      include: {
        client: { include: { user: true } },
        _count: { select: { documents: true, items: true } },
      },
    }),
  ]);

  return { items: rows.map((row) => mapSummary(row)), meta: pageMeta(page, pageSize, total) };
}

/** Elenco aziendale delle proposte (solo direzione). */
export async function listAllProposals(query: {
  status?: ProposalStatus;
  advisorId?: string;
  clientId?: string;
  page?: number;
  pageSize?: number;
}) {
  await expireOverdueProposals();
  const { page, pageSize, skip, take } = resolvePage(query);

  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.advisorId ? { advisorId: query.advisorId } : {}),
    ...(query.clientId ? { clientId: query.clientId } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.proposal.count({ where }),
    prisma.proposal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        client: { include: { user: true } },
        advisor: { include: { user: true } },
        _count: { select: { documents: true, items: true } },
      },
    }),
  ]);

  return { items: rows.map((row) => mapSummary(row)), meta: pageMeta(page, pageSize, total) };
}

/** Dettaglio visibile a consulente (solo proprie) e direzione (tutte). */
export async function getProposalForStaff(
  proposalId: string,
  scope: { advisorId?: string },
  request: FastifyRequest,
) {
  const proposal = await findProposalDetail(proposalId);
  if (scope.advisorId && proposal.advisorId !== scope.advisorId) {
    throw notFound('Proposta non trovata.');
  }

  await recordAudit({
    action: AUDIT_ACTIONS.PROPOSAL_VIEWED,
    entityType: 'Proposal',
    entityId: proposal.id,
    metadata: { code: proposal.code, staff: true },
    request,
  });

  return mapDetail(proposal);
}

// ---------------------------------------------------------------------------
// Creazione — CONSULENTE
// ---------------------------------------------------------------------------

export interface CreateProposalInput {
  clientId: string;
  title: string;
  description: string;
  rationale?: string;
  amount: number;
  expiresInDays?: number;
  items: Array<{
    instrumentId?: string;
    instrumentName?: string;
    assetClassKey?: string;
    action: ProposalAction;
    amount: number;
    note?: string;
  }>;
  proposedAllocation?: Array<{ assetClassKey: string; proposedPct: number }>;
  attachDocument?: boolean;
}

async function nextProposalCode(): Promise<string> {
  const year = new Date().getUTCFullYear();
  // Si parte dal progressivo più alto già assegnato: i codici generati dal seed
  // non sono necessariamente contigui, quindi contare le righe non basterebbe.
  const last = await prisma.proposal.findFirst({
    where: { code: { startsWith: `PRP-${year}-` } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });
  const lastNumber = last ? Number.parseInt(last.code.split('-')[2] ?? '0', 10) : 0;
  return `PRP-${year}-${String((Number.isNaN(lastNumber) ? 0 : lastNumber) + 1).padStart(4, '0')}`;
}

export async function createProposal(
  advisorId: string,
  input: CreateProposalInput,
  request: FastifyRequest,
) {
  // 1. Il cliente deve appartenere al consulente (404 in caso contrario).
  await assertAdvisorOwnsClient(advisorId, input.clientId);

  // 2. Risoluzione degli strumenti e delle categorie.
  const assetClasses = await prisma.assetClass.findMany();
  const assetClassByKey = new Map(assetClasses.map((assetClass) => [assetClass.key, assetClass]));

  const instrumentIds = input.items
    .map((item) => item.instrumentId)
    .filter((id): id is string => Boolean(id));

  const instruments = instrumentIds.length
    ? await prisma.instrument.findMany({ where: { id: { in: instrumentIds } } })
    : [];
  const instrumentById = new Map(instruments.map((instrument) => [instrument.id, instrument]));

  const items = input.items.map((item, index) => {
    const instrument = item.instrumentId ? instrumentById.get(item.instrumentId) : undefined;

    if (item.instrumentId && !instrument) {
      throw badRequest(`Strumento non trovato a catalogo (riga ${index + 1}).`);
    }

    const name = instrument?.name ?? item.instrumentName;
    if (!name) {
      throw badRequest(`Indicare "instrumentId" oppure "instrumentName" (riga ${index + 1}).`);
    }

    const assetClassId =
      instrument?.assetClassId ??
      (item.assetClassKey ? assetClassByKey.get(item.assetClassKey)?.id : undefined);

    if (item.assetClassKey && !assetClassByKey.has(item.assetClassKey)) {
      throw badRequest(`Asset class sconosciuta: "${item.assetClassKey}" (riga ${index + 1}).`);
    }

    return {
      instrumentId: instrument?.id ?? null,
      instrumentName: name,
      assetClassId: assetClassId ?? null,
      action: item.action,
      amount: money(item.amount),
      note: item.note ?? null,
    };
  });

  // 3. Coerenza fra importo complessivo e somma delle operazioni (tolleranza 1%).
  const itemsTotal = items.reduce((acc, item) => acc + item.amount, 0);
  if (Math.abs(itemsTotal - input.amount) > Math.max(1, input.amount * 0.01)) {
    throw unprocessable(
      `L'importo della proposta (${money(input.amount)}) non corrisponde alla somma delle operazioni (${money(itemsTotal)}).`,
      { proposalAmount: money(input.amount), itemsTotal: money(itemsTotal) },
    );
  }

  // 4. Allocazione proposta: deve fare 100%.
  let allocationRows: Array<{ assetClassId: string; currentPct: number; proposedPct: number }> = [];

  if (input.proposedAllocation?.length) {
    const total = input.proposedAllocation.reduce((acc, row) => acc + row.proposedPct, 0);
    if (Math.abs(total - 100) > 0.5) {
      throw unprocessable(`L'asset allocation proposta somma ${total.toFixed(2)}% invece di 100%.`);
    }

    // Percentuali attuali lette dalla sorgente dati attiva (mock oggi, Guardian domani).
    const current = await getDataProvider().getAllocation(input.clientId);
    const currentByKey = new Map(current.map((slice) => [slice.key, slice.weightPct]));

    allocationRows = input.proposedAllocation.map((row) => {
      const assetClass = assetClassByKey.get(row.assetClassKey);
      if (!assetClass) throw badRequest(`Asset class sconosciuta: "${row.assetClassKey}".`);
      return {
        assetClassId: assetClass.id,
        currentPct: pct(currentByKey.get(row.assetClassKey) ?? 0),
        proposedPct: pct(row.proposedPct),
      };
    });
  }

  const code = await nextProposalCode();
  const expiresAt = addDays(new Date(), input.expiresInDays ?? 14);

  const created = await prisma.proposal.create({
    data: {
      code,
      clientId: input.clientId,
      advisorId,
      title: input.title,
      description: input.description,
      rationale: input.rationale ?? null,
      amount: money(input.amount),
      status: 'PENDING',
      expiresAt,
      items: {
        create: items.map((item) => ({
          instrumentId: item.instrumentId,
          instrumentName: item.instrumentName,
          assetClassId: item.assetClassId,
          action: item.action,
          amount: item.amount,
          weightPct: itemsTotal > 0 ? pct((item.amount / itemsTotal) * 100) : null,
          note: item.note,
        })),
      },
      ...(allocationRows.length ? { allocations: { create: allocationRows } } : {}),
    },
  });

  // 5. Documento PDF fittizio allegato (attivo per impostazione predefinita).
  if (input.attachDocument !== false) {
    await generateProposalDocument(created.id);
  }

  await recordAudit({
    action: AUDIT_ACTIONS.PROPOSAL_CREATED,
    entityType: 'Proposal',
    entityId: created.id,
    metadata: { code, clientId: input.clientId, amount: money(input.amount), items: items.length },
    request,
  });

  return mapDetail(await findProposalDetail(created.id));
}

/** Catalogo strumenti per il wizard di creazione proposta. */
export async function listInstruments(query: { search?: string; assetClassKey?: string }) {
  const instruments = await prisma.instrument.findMany({
    where: {
      ...(query.assetClassKey ? { assetClass: { key: query.assetClassKey } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search } },
              { isin: { contains: query.search } },
              { issuer: { contains: query.search } },
            ],
          }
        : {}),
    },
    include: { assetClass: true },
    orderBy: [{ assetClass: { orderIndex: 'asc' } }, { name: 'asc' }],
    take: 100,
  });

  return instruments.map((instrument) => ({
    id: instrument.id,
    isin: instrument.isin,
    name: instrument.name,
    type: instrument.type,
    issuer: instrument.issuer,
    currency: instrument.currency,
    description: instrument.description,
    assetClass: {
      key: instrument.assetClass.key,
      label: instrument.assetClass.label,
      colorHex: instrument.assetClass.colorHex,
    },
  }));
}
