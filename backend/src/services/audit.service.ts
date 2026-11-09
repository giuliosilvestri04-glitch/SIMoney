import type { FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { pageMeta, resolvePage } from '../lib/pagination.js';
import type { AuditAction } from '../domain/enums.js';

/**
 * Registro delle azioni sensibili.
 *
 * Requisito 27: login, creazione/visualizzazione proposta, accettazione,
 * rifiuto — con utente, azione, data/ora ed elemento coinvolto.
 *
 * La scrittura non deve MAI far fallire l'operazione applicativa: se il log non
 * riesce, l'errore viene registrato e la richiesta prosegue.
 */

export interface AuditInput {
  action: AuditAction;
  userId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  request?: FastifyRequest;
}

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        userId: input.userId ?? input.request?.auth?.userId ?? null,
        actorEmail: input.actorEmail ?? input.request?.auth?.email ?? null,
        actorRole: input.actorRole ?? input.request?.auth?.role ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        ip: input.request?.ip,
        userAgent: input.request?.headers['user-agent']?.slice(0, 255),
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch (error) {
    input.request?.log.error({ err: error }, 'Scrittura audit log non riuscita');
  }
}

export interface AuditQuery {
  page?: number;
  pageSize?: number;
  action?: string;
  userId?: string;
  from?: string;
  to?: string;
}

/** Consultazione dell'audit log (solo ADMIN). */
export async function listAudit(query: AuditQuery) {
  const { page, pageSize, skip, take } = resolvePage(query);

  const where: Record<string, unknown> = {};
  if (query.action) where.action = query.action;
  if (query.userId) where.userId = query.userId;
  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
      ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
    };
  }

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: { user: { select: { firstName: true, lastName: true, email: true, role: true } } },
    }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      action: row.action,
      actor: row.user
        ? { name: `${row.user.firstName} ${row.user.lastName}`, email: row.user.email, role: row.user.role }
        : { name: row.actorEmail ?? 'Sconosciuto', email: row.actorEmail, role: row.actorRole },
      entityType: row.entityType,
      entityId: row.entityId,
      ip: row.ip,
      metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : null,
      createdAt: row.createdAt.toISOString(),
    })),
    meta: pageMeta(page, pageSize, total),
  };
}

/** Contatori per la dashboard del boss. */
export async function auditSummary(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const grouped = await prisma.auditLog.groupBy({
    by: ['action'],
    where: { createdAt: { gte: since } },
    _count: { action: true },
    orderBy: { _count: { action: 'desc' } },
  });
  return grouped.map((row) => ({ action: row.action, count: row._count.action }));
}
