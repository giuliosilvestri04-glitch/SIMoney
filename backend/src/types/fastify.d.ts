import type { AuthContext } from '../services/access.service.js';
import type { Role } from '../domain/enums.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Popolato dal plugin di autenticazione dopo la verifica del token. */
    auth?: AuthContext;
  }

  interface FastifyInstance {
    /** preHandler: richiede un access token valido. */
    authenticate: import('fastify').preHandlerHookHandler;
    /** preHandler factory: richiede uno dei ruoli indicati. */
    requireRole: (...roles: Role[]) => import('fastify').preHandlerHookHandler;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; role: Role; email: string };
    user: { sub: string; role: Role; email: string; iat: number; exp: number };
  }
}
