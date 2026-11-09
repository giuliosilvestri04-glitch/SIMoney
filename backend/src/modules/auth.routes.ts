import type { FastifyInstance } from 'fastify';
import { getCurrentUser, listDemoAccounts, login, logout, refreshSession } from '../services/auth.service.js';
import { unauthorized } from '../lib/errors.js';
import { commonErrors, loginBodySchema, ok, okWithErrors, refreshBodySchema } from '../http/schemas.js';

export default async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: { email: string; password: string } }>(
    '/auth/login',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags: ['Auth'],
        summary: 'Login e determinazione del ruolo',
        description:
          'Restituisce access token, refresh token e il profilo dell\'utente. ' +
          'Il campo `user.role` (CLIENT | ADVISOR | ADMIN) determina quale area ' +
          'dell\'app mobile aprire subito dopo il login.',
        body: loginBodySchema,
        response: {
          ...ok('Autenticazione riuscita'),
          401: { ...commonErrors[401], description: 'Credenziali non valide' },
        },
      },
    },
    async (request) => {
      const result = await login(app, request.body, request);
      return { data: { user: result.user, ...result.tokens } };
    },
  );

  app.post<{ Body: { refreshToken: string } }>(
    '/auth/refresh',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Rinnovo della sessione',
        description:
          'Scambia un refresh token valido con una nuova coppia di token (rotazione). ' +
          'Permette all\'app di restare autenticata senza chiedere di nuovo la password.',
        body: refreshBodySchema,
        response: { ...ok('Sessione rinnovata'), 401: commonErrors[401] },
      },
    },
    async (request) => {
      const result = await refreshSession(app, request.body.refreshToken, request);
      return { data: { user: result.user, ...result.tokens } };
    },
  );

  app.post<{ Body: { refreshToken?: string } }>(
    '/auth/logout',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Logout e revoca del refresh token',
        body: {
          type: 'object',
          properties: { refreshToken: { type: 'string' } },
          additionalProperties: false,
        },
        response: ok('Sessione chiusa'),
      },
    },
    async (request) => {
      await logout(request.body?.refreshToken, request);
      return { data: { message: 'Sessione chiusa correttamente.' } };
    },
  );

  app.get(
    '/auth/me',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['Auth'],
        summary: 'Utente autenticato',
        description:
          'Profilo completo con i dati specifici del ruolo (cliente: consulente di riferimento; ' +
          'consulente: numero di clienti).',
        security: [{ bearerAuth: [] }],
        response: okWithErrors('Profilo utente'),
      },
    },
    async (request) => {
      if (!request.auth) throw unauthorized();
      return { data: await getCurrentUser(request.auth) };
    },
  );

  app.get(
    '/auth/demo-accounts',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Credenziali demo del prototipo',
        description:
          'SOLO PROTOTIPO: elenca gli account dimostrativi per provare l\'API senza frontend ' +
          'e per precompilare la schermata di login durante la presentazione.',
        response: ok('Account dimostrativi'),
      },
    },
    async () => ({ data: await listDemoAccounts() }),
  );
}
