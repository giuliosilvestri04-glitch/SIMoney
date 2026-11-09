import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import type { Role } from '../domain/enums.js';

/**
 * Autenticazione JWT e guard di ruolo.
 *
 * Due livelli distinti:
 *   1. `authenticate` — il token è valido e l'utente è ancora attivo.
 *   2. `requireRole`  — l'utente ha uno dei ruoli ammessi sulla rotta.
 *
 * Il perimetro sui dati (quali clienti, quali proposte) NON si decide qui:
 * è responsabilità di `access.service.ts`.
 */
async function authPlugin(app: FastifyInstance) {
  await app.register(jwt, {
    secret: env.auth.accessSecret,
    sign: { expiresIn: env.auth.accessTtl },
    messages: {
      badRequestErrorMessage: 'Header Authorization non valido.',
      noAuthorizationInHeaderMessage: 'Token di accesso mancante.',
      authorizationTokenExpiredMessage: 'Sessione scaduta.',
      authorizationTokenInvalid: 'Token di accesso non valido.',
    },
  });

  app.decorate('authenticate', async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Token non valido.';
      const expired = message.toLowerCase().includes('scadut') || message.toLowerCase().includes('expired');
      throw unauthorized(message, expired ? 'TOKEN_EXPIRED' : 'UNAUTHORIZED');
    }

    const payload = request.user;

    // Un account disattivato non deve poter continuare a usare un token valido.
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, email: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw unauthorized('Utenza non attiva o inesistente.', 'ACCOUNT_INACTIVE');
    }

    request.auth = { userId: user.id, role: user.role as Role, email: user.email };
  });

  app.decorate('requireRole', (...roles: Role[]) => {
    return async (request: FastifyRequest, _reply: FastifyReply) => {
      if (!request.auth) throw unauthorized();
      if (!roles.includes(request.auth.role)) {
        throw forbidden(`Operazione consentita solo ai ruoli: ${roles.join(', ')}.`);
      }
    };
  });
}

export default fp(authPlugin, { name: 'auth-plugin' });
