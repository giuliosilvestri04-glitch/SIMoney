import { prisma } from '../lib/prisma.js';
import { forbidden, notFound } from '../lib/errors.js';
import type { Role } from '../domain/enums.js';

/**
 * ============================================================================
 * AUTORIZZAZIONI — PERIMETRO DATI (requisito 26)
 * ============================================================================
 *
 * Principio: il perimetro di un utente si deriva SEMPRE dal token, mai da un
 * parametro della richiesta.
 *
 *   CLIENT   → esclusivamente il proprio `clientId`
 *   ADVISOR  → esclusivamente i clienti a lui assegnati
 *   ADMIN    → tutti i clienti
 *
 * Le rotte del cliente non espongono alcun `:clientId`: cambiare un ID per
 * vedere i dati di un altro cliente è strutturalmente impossibile.
 * Dove un ID è necessario (consulente), si passa da `assertAdvisorOwnsClient`,
 * che risponde 404 — non 403 — per non rivelare l'esistenza della risorsa.
 */

export interface AuthContext {
  userId: string;
  role: Role;
  email: string;
}

/** Identificativo del cliente corrispondente all'utente autenticato. */
export async function requireClientId(auth: AuthContext): Promise<string> {
  if (auth.role !== 'CLIENT') {
    throw forbidden('Questa sezione è riservata ai clienti.');
  }
  const client = await prisma.client.findUnique({
    where: { userId: auth.userId },
    select: { id: true },
  });
  if (!client) throw notFound('Nessuna posizione cliente associata a questo utente.');
  return client.id;
}

/** Identificativo del consulente corrispondente all'utente autenticato. */
export async function requireAdvisorId(auth: AuthContext): Promise<string> {
  if (auth.role !== 'ADVISOR') {
    throw forbidden('Questa sezione è riservata ai consulenti.');
  }
  const advisor = await prisma.advisor.findUnique({
    where: { userId: auth.userId },
    select: { id: true },
  });
  if (!advisor) throw notFound('Nessun profilo consulente associato a questo utente.');
  return advisor.id;
}

/**
 * Verifica che il cliente indicato appartenga al consulente autenticato.
 * Restituisce l'id del cliente solo se il controllo passa.
 */
export async function assertAdvisorOwnsClient(advisorId: string, clientId: string): Promise<string> {
  const client = await prisma.client.findFirst({
    where: { id: clientId, advisorId },
    select: { id: true },
  });
  // 404 anche quando il cliente esiste ma è di un altro consulente:
  // evita l'enumerazione degli identificativi.
  if (!client) throw notFound('Cliente non trovato tra quelli assegnati.');
  return client.id;
}

/**
 * Risolve il cliente accessibile a chi sta effettuando la richiesta.
 * Unico punto di ingresso per le viste "dettaglio cliente".
 */
export async function resolveAccessibleClientId(
  auth: AuthContext,
  requestedClientId?: string,
): Promise<string> {
  if (auth.role === 'CLIENT') {
    return requireClientId(auth);
  }

  if (!requestedClientId) throw notFound('Cliente non specificato.');

  if (auth.role === 'ADVISOR') {
    const advisorId = await requireAdvisorId(auth);
    return assertAdvisorOwnsClient(advisorId, requestedClientId);
  }

  if (auth.role === 'ADMIN') {
    const client = await prisma.client.findUnique({
      where: { id: requestedClientId },
      select: { id: true },
    });
    if (!client) throw notFound('Cliente non trovato.');
    return client.id;
  }

  throw forbidden();
}

/** Elenco dei clienti visibili: usato dalle aggregazioni (analytics, storico). */
export async function scopedClientIds(auth: AuthContext): Promise<string[]> {
  if (auth.role === 'CLIENT') {
    return [await requireClientId(auth)];
  }
  if (auth.role === 'ADVISOR') {
    const advisorId = await requireAdvisorId(auth);
    const clients = await prisma.client.findMany({ where: { advisorId }, select: { id: true } });
    return clients.map((c) => c.id);
  }
  const clients = await prisma.client.findMany({ select: { id: true } });
  return clients.map((c) => c.id);
}

/**
 * Documento accessibile all'utente corrente.
 * Un cliente vede solo i propri documenti, un consulente solo quelli dei
 * clienti assegnati, l'admin tutti.
 */
export async function assertDocumentAccess(auth: AuthContext, documentId: string) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { client: { select: { id: true, advisorId: true, userId: true } } },
  });
  if (!document) throw notFound('Documento non trovato.');

  if (auth.role === 'CLIENT' && document.client.userId !== auth.userId) {
    throw notFound('Documento non trovato.');
  }

  if (auth.role === 'ADVISOR') {
    const advisorId = await requireAdvisorId(auth);
    if (document.client.advisorId !== advisorId) throw notFound('Documento non trovato.');
  }

  return document;
}
