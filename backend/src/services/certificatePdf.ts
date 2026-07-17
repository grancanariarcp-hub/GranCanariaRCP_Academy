import type PDFDocument from 'pdfkit';

export interface CertData {
  certifica: string;
  studentName: string;
  courseTitle: string;
  modality: string;      // online / mixto / presencial
  dateRange: string;     // "entre dd/mm/yyyy y dd/mm/yyyy" or ""
  hours: string;         // "8" or "—"
  cfc?: string | null;
  firmante1?: { nombre: string | null; cargo: string | null } | null;
  firmante2?: { nombre: string | null; cargo: string | null } | null;
  issued: string;        // fecha de emisión
  bgBuffer?: Buffer;     // imagen de fondo (opcional; si no, blanco)
  cfcImgBuffer?: Buffer; // imagen de los CFC (opcional)
}

/** A4 landscape certificate. Doc must be created with layout: 'landscape'. */
export function renderCertificate(doc: PDFKit.PDFDocument, d: CertData): void {
  const W = doc.page.width;
  const H = doc.page.height;

  // Fondo (o blanco por defecto).
  if (d.bgBuffer) {
    try { doc.image(d.bgBuffer, 0, 0, { width: W, height: H }); } catch { /* ignore bad image */ }
  }

  // Marco.
  doc.save().lineWidth(2).strokeColor('#1a365d').rect(22, 22, W - 44, H - 44).stroke().restore();

  const cx = 70;
  const cw = W - 140;

  doc.fillColor('#1a365d').font('Helvetica-Bold').fontSize(16).text('GRAN CANARIA RCP · CAMPUS', cx, 48, { width: cw, align: 'center' });
  doc.fillColor('#111').font('Helvetica').fontSize(13).text(`${d.certifica || 'Gran Canaria RCP'} certifica que:`, cx, 118, { width: cw, align: 'center' });
  doc.fillColor('#1a202c').font('Helvetica-Bold').fontSize(30).text(d.studentName, cx, 150, { width: cw, align: 'center' });

  const cuerpo = `APROBÓ el curso «${d.courseTitle}», desarrollado ${d.modality}${d.dateRange ? ' ' + d.dateRange : ''}, con un total de ${d.hours} horas.`;
  doc.fillColor('#111').font('Helvetica').fontSize(14).text(cuerpo, cx, 210, { width: cw, align: 'center', lineGap: 4 });

  if (d.cfc) {
    doc.fillColor('#276749').font('Helvetica-Bold').fontSize(12).text(`CFC: ${d.cfc}`, cx, 268, { width: cw, align: 'center' });
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

  // Imagen de los CFC (opcional).
  if (d.cfcImgBuffer) {
    try { doc.image(d.cfcImgBuffer, W - 150, H - 115, { fit: [100, 75] }); } catch { /* ignore */ }
  }

  doc.fillColor('#777').font('Helvetica').fontSize(9).text(`Emitido: ${d.issued}`, 40, H - 42, { width: 220 });
}
