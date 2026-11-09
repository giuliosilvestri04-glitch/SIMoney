/**
 * Generatore PDF minimale, senza dipendenze esterne.
 *
 * Serve a produrre i documenti fittizi del prototipo (schede proposta,
 * rendiconti). Sono PDF 1.4 validi, apribili dal visualizzatore nativo di
 * Android e iOS e scaricabili.
 *
 * Non è una libreria di reportistica: copre esattamente ciò che serve alla demo
 * (testo, titoli, righe separatrici, tabelle a due colonne).
 */

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const BRAND = { r: 0.12, g: 0.23, b: 0.37 };

export interface PdfRow {
  label: string;
  value: string;
}

export interface PdfSection {
  heading?: string;
  paragraphs?: string[];
  rows?: PdfRow[];
}

export interface PdfDocumentSpec {
  title: string;
  subtitle?: string;
  reference?: string;
  sections: PdfSection[];
  footerNote?: string;
}

/** Escape dei caratteri speciali nelle stringhe letterali PDF. */
function esc(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** Spezza un testo lungo in righe che stanno nella larghezza utile. */
function wrap(text: string, fontSize: number, maxWidth: number): string[] {
  const charWidth = fontSize * 0.5; // approssimazione sufficiente per Helvetica
  const maxChars = Math.max(20, Math.floor(maxWidth / charWidth));
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

export function buildPdf(spec: PdfDocumentSpec): Buffer {
  const contentWidth = PAGE_WIDTH - MARGIN * 2;
  const ops: string[] = [];
  let y = PAGE_HEIGHT - MARGIN;

  const text = (value: string, size: number, font: 'F1' | 'F2', x: number, yPos: number) => {
    ops.push('BT', `/${font} ${size} Tf`, `1 0 0 1 ${x.toFixed(2)} ${yPos.toFixed(2)} Tm`, `(${esc(value)}) Tj`, 'ET');
  };

  // Barra superiore con il nome del prototipo.
  ops.push(
    `${BRAND.r} ${BRAND.g} ${BRAND.b} rg`,
    `0 ${(PAGE_HEIGHT - 96).toFixed(2)} ${PAGE_WIDTH.toFixed(2)} 96 re f`,
    '1 1 1 rg',
  );
  text('PROTOTIPO — DOCUMENTO DIMOSTRATIVO', 9, 'F1', MARGIN, PAGE_HEIGHT - 40);
  text(spec.title, 18, 'F2', MARGIN, PAGE_HEIGHT - 64);
  if (spec.subtitle) text(spec.subtitle, 10, 'F1', MARGIN, PAGE_HEIGHT - 82);
  ops.push('0 0 0 rg');

  y = PAGE_HEIGHT - 130;

  if (spec.reference) {
    ops.push('0.45 0.45 0.45 rg');
    text(`Riferimento: ${spec.reference}`, 9, 'F1', MARGIN, y);
    ops.push('0 0 0 rg');
    y -= 26;
  }

  for (const section of spec.sections) {
    if (y < MARGIN + 90) break; // documento a pagina singola: sufficiente per la demo

    if (section.heading) {
      text(section.heading.toUpperCase(), 10, 'F2', MARGIN, y);
      y -= 8;
      ops.push(
        '0.82 0.82 0.82 RG',
        '0.7 w',
        `${MARGIN} ${y.toFixed(2)} m ${(MARGIN + contentWidth).toFixed(2)} ${y.toFixed(2)} l S`,
      );
      y -= 18;
    }

    for (const paragraph of section.paragraphs ?? []) {
      for (const line of wrap(paragraph, 10, contentWidth)) {
        text(line, 10, 'F1', MARGIN, y);
        y -= 14;
      }
      y -= 6;
    }

    for (const row of section.rows ?? []) {
      ops.push('0.35 0.35 0.35 rg');
      text(row.label, 9.5, 'F1', MARGIN, y);
      ops.push('0 0 0 rg');
      text(row.value, 10, 'F2', MARGIN + contentWidth * 0.52, y);
      y -= 17;
    }

    y -= 12;
  }

  // Piè di pagina
  ops.push('0.45 0.45 0.45 rg');
  const footer =
    spec.footerNote ??
    'Documento generato automaticamente da un prototipo dimostrativo. Dati fittizi, privo di valore contrattuale.';
  let footerY = MARGIN + 18;
  for (const line of wrap(footer, 8, contentWidth)) {
    text(line, 8, 'F1', MARGIN, footerY);
    footerY -= 10;
  }
  ops.push('0 0 0 rg');

  const content = ops.join('\n');
  const contentLength = Buffer.byteLength(content, 'latin1');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(2)}] ` +
      '/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${contentLength} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}

/** Formattazione valuta coerente con la UI italiana. */
export function formatEur(value: number): string {
  return `EUR ${value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
