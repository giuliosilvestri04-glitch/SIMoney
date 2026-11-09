import { createHmac, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { invalidCredentials, unauthorized } from '../lib/errors.js';
import { AUDIT_ACTIONS, type Role } from '../domain/enums.js';
import { recordAudit } from './audit.service.js';
import type { AuthContext } from './access.service.js';

/**
 * Sessioni per app mobile.
 *
 *  • access token  → JWT di breve durata (default 30 minuti), inviato come Bearer.
 *  • refresh token → stringa opaca casuale, salvata SOLO come hash HMAC-SHA256.
 *                    Consente la revoca (logout) e la rotazione a ogni rinnovo,
 *                    cosa impossibile con un JWT puro.
 */

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  fullName: string;
  avatarColor: string;
  phone: string | null;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  refreshExpiresAt: string;
}

function hashRefreshToken(token: string): string {
  return createHmac('sha256', env.auth.refreshSecret).update(token).digest('hex');
}

function toSessionUser(user: {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  avatarColor: string;
  phone: string | null;
}): SessionUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role as Role,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`,
    avatarColor: user.avatarColor,
    phone: user.phone,
  };
}

async function issueTokens(
  app: FastifyInstance,
  user: SessionUser,
  userAgent?: string,
): Promise<SessionTokens> {
  const accessToken = app.jwt.sign({ sub: user.id, role: user.role, email: user.email });

  const refreshToken = randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + env.auth.refreshTtlDays * 86_400_000);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt,
      userAgent: userAgent?.slice(0, 255),
    },
  });

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: env.auth.accessTtl,
    refreshExpiresAt: expiresAt.toISOString(),
  };
}

export async function login(
  app: FastifyInstance,
  credentials: { email: string; password: string },
  request: FastifyRequest,
): Promise<{ user: SessionUser; tokens: SessionTokens }> {
  const email = credentials.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.isActive) {
    await recordAudit({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      actorEmail: email,
      entityType: 'User',
      metadata: { reason: user ? 'account_inactive' : 'unknown_email' },
      request,
    });
    throw invalidCredentials();
  }

  const passwordOk = await bcrypt.compare(credentials.password, user.passwordHash);
  if (!passwordOk) {
    await recordAudit({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      userId: user.id,
      actorEmail: email,
      actorRole: user.role,
      entityType: 'User',
      entityId: user.id,
      metadata: { reason: 'wrong_password' },
      request,
    });
    throw invalidCredentials();
  }

  const sessionUser = toSessionUser(user);
  const tokens = await issueTokens(app, sessionUser, request.headers['user-agent']);

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  await recordAudit({
    action: AUDIT_ACTIONS.LOGIN_SUCCESS,
    userId: user.id,
    actorEmail: user.email,
    actorRole: user.role,
    entityType: 'User',
    entityId: user.id,
    request,
  });

  return { user: sessionUser, tokens };
}

/** Rinnovo con rotazione: il token usato viene revocato e ne viene emesso uno nuovo. */
export async function refreshSession(
  app: FastifyInstance,
  refreshToken: string,
  request: FastifyRequest,
): Promise<{ user: SessionUser; tokens: SessionTokens }> {
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(refreshToken) },
    include: { user: true },
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw unauthorized('Sessione non valida o scaduta. Effettuare nuovamente il login.', 'REFRESH_INVALID');
  }
  if (!stored.user.isActive) {
    throw unauthorized('Utenza non attiva.', 'ACCOUNT_INACTIVE');
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const sessionUser = toSessionUser(stored.user);
  const tokens = await issueTokens(app, sessionUser, request.headers['user-agent']);

  await recordAudit({
    action: AUDIT_ACTIONS.TOKEN_REFRESH,
    userId: stored.user.id,
    actorEmail: stored.user.email,
    actorRole: stored.user.role,
    entityType: 'Session',
    entityId: stored.id,
    request,
  });

  return { user: sessionUser, tokens };
}

export async function logout(refreshToken: string | undefined, request: FastifyRequest): Promise<void> {
  if (refreshToken) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  await recordAudit({
    action: AUDIT_ACTIONS.LOGOUT,
    entityType: 'Session',
    request,
  });
}

/**
 * Profilo dell'utente corrente, arricchito con i dati specifici del ruolo:
 * l'app mobile riceve tutto ciò che serve per scegliere la navigazione.
 */
export async function getCurrentUser(auth: AuthContext) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: auth.userId },
    include: {
      client: { include: { advisor: { include: { user: true } } } },
      advisor: { include: { _count: { select: { clients: true } } } },
    },
  });

  const base = {
    ...toSessionUser(user),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  };

  if (user.client) {
    return {
      ...base,
      profile: {
        type: 'CLIENT' as const,
        clientId: user.client.id,
        clientCode: user.client.clientCode,
        riskProfile: user.client.riskProfile,
        city: user.client.city,
        onboardedAt: user.client.onboardedAt.toISOString().slice(0, 10),
        ibanMasked: user.client.ibanMasked,
        advisor: {
          id: user.client.advisor.id,
          name: `${user.client.advisor.user.firstName} ${user.client.advisor.user.lastName}`,
          email: user.client.advisor.user.email,
          phone: user.client.advisor.user.phone,
          officeCity: user.client.advisor.officeCity,
        },
      },
    };
  }

  if (user.advisor) {
    return {
      ...base,
      profile: {
        type: 'ADVISOR' as const,
        advisorId: user.advisor.id,
        code: user.advisor.code,
        officeCity: user.advisor.officeCity,
        bio: user.advisor.bio,
        clientsCount: user.advisor._count.clients,
      },
    };
  }

  return { ...base, profile: { type: 'ADMIN' as const } };
}

/**
 * Credenziali demo esposte dall'API (solo prototipo).
 * Permettono di provare il backend e, in FASE 2, di precompilare il login.
 */
export async function listDemoAccounts() {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    include: {
      client: { select: { clientCode: true, riskProfile: true } },
      advisor: { select: { code: true, _count: { select: { clients: true } } } },
    },
  });

  /**
   * Ordinamento per codice (CLI-0001, CNS-001, ...) e non per email: in cima
   * restano gli account "vetrina" del seed, quelli con lo scenario più ricco.
   * È l'elenco che si usa durante la presentazione.
   */
  const sortKey = (user: (typeof users)[number]) =>
    user.client?.clientCode ?? user.advisor?.code ?? user.email;

  const pick = (role: Role, limit: number) =>
    users
      .filter((u) => u.role === role)
      .sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
      .slice(0, limit)
      .map((u) => ({
        email: u.email,
        password: env.auth.demoPassword,
        role: u.role,
        name: `${u.firstName} ${u.lastName}`,
        detail: u.client
          ? `Cliente ${u.client.clientCode} · profilo ${u.client.riskProfile}`
          : u.advisor
            ? `Consulente ${u.advisor.code} · ${u.advisor._count.clients} clienti`
            : 'Direzione · analytics aziendali',
      }));

  return {
    note: 'Account dimostrativi con dati fittizi. Tutti condividono la stessa password.',
    password: env.auth.demoPassword,
    accounts: [...pick('CLIENT', 4), ...pick('ADVISOR', 3), ...pick('ADMIN', 1)],
  };
}
