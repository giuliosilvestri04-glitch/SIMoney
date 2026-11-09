import type { FastifyInstance } from 'fastify';
import { unauthorized } from '../lib/errors.js';
import { assertDocumentAccess } from '../services/access.service.js';
import { readDocumentFile, toDocumentDTO } from '../services/document.service.js';
import { recordAudit } from '../services/audit.service.js';
import { AUDIT_ACTIONS } from '../domain/enums.js';
import { idParamSchema, okWithErrors } from '../http/schemas.js';

/**
 * Documenti.
 *
 * Accessibili a tutti i ruoli, ciascuno entro il proprio perimetro
 * (`assertDocumentAccess`): il cliente solo i propri, il consulente solo quelli
 * dei clienti assegnati, la direzione tutti.
 */
export default async function documentRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get<{ Params: { id: string } }>(
    '/documents/:id',
    {
      schema: {
        tags: ['Documenti'],
        summary: 'Metadati di un documento',
        security: [{ bearerAuth: [] }],
        params: idParamSchema,
        response: okWithErrors('Metadati del documento'),
      },
    },
    async (request) => {
      if (!request.auth) throw unauthorized();
      const document = await assertDocumentAccess(request.auth, request.params.id);
      return { data: toDocumentDTO(document) };
    },
  );

  app.get<{ Params: { id: string }; Querystring: { download?: boolean } }>(
    '/documents/:id/file',
    {
      schema: {
        tags: ['Documenti'],
        summary: 'Apertura o download del PDF',
        description:
          'Restituisce il file. Con `download=true` viene proposto il salvataggio ' +
          '(`Content-Disposition: attachment`), altrimenti si apre nel visualizzatore ' +
          'PDF dello smartphone.',
        security: [{ bearerAuth: [] }],
        params: idParamSchema,
        querystring: {
          type: 'object',
          properties: { download: { type: 'boolean', default: false } },
          additionalProperties: false,
        },
        response: {
          200: {
            description: 'File PDF',
            content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
          },
          401: { description: 'Non autenticato', type: 'object', additionalProperties: true },
          404: { description: 'Documento non trovato', type: 'object', additionalProperties: true },
        },
      },
    },
    async (request, reply) => {
      if (!request.auth) throw unauthorized();

      const document = await assertDocumentAccess(request.auth, request.params.id);
      const file = await readDocumentFile(document.storageKey);

      await recordAudit({
        action: AUDIT_ACTIONS.DOCUMENT_VIEWED,
        entityType: 'Document',
        entityId: document.id,
        metadata: { fileName: document.fileName, download: Boolean(request.query.download) },
        request,
      });

      const disposition = request.query.download ? 'attachment' : 'inline';

      return reply
        .header('Content-Type', document.mimeType)
        .header('Content-Length', file.byteLength)
        .header('Content-Disposition', `${disposition}; filename="${document.fileName}"`)
        .header('Cache-Control', 'private, max-age=300')
        .send(file);
    },
  );
}
