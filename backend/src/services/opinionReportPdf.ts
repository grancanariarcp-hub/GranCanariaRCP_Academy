/**
 * Informe visual de OPINIONES de un curso (escalas Likert y encuestas de
 * selección múltiple). Sirve tanto para el informe global del curso (todas las
 * encuestas) como para el de una sola encuesta: cambia solo el conjunto de datos.
 *
 * Diseño pensado para leerse de un vistazo: cada pregunta se representa con
 * barras proporcionales; en las escalas 1-5 se usa una gama de color
 * rojo→verde y se destaca la media.
 */

export type EscalaStat = {
  id: string; text: string; format: 'escala';
  etiquetaMin: string; etiquetaMax: string; dist: number[]; n: number; media: number | null;
};
export type MultiStat = {
  id: string; text: string; format: 'multiple';
  opciones: Array<{ text: string; count: number }>; n: number;
};
export type OpinionStat = EscalaStat | MultiStat;

export interface OpinionReportData {
  courseTitle: string;
  fecha: string;
  scope: 'global' | 'encuesta';
  examenes: Array<{ examTitle: string; preguntas: OpinionStat[] }>;
}

const NAVY = '#1a365d';
const INK = '#1f2933';
const MUTED = '#6b7280';
const TRACK = '#eef2f7';
const BLUE = '#2c5282';
// Gama de color para la escala 1..5 (rojo → verde).
const LIKERT = ['#e04b4b', '#e8843c', '#f0b429', '#7cb342', '#2f9e44'];

export function renderOpinionReport(doc: PDFKit.PDFDocument, d: OpinionReportData): void {
  const W = doc.page.width;
  const H = doc.page.height;
  const M = 40;
  const AW = W - M * 2; // ancho útil
  const BOTTOM = H - 54; // límite inferior antes del pie

  let y = 0;
  let pagina = 0;

  function pie(): void {
    doc.font('Helvetica').fontSize(8).fillColor(MUTED)
      .text('GranCanaria RCP · Informe de opiniones', M, H - 34, { width: AW - 60, lineBreak: false });
    doc.text(`Página ${pagina}`, W - M - 60, H - 34, { width: 60, align: 'right' });
  }

  function nuevaPagina(primera = false): void {
    if (!primera) doc.addPage();
    pagina += 1;
    // Banda superior de color.
    doc.rect(0, 0, W, 70).fillColor(NAVY).fill();
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(17)
      .text('Informe de opiniones', M, 20, { width: AW, lineBreak: false });
    doc.font('Helvetica').fontSize(10).fillColor('#cbd5e1')
      .text(`${d.courseTitle}${d.scope === 'global' ? ' · todas las encuestas' : ''}  ·  ${d.fecha}`,
        M, 44, { width: AW, lineBreak: false });
    pie();
    y = 92;
  }

  function asegurar(alto: number): void {
    if (y + alto > BOTTOM) nuevaPagina();
  }

  // Barra horizontal genérica: etiqueta a la izquierda, pista, relleno y cifra.
  function barra(label: string, labelW: number, pct: number, color: string, cifra: string): void {
    const alto = 15;
    const x0 = M + labelW + 6;
    const trackW = AW - labelW - 6 - 74;
    doc.font('Helvetica').fontSize(9).fillColor(INK)
      .text(label, M, y + 2, { width: labelW, align: labelW <= 20 ? 'right' : 'left', ellipsis: true, lineBreak: false });
    doc.roundedRect(x0, y, trackW, alto, 3).fillColor(TRACK).fill();
    const w = Math.max(0, Math.min(1, pct / 100)) * trackW;
    if (w > 0) doc.roundedRect(x0, y, Math.max(w, 2), alto, 3).fillColor(color).fill();
    doc.font('Helvetica').fontSize(8).fillColor(MUTED)
      .text(cifra, x0 + trackW + 6, y + 3, { width: 68, align: 'left', lineBreak: false });
    y += alto + 5;
  }

  function encabezadoEncuesta(titulo: string, n: number): void {
    asegurar(34);
    doc.roundedRect(M, y, AW, 24, 4).fillColor('#eaf0f7').fill();
    doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY)
      .text(titulo, M + 10, y + 6, { width: AW - 140, ellipsis: true, lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor(MUTED)
      .text(`${n} respuesta(s)`, M + AW - 130, y + 7, { width: 120, align: 'right', lineBreak: false });
    y += 34;
  }

  function pregunta(q: OpinionStat): void {
    // Texto de la pregunta (puede ocupar varias líneas).
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK);
    const th = doc.heightOfString(q.text, { width: AW });
    const cuerpo = q.format === 'escala' ? 5 * 20 + 18 : q.opciones.length * 20;
    asegurar(th + cuerpo + 14);
    doc.text(q.text, M, y, { width: AW });
    y += th + 6;

    if (q.format === 'escala') {
      // Media destacada + etiquetas de los extremos.
      doc.font('Helvetica').fontSize(9).fillColor(MUTED)
        .text(`${q.etiquetaMin} (1) → ${q.etiquetaMax} (5)`, M, y + 3, { width: AW - 120, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY)
        .text(`Media ${q.media ?? '—'} / 5`, M + AW - 120, y, { width: 120, align: 'right', lineBreak: false });
      y += 18;
      for (let v = 1; v <= 5; v++) {
        const c = q.dist[v - 1] ?? 0;
        const pct = q.n ? Math.round((c / q.n) * 100) : 0;
        barra(String(v), 16, pct, LIKERT[v - 1], `${c} · ${pct}%`);
      }
    } else {
      for (const o of q.opciones) {
        const pct = q.n ? Math.round((o.count / q.n) * 100) : 0;
        barra(o.text, 150, pct, BLUE, `${o.count} · ${pct}%`);
      }
    }
    y += 8;
  }

  nuevaPagina(true);

  if (d.examenes.length === 0 || d.examenes.every((e) => e.preguntas.length === 0)) {
    doc.font('Helvetica').fontSize(11).fillColor(MUTED)
      .text('Todavía no hay respuestas de encuestas o preguntas de opinión en este curso.', M, y, { width: AW });
    return;
  }

  for (const ex of d.examenes) {
    if (ex.preguntas.length === 0) continue;
    // Nº de respuestas de la encuesta = máximo de respuestas entre sus preguntas.
    const n = ex.preguntas.reduce((m, q) => Math.max(m, q.n), 0);
    encabezadoEncuesta(ex.examTitle, n);
    for (const q of ex.preguntas) pregunta(q);
    y += 6;
  }
}
