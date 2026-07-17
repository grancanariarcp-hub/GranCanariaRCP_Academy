import PDFDocument from 'pdfkit';

/**
 * On-demand "legajo" (academic record) PDF — A4, generated in memory and
 * streamed to the client. Never stored on disk or R2.
 */

export interface LegajoCourse {
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  duration_hours: number | null;
  acreditacion: string | null;
  cfc: string | null;
  publico_objetivo: string[] | null;
}
export interface LegajoData {
  name: string;
  email?: string | null;
  headline?: string | null;
  taught: LegajoCourse[];   // cursos impartidos (profesor)
  received: LegajoCourse[]; // cursos realizados y aprobados (alumno)
}

const M = { top: 90, bottom: 70, left: 60, right: 60 };
const BRAND = '#1a365d';
const GREY = '#718096';

function fmtDate(d: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('es-ES');
  } catch {
    return '—';
  }
}

function drawHeader(doc: PDFKit.PDFDocument): void {
  doc.fontSize(15).fillColor(BRAND).font('Helvetica-Bold').text('Gran Canaria RCP · Campus', M.left, 38);
  doc.moveTo(M.left, 62).lineTo(doc.page.width - M.right, 62).lineWidth(1).strokeColor('#cbd5e0').stroke();
  doc.fillColor('#000').font('Helvetica');
}

// Column layout (content width = 595 - 60 - 60 = 475).
const COLS = [
  { key: 'curso', label: 'Curso', x: 60, w: 140 },
  { key: 'fechas', label: 'Fechas', x: 200, w: 78 },
  { key: 'horas', label: 'Horas', x: 278, w: 36 },
  { key: 'acred', label: 'Acreditación', x: 314, w: 95 },
  { key: 'cfc', label: 'CFC', x: 409, w: 46 },
  { key: 'publico', label: 'Público', x: 455, w: 80 },
];

function drawTableHeader(doc: PDFKit.PDFDocument, y: number): number {
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(GREY);
  for (const c of COLS) doc.text(c.label.toUpperCase(), c.x, y, { width: c.w });
  doc.moveTo(M.left, y + 14).lineTo(doc.page.width - M.right, y + 14).lineWidth(0.7).strokeColor('#cbd5e0').stroke();
  doc.font('Helvetica').fillColor('#000');
  return y + 20;
}

function drawBlock(doc: PDFKit.PDFDocument, title: string, courses: LegajoCourse[]): void {
  doc.fontSize(13).font('Helvetica-Bold').fillColor(BRAND).text(title, M.left, doc.y);
  doc.font('Helvetica').fillColor('#000').moveDown(0.4);
  let y = drawTableHeader(doc, doc.y);

  for (const c of courses) {
    const cells: Record<string, string> = {
      curso: c.title,
      fechas: c.starts_at || c.ends_at ? `${fmtDate(c.starts_at)}–${fmtDate(c.ends_at)}` : '—',
      horas: c.duration_hours ? String(c.duration_hours) : '—',
      acred: c.acreditacion || '—',
      cfc: c.cfc || '—',
      publico: (c.publico_objetivo && c.publico_objetivo.length ? c.publico_objetivo.join(', ') : '—'),
    };
    doc.fontSize(9);
    const rowH = Math.max(...COLS.map((col) => doc.heightOfString(cells[col.key], { width: col.w }))) + 8;

    // Page break if the row wouldn't fit.
    if (y + rowH > doc.page.height - M.bottom) {
      doc.addPage();
      y = M.top;
      y = drawTableHeader(doc, y);
    }
    for (const col of COLS) doc.fillColor('#000').text(cells[col.key], col.x, y, { width: col.w });
    y += rowH;
    doc.moveTo(M.left, y - 4).lineTo(doc.page.width - M.right, y - 4).lineWidth(0.4).strokeColor('#edf2f7').stroke();
    doc.y = y;
  }
  if (courses.length === 0) {
    doc.fontSize(10).fillColor(GREY).text('Sin registros.', M.left, y);
    doc.fillColor('#000');
  }
}

export function renderLegajo(doc: PDFKit.PDFDocument, data: LegajoData): void {
  doc.on('pageAdded', () => drawHeader(doc));
  doc.addPage(); // first page → triggers header

  // Filiación
  doc.fontSize(19).font('Helvetica-Bold').fillColor('#1a202c').text('Legajo académico', M.left, M.top);
  doc.font('Helvetica').fillColor('#000').fontSize(11).moveDown(0.6);
  doc.text(`Nombre y apellidos: ${data.name}`);
  if (data.headline) doc.text(`Titulación / especialidad: ${data.headline}`);
  if (data.email) doc.text(`Email: ${data.email}`);
  doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-ES')}`);
  doc.moveDown(1.2);

  // Bloques: nunca comparten página.
  let firstBlock = true;
  if (data.taught.length > 0) {
    drawBlock(doc, 'Cursos impartidos (docente)', data.taught);
    firstBlock = false;
  }
  if (data.received.length > 0) {
    if (!firstBlock) doc.addPage();
    doc.y = M.top;
    drawBlock(doc, 'Cursos realizados (alumno)', data.received);
  }
  if (data.taught.length === 0 && data.received.length === 0) {
    doc.fontSize(11).fillColor(GREY).text('Todavía no hay cursos registrados.', M.left, doc.y);
  }

  // "Página X de Y" en cada página.
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.fontSize(9).fillColor(GREY).text(`Página ${i + 1} de ${range.count}`, M.left, doc.page.height - 45, {
      width: doc.page.width - M.left - M.right,
      align: 'center',
    });
  }
}
