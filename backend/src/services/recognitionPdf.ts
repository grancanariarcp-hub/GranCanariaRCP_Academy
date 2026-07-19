/**
 * Diploma de participación en A4 apaisado.
 *
 * Comparte lenguaje visual con el certificado de aprobación, pero NUNCA usa la
 * palabra "certificado" ni menciona créditos: es un diploma de agradecimiento y
 * no debe poder confundirse con la formación oficial. La distinción es
 * deliberada y aparece también al pie.
 */

export interface ReconocimientoData {
  /** Encabezado del documento, según el motivo. */
  encabezado?: string;
  certifica: string;
  titulo: string;
  nombre: string;
  cuerpo: string;
  frase?: string | null;
  emitido: string;
  codigo: string;
  firmante1?: { nombre: string; cargo: string } | null;
  firmante2?: { nombre: string; cargo: string } | null;
  bgBuffer?: Buffer;
  qrBuffer?: Buffer;
}

const NAVY = '#1a365d';
const ROJO = '#c41e3a';

export function renderReconocimiento(doc: PDFKit.PDFDocument, d: ReconocimientoData): void {
  const W = doc.page.width;
  const H = doc.page.height;
  const hayFondo = !!d.bgBuffer;

  if (d.bgBuffer) {
    doc.image(d.bgBuffer, 0, 0, { width: W, height: H });
  } else {
    doc.lineWidth(3).strokeColor(NAVY).rect(20, 20, W - 40, H - 40).stroke();
    doc.lineWidth(1).strokeColor('#9fb3c8').rect(30, 30, W - 60, H - 60).stroke();
  }

  const cx = 70;
  const cw = W - 140;

  if (!hayFondo) {
    doc.font('Helvetica-Bold').fontSize(14).fillColor(NAVY)
      .text('GRAN CANARIA RCP', cx, 50, { width: cw, align: 'center', characterSpacing: 1.4 });
    doc.moveTo(W / 2 - 60, 74).lineTo(W / 2 + 60, 74).lineWidth(1.5).strokeColor(ROJO).stroke();
  }

  // Título
  doc.font('Helvetica-Bold').fontSize(29).fillColor(NAVY)
    .text(d.encabezado || 'DIPLOMA DE PARTICIPACIÓN', cx, hayFondo ? 62 : 96,
      { width: cw, align: 'center', characterSpacing: 2 });

  // "Gran Canaria RCP AGRADECE a" — el agradecimiento es el tono del documento.
  doc.font('Helvetica-Bold').fontSize(12.5).fillColor('#444')
    .text(`${d.certifica} AGRADECE a`, cx, hayFondo ? 112 : 142,
      { width: cw, align: 'center', characterSpacing: 0.8 });

  // Nombre
  const yNombre = hayFondo ? 138 : 170;
  doc.font('Helvetica-Bold').fontSize(29).fillColor('#1a202c')
    .text(d.nombre, cx, yNombre, { width: cw, align: 'center' });
  doc.moveTo(W / 2 - 180, yNombre + 39).lineTo(W / 2 + 180, yNombre + 39)
    .lineWidth(0.6).strokeColor('#9fb3c8').stroke();

  // Cuerpo
  doc.font('Helvetica').fontSize(14).fillColor('#111')
    .text(d.cuerpo, cx, hayFondo ? 202 : 234, { width: cw, align: 'center', lineGap: 4 });

  // Frase de cierre, en cursiva y destacada
  if (d.frase) {
    doc.font('Helvetica-Oblique').fontSize(13).fillColor(ROJO)
      .text(d.frase, cx + 40, hayFondo ? 262 : 296, { width: cw - 80, align: 'center', lineGap: 3 });
  }

  // Firmantes
  const sy = H - 128;
  const firmante = (x: number, f: { nombre: string; cargo: string }) => {
    doc.moveTo(x, sy).lineTo(x + 180, sy).lineWidth(0.8).strokeColor('#555').stroke();
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#111').text(f.nombre, x, sy + 6, { width: 180, align: 'center' });
    doc.font('Helvetica').fontSize(9).fillColor('#555').text(f.cargo, x, sy + 20, { width: 180, align: 'center' });
  };
  if (d.firmante1 && d.firmante2) {
    firmante(W / 2 - 220, d.firmante1);
    firmante(W / 2 + 40, d.firmante2);
  } else if (d.firmante1) {
    firmante(W / 2 - 90, d.firmante1);
  }

  if (d.qrBuffer) {
    const qs = 74;
    const qx = W - qs - 45;
    const qy = H - qs - 38;
    doc.image(d.qrBuffer, qx, qy, { width: qs, height: qs });
    doc.font('Helvetica').fontSize(7).fillColor('#555')
      .text('Verificar', qx - 20, qy + qs + 2, { width: qs + 40, align: 'center' });
  }

  // Pie: la distinción con la formación acreditada va SIEMPRE, con o sin fondo.
  doc.font('Helvetica').fontSize(8).fillColor('#777')
    .text(`Emitido: ${d.emitido} · Código ${d.codigo}`, 40, H - 46, { width: 260 });
  doc.font('Helvetica-Oblique').fontSize(7.5).fillColor('#888')
    .text(
      'Diploma de participación. No constituye formación acreditada ni otorga créditos de formación continuada.',
      40, H - 34, { width: W - 200 },
    );
}
