/**
 * Diploma de participación en A4 apaisado.
 *
 * Comparte lenguaje visual con el certificado de aprobación, pero NUNCA usa la
 * palabra "certificado" ni menciona créditos: es un diploma de agradecimiento y
 * no debe poder confundirse con la formación oficial. La distinción es
 * deliberada y aparece también al pie.
 */

import { logoHorizontal, logoEmblema } from './brandAssets.js';

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

  // Logotipo arriba y centrado. Se dibuja también sobre el fondo subido: es la
  // marca del documento y debe aparecer siempre en el mismo sitio.
  const logo = logoHorizontal();
  let y = 40;
  if (logo) {
    const anchoLogo = 210;
    const altoLogo = Math.round(anchoLogo * (255 / 1070)); // proporción del original
    doc.image(logo, W / 2 - anchoLogo / 2, y, { width: anchoLogo });
    y += altoLogo + 16;
  } else if (!hayFondo) {
    doc.font('Helvetica-Bold').fontSize(14).fillColor(NAVY)
      .text('GRAN CANARIA RCP', cx, y + 14, { width: cw, align: 'center', characterSpacing: 1.4 });
    y += 44;
  }

  if (!hayFondo) {
    doc.moveTo(W / 2 - 60, y).lineTo(W / 2 + 60, y).lineWidth(1.5).strokeColor(ROJO).stroke();
    y += 22;
  }

  // Título
  doc.font('Helvetica-Bold').fontSize(30).fillColor(NAVY)
    .text(d.encabezado || 'DIPLOMA DE PARTICIPACIÓN', cx, y, { width: cw, align: 'center', characterSpacing: 2.2 });
  y += 52;

  // "Gran Canaria RCP AGRADECE a" — el agradecimiento es el tono del documento.
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#444')
    .text(`${d.certifica} AGRADECE a`, cx, y, { width: cw, align: 'center', characterSpacing: 0.8 });
  y += 32;

  // Nombre
  doc.font('Helvetica-Bold').fontSize(31).fillColor('#1a202c')
    .text(d.nombre, cx, y, { width: cw, align: 'center' });
  y += 42;
  doc.moveTo(W / 2 - 200, y).lineTo(W / 2 + 200, y).lineWidth(0.6).strokeColor('#9fb3c8').stroke();
  y += 26;

  // Cuerpo
  doc.font('Helvetica').fontSize(15).fillColor('#111')
    .text(d.cuerpo, cx + 30, y, { width: cw - 60, align: 'center', lineGap: 6 });

  // Frase de cierre, en cursiva y destacada
  if (d.frase) {
    doc.font('Helvetica-Oblique').fontSize(13.5).fillColor(ROJO)
      .text(d.frase, cx + 50, doc.y + 12, { width: cw - 100, align: 'center', lineGap: 4 });
  }

  // Emblema en marca de agua: ocupa el espacio central sin competir con el
  // texto y refuerza la marca en algo pensado para compartirse.
  const emblema = logoEmblema();
  if (emblema && !hayFondo) {
    const tam = 150;
    doc.save().opacity(0.07);
    doc.image(emblema, W / 2 - tam / 2, H - 310, { fit: [tam, tam], align: 'center' });
    doc.opacity(1).restore();
  }

  // Firmantes
  const sy = H - 118;
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
    const qs = 72;
    const qx = W - qs - 48;
    const qy = H - qs - 56;
    doc.image(d.qrBuffer, qx, qy, { width: qs, height: qs });
    doc.font('Helvetica').fontSize(7).fillColor('#555')
      .text('Verificar', qx - 20, qy + qs + 2, { width: qs + 40, align: 'center' });
  }

  // Pie: la distinción con la formación acreditada va SIEMPRE, con o sin fondo.
  doc.font('Helvetica').fontSize(8).fillColor('#777')
    .text(`Emitido: ${d.emitido} · Código ${d.codigo}`, 46, H - 60, { width: 280 });
  doc.font('Helvetica-Oblique').fontSize(7.5).fillColor('#8b95a1')
    .text(
      'Diploma de participación. No constituye formación acreditada ni otorga créditos de formación continuada.',
      46, H - 48, { width: W - 230 },
    );
}
