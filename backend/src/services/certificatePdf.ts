import type PDFDocument from 'pdfkit';

export interface CertData {
  certifica: string;
  studentName: string;
  courseTitle: string;
  modality: string;      // online / mixto / presencial
  dateRange: string;     // "entre dd/mm/yyyy y dd/mm/yyyy" or ""
  hours: string;         // "8" or "—"
  cfc?: string | null;
  acreditacion?: string | null; // texto de certificación oficial (opcional)
  firmante1?: { nombre: string | null; cargo: string | null } | null;
  firmante2?: { nombre: string | null; cargo: string | null } | null;
  issued: string;        // fecha de emisión
  bgBuffer?: Buffer;     // imagen de fondo (opcional; si no, blanco)
  cfcImgBuffer?: Buffer; // imagen de los CFC (opcional)
  qrBuffer?: Buffer;     // QR (PNG) a la ficha pública del curso (opcional)
  qrCaption?: string;    // texto bajo el QR
}

/** A4 landscape certificate. Doc must be created with layout: 'landscape'. */
export function renderCertificate(doc: PDFKit.PDFDocument, d: CertData): void {
  const W = doc.page.width;
  const H = doc.page.height;
  const NAVY = '#1a365d';

  // Fondo (o blanco por defecto). Si hay fondo propio, reducimos nuestro marco
  // para no competir con el diseño de la imagen.
  const hasBg = !!d.bgBuffer;
  if (hasBg) {
    try { doc.image(d.bgBuffer!, 0, 0, { width: W, height: H }); } catch { /* ignore bad image */ }
  }

  // Marco doble (solo si no hay imagen de fondo con su propio diseño).
  if (!hasBg) {
    doc.save().lineWidth(3).strokeColor(NAVY).rect(20, 20, W - 40, H - 40).stroke().restore();
    doc.save().lineWidth(1).strokeColor('#9fb3c8').rect(30, 30, W - 60, H - 60).stroke().restore();
  }

  const cx = 70;
  const cw = W - 140;

  if (!hasBg) {
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(15).text('GRAN CANARIA RCP · CAMPUS', cx, 52, { width: cw, align: 'center', characterSpacing: 1 });
    doc.moveTo(W / 2 - 60, 76).lineTo(W / 2 + 60, 76).lineWidth(1.5).strokeColor('#c41e3a').stroke();
  }

  // Título grande.
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(34).text('CERTIFICADO', cx, hasBg ? 60 : 96, { width: cw, align: 'center', characterSpacing: 3 });

  doc.fillColor('#333').font('Helvetica').fontSize(12).text(`${d.certifica || 'Gran Canaria RCP'} certifica que:`, cx, hasBg ? 118 : 150, { width: cw, align: 'center' });

  // Nombre del alumno.
  doc.fillColor('#1a202c').font('Helvetica-Bold').fontSize(30).text(d.studentName, cx, hasBg ? 142 : 176, { width: cw, align: 'center' });
  // Subrayado del nombre.
  const nameLineY = (hasBg ? 142 : 176) + 40;
  doc.moveTo(W / 2 - 180, nameLineY).lineTo(W / 2 + 180, nameLineY).lineWidth(0.6).strokeColor('#9fb3c8').stroke();

  const cuerpo = `APROBÓ el curso «${d.courseTitle}», desarrollado ${d.modality}${d.dateRange ? ' ' + d.dateRange : ''}, con un total de ${d.hours} horas.`;
  doc.fillColor('#111').font('Helvetica').fontSize(14).text(cuerpo, cx, hasBg ? 210 : 238, { width: cw, align: 'center', lineGap: 4 });

  let y = hasBg ? 262 : 290;
  if (d.cfc) {
    doc.fillColor('#276749').font('Helvetica-Bold').fontSize(12).text(`CFC: ${d.cfc}`, cx, y, { width: cw, align: 'center' });
    y += 22;
  }
  if (d.acreditacion) {
    doc.fillColor('#555').font('Helvetica-Oblique').fontSize(10).text(d.acreditacion, W / 2 - 130, y, { width: 260, align: 'center' });
  }

  // Firmantes.
  const sy = H - 130;
  const drawSigner = (x: number, s: { nombre: string | null; cargo: string | null }) => {
    doc.moveTo(x, sy).lineTo(x + 180, sy).lineWidth(0.8).strokeColor('#555').stroke();
    doc.fillColor('#111').font('Helvetica-Bold').fontSize(11).text(s.nombre ?? '', x, sy + 6, { width: 180, align: 'center' });
    if (s.cargo) doc.font('Helvetica').fontSize(9).fillColor('#555').text(s.cargo, x, sy + 20, { width: 180, align: 'center' });
  };
  const f1 = d.firmante1?.nombre ? d.firmante1 : null;
  const f2 = d.firmante2?.nombre ? d.firmante2 : null;
  if (f1 && f2) { drawSigner(W / 2 - 220, f1); drawSigner(W / 2 + 40, f2); }
  else if (f1) drawSigner(W / 2 - 90, f1);
  else if (f2) drawSigner(W / 2 - 90, f2);

  // Imagen de los CFC (opcional), abajo a la izquierda.
  if (d.cfcImgBuffer) {
    try { doc.image(d.cfcImgBuffer, 45, H - 120, { fit: [100, 75] }); } catch { /* ignore */ }
  }

  // QR a la ficha pública del curso (abajo a la derecha). Se genera al vuelo:
  // no ocupa almacenamiento.
  if (d.qrBuffer) {
    const qs = 78;
    const qx = W - qs - 45;
    const qy = H - qs - 40;
    try { doc.image(d.qrBuffer, qx, qy, { width: qs, height: qs }); } catch { /* ignore */ }
    doc.fillColor('#555').font('Helvetica').fontSize(7).text(d.qrCaption ?? 'Programa y verificación', qx - 20, qy + qs + 2, { width: qs + 40, align: 'center' });
  }

  doc.fillColor('#777').font('Helvetica').fontSize(9).text(`Emitido: ${d.issued}`, 40, H - 42, { width: 220 });
}
