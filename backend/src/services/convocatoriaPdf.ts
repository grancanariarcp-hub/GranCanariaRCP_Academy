/**
 * Documento de convocatoria de oposición en A4 vertical.
 *
 * Reúne los datos formales de la convocatoria (organismo, plazas, plazo,
 * requisitos) y el temario que se desprende de sus bancos de preguntas. Es un
 * documento de la academia para orientar al opositor: el pie deja claro que el
 * texto con validez es el del boletín oficial correspondiente, no este.
 */

export interface ConvocatoriaPdfData {
  name: string;
  organismo: string | null;
  comunidad: string | null;
  categoria: string | null;
  anio: number | null;
  plazas: number | null;
  fechaPublicacion: string | null;
  plazoDesde: string | null;
  plazoHasta: string | null;
  requisitos: string | null;
  descripcion: string | null;
  basesUrl: string | null;
  boletinRef: string | null;
  temario: string[];
  generadoEl: string; // ISO
}

const NAVY = '#1a365d';
const GRIS = '#555';

function fecha(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function renderConvocatoria(doc: PDFKit.PDFDocument, d: ConvocatoriaPdfData): void {
  const M = 50;
  const W = doc.page.width;
  const anchoUtil = W - M * 2;

  const cabecera = () => {
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11).text('Gran Canaria RCP · Preparación de oposiciones', M, 40);
    doc.moveTo(M, 60).lineTo(W - M, 60).strokeColor(NAVY).lineWidth(1).stroke();
  };
  const pie = () => {
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.fillColor(GRIS).font('Helvetica').fontSize(7.5);
      doc.text(
        'Documento informativo de la academia. El texto con validez legal es el publicado en el boletín oficial correspondiente.',
        M, doc.page.height - 52, { width: anchoUtil, align: 'center' },
      );
      doc.text(`Página ${i + 1} de ${range.count} · generado el ${fecha(d.generadoEl)}`, M, doc.page.height - 40, { width: anchoUtil, align: 'center' });
    }
  };

  const asegurar = (alto: number) => {
    if (doc.y + alto > doc.page.height - 70) { doc.addPage(); cabecera(); doc.y = 78; }
  };
  const seccion = (t: string) => {
    asegurar(40);
    doc.moveDown(0.6);
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(12).text(t, M, doc.y);
    doc.moveTo(M, doc.y + 2).lineTo(W - M, doc.y + 2).strokeColor('#cbd5e0').lineWidth(0.5).stroke();
    doc.moveDown(0.4);
  };
  const campos = (filas: Array<[string, string]>) => {
    doc.font('Helvetica').fontSize(10.5);
    for (const [k, v] of filas) {
      asegurar(18);
      const y = doc.y;
      doc.fillColor(GRIS).font('Helvetica-Bold').text(`${k}:`, M, y, { width: 150, continued: false });
      doc.fillColor('#1a202c').font('Helvetica').text(v || '—', M + 155, y, { width: anchoUtil - 155 });
      doc.moveDown(0.3);
    }
  };
  const parrafo = (t: string) => {
    doc.font('Helvetica').fontSize(10.5).fillColor('#1a202c');
    for (const linea of t.split('\n')) {
      asegurar(16);
      doc.text(linea || ' ', M, doc.y, { width: anchoUtil, align: 'justify' });
    }
  };

  // --- portada ---
  cabecera();
  doc.y = 90;
  doc.fillColor(GRIS).font('Helvetica-Bold').fontSize(13).text('CONVOCATORIA', M, doc.y, { width: anchoUtil, align: 'center' });
  doc.moveDown(0.2);
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(19).text(d.name, M, doc.y, { width: anchoUtil, align: 'center' });
  if (d.organismo) {
    doc.moveDown(0.2);
    doc.fillColor(GRIS).font('Helvetica').fontSize(12).text(d.organismo, M, doc.y, { width: anchoUtil, align: 'center' });
  }
  doc.moveDown(1);

  seccion('Datos de la convocatoria');
  campos([
    ['Organismo', d.organismo ?? '—'],
    ['Ámbito', d.comunidad ?? '—'],
    ['Categoría / plaza', d.categoria ?? '—'],
    ['Año', d.anio ? String(d.anio) : '—'],
    ['Plazas', d.plazas != null ? String(d.plazas) : '—'],
  ]);

  seccion('Publicación y plazo de solicitud');
  campos([
    ['Fecha de publicación', fecha(d.fechaPublicacion)],
    ['Plazo de solicitud', d.plazoDesde || d.plazoHasta ? `del ${fecha(d.plazoDesde)} al ${fecha(d.plazoHasta)}` : '—'],
    ...(d.boletinRef ? [['Referencia (boletín)', d.boletinRef] as [string, string]] : []),
    ...(d.basesUrl ? [['Bases completas', d.basesUrl] as [string, string]] : []),
  ]);

  if (d.requisitos && d.requisitos.trim()) {
    seccion('Requisitos');
    parrafo(d.requisitos.trim());
  }

  if (d.descripcion && d.descripcion.trim()) {
    seccion('Descripción');
    parrafo(d.descripcion.trim());
  }

  if (d.temario.length > 0) {
    seccion('Temario');
    doc.font('Helvetica').fontSize(10.5).fillColor('#1a202c');
    d.temario.forEach((t, i) => {
      asegurar(16);
      doc.text(`${i + 1}. ${t}`, M + 6, doc.y, { width: anchoUtil - 6 });
      doc.moveDown(0.2);
    });
    doc.moveDown(0.3);
    doc.fillColor(GRIS).font('Helvetica-Oblique').fontSize(9)
      .text('Temario orientativo, elaborado a partir de las materias de los bancos de preguntas de esta convocatoria.', M, doc.y, { width: anchoUtil });
  }

  pie();
}
