import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { notFound } from '../lib/errors.js';
import { buildPdf, formatEur, type PdfDocumentSpec } from '../lib/pdf.js';
import { toISODate } from '../lib/dates.js';
import { DOCUMENT_CATEGORY_LABELS, type DocumentCategory } from '../domain/enums.js';

/**
 * Documenti del prototipo.
 *
 * I PDF sono FITTIZI e generati dal backend (nessun file reale dell'azienda).
 * Vengono salvati su filesystem in `STORAGE_DIR` e serviti via
 * `GET /documents/:id/file`, così l'app mobile può aprirli nel visualizzatore
 * nativo o scaricarli.
 */

async function ensureStorage(): Promise<void> {
  await mkdir(env.storageDir, { recursive: true });
}

export function toDocumentDTO(document: {
  id: string;
  title: string;
  category: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  proposalId: string | null;
}) {
  return {
    id: document.id,
    title: document.title,
    category: document.category,
    categoryLabel: DOCUMENT_CATEGORY_LABELS[document.category as DocumentCategory] ?? document.category,
    fileName: document.fileName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    sizeLabel: `${Math.max(1, Math.round(document.sizeBytes / 1024))} KB`,
    proposalId: document.proposalId,
    createdAt: document.createdAt.toISOString(),
    /** URL relativo: l'app mobile lo compone con la base URL configurata. */
    downloadPath: `/api/v1/documents/${document.id}/file`,
  };
}

export async function listClientDocuments(clientId: string, category?: string) {
  const documents = await prisma.document.findMany({
    where: { clientId, ...(category ? { category } : {}) },
    orderBy: { createdAt: 'desc' },
  });
  return documents.map(toDocumentDTO);
}

export async function readDocumentFile(storageKey: string): Promise<Buffer> {
  // `basename` neutralizza qualsiasi tentativo di path traversal.
  const path = join(env.storageDir, basename(storageKey));
  try {
    return await readFile(path);
  } catch {
    throw notFound('File del documento non disponibile. Rieseguire il seed dei dati demo.');
  }
}

/** Scrive un PDF su disco e registra il documento a database. */
export async function storeGeneratedDocument(params: {
  clientId: string;
  proposalId?: string | null;
  title: string;
  category: DocumentCategory;
  fileName: string;
  spec: PdfDocumentSpec;
}) {
  await ensureStorage();

  const buffer = buildPdf(params.spec);
  const safeName = basename(params.fileName);
  await writeFile(join(env.storageDir, safeName), buffer);

  return prisma.document.create({
    data: {
      clientId: params.clientId,
      proposalId: params.proposalId ?? null,
      title: params.title,
      category: params.category,
      fileName: safeName,
      mimeType: 'application/pdf',
      sizeBytes: buffer.byteLength,
      storageKey: safeName,
    },
  });
}

/** Scheda proposta in PDF: allegata automaticamente a ogni proposta creata. */
export async function generateProposalDocument(proposalId: string) {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      client: { include: { user: true } },
      advisor: { include: { user: true } },
      items: { include: { assetClass: true } },
      allocations: { include: { assetClass: true } },
    },
  });
  if (!proposal) throw notFound('Proposta non trovata.');

  const spec: PdfDocumentSpec = {
    title: 'Scheda proposta di investimento',
    subtitle: proposal.title,
    reference: `${proposal.code} · emessa il ${toISODate(proposal.createdAt)}`,
    sections: [
      {
        heading: 'Dati generali',
        rows: [
          { label: 'Cliente', value: `${proposal.client.user.firstName} ${proposal.client.user.lastName}` },
          { label: 'Codice cliente', value: proposal.client.clientCode },
          { label: 'Consulente', value: `${proposal.advisor.user.firstName} ${proposal.advisor.user.lastName}` },
          { label: 'Importo complessivo', value: formatEur(proposal.amount) },
          { label: 'Valida fino al', value: toISODate(proposal.expiresAt) },
        ],
      },
      { heading: 'Descrizione', paragraphs: [proposal.description] },
      ...(proposal.rationale ? [{ heading: 'Motivazione', paragraphs: [proposal.rationale] }] : []),
      {
        heading: 'Operazioni proposte',
        rows: proposal.items.map((item) => ({
          label: `${item.action} · ${item.instrumentName}`,
          value: formatEur(item.amount),
        })),
      },
      ...(proposal.allocations.length > 0
        ? [
            {
              heading: 'Asset allocation: attuale / proposta',
              rows: proposal.allocations.map((allocation) => ({
                label: allocation.assetClass.label,
                value: `${allocation.currentPct.toFixed(1)}%  ->  ${allocation.proposedPct.toFixed(1)}%`,
              })),
            },
          ]
        : []),
    ],
    footerNote:
      'Documento dimostrativo generato da un prototipo. Dati fittizi, nessun valore contrattuale. ' +
      "L'accettazione all'interno dell'app simula l'esperienza utente e non costituisce firma elettronica qualificata.",
  };

  return storeGeneratedDocument({
    clientId: proposal.clientId,
    proposalId: proposal.id,
    title: `Scheda proposta ${proposal.code}`,
    category: 'PROPOSAL',
    fileName: `${proposal.code.toLowerCase()}-scheda-proposta.pdf`,
    spec,
  });
}
