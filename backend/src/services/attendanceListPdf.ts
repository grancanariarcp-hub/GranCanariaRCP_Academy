import type PDFDocument from 'pdfkit';

export interface AlumnoFila {
  apellidos: string;
  nombre: string;
  dni: string;
}

export interface ListaAsistenciaData {
  courseTitle: string;
  sessionTitle: string;
  fecha: string;
  horario: string;
  director: string;
  alumnos: AlumnoFila[];
}

/**
 * Listado de asistencia para firmar a mano, A4 apaisado.
 *
 * Cada página repite el encabezado con curso y fecha, porque las hojas se
 * separan al archivarlas y una hoja suelta sin identificar no vale como
 * justificante. Las columnas de firma se dejan en blanco a propósito: este
 * documento es el soporte manuscrito que se adjunta al acta.
 */
export function renderListaAsistencia(doc: PDFKit.PDFDocument, d: ListaAsistenciaData): void {
  const NAVY = '#1a365d';
  const W = doc.page.width;
  const M = 34;
  const anchoUtil = W - M * 2;

  // Nº de orden, Apellidos, Nombres, DNI, firma entrada, firma salida
  const COLS = [34, 190, 150, 90, 0, 0];
  const restante = anchoUtil - COLS.slice(0, 4).reduce((a, b) => a + b, 0);
  COLS[4] = Math.floor(restante / 2);
  COLS[5] = restante - COLS[4];
  const CABECERAS = ['Nº', 'APELLIDOS', 'NOMBRE', 'DNI', 'FIRMA ENTRADA', 'FIRMA SALIDA'];

  const ALTO_FILA = 30;
  let y = 0;

  function encabezado(pagina: number, totalPaginas: number): void {
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(14)
      .text(d.courseTitle, M, 28, { width: anchoUtil, align: 'center' });
    doc.font('Helvetica').fontSize(10).fillColor('#333')
      .text(`${d.sessionTitle} · ${d.fecha}${d.horario ? ` · ${d.horario}` : ''}`, M, 46, {
        width: anchoUtil, align: 'center',
      });
    doc.fontSize(8).fillColor('#777')
      .text(`Hoja ${pagina} de ${totalPaginas}`, M, 28, { width: anchoUtil, align: 'right' });

    doc.moveTo(M, 64).lineTo(W - M, 64).lineWidth(1).strokeColor(NAVY).stroke();

    // Fila de cabeceras
    y = 74;
    doc.rect(M, y, anchoUtil, 22).fillColor('#eef2f7').fill();
    let x = M;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#333');
    CABECERAS.forEach((c, i) => {
      doc.text(c, x + 5, y + 7, { width: COLS[i] - 10, align: i <= 3 ? 'left' : 'center' });
      x += COLS[i];
    });
    y += 22;
  }

  function fila(indice: number, a: AlumnoFila | null): void {
    doc.rect(M, y, anchoUtil, ALTO_FILA).lineWidth(0.5).strokeColor('#c8d3e0').stroke();
    let x = M;
    COLS.forEach((ancho, i) => {
      if (i > 0) doc.moveTo(x, y).lineTo(x, y + ALTO_FILA).lineWidth(0.5).strokeColor('#c8d3e0').stroke();
      x += ancho;
    });

    if (!a) return; // fila en blanco para incorporaciones de última hora
    doc.font('Helvetica').fontSize(9).fillColor('#111');
    const valores = [String(indice), a.apellidos, a.nombre, a.dni];
    x = M;
    valores.forEach((v, i) => {
      doc.text(v, x + 5, y + 10, { width: COLS[i] - 10, ellipsis: true, lineBreak: false });
      x += COLS[i];
    });
  }

  // Cuántas filas caben por página, dejando sitio al pie de firma del docente.
  const alturaDisponible = doc.page.height - 96 - 74;
  const porPagina = Math.floor(alturaDisponible / ALTO_FILA);
  // Tres filas en blanco al final para quien se incorpore sin estar en lista.
  const totalFilas = d.alumnos.length + 3;
  const totalPaginas = Math.max(1, Math.ceil(totalFilas / porPagina));

  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    if (pagina > 1) doc.addPage();
    encabezado(pagina, totalPaginas);
    for (let i = 0; i < porPagina; i++) {
      const indice = (pagina - 1) * porPagina + i;
      if (indice >= totalFilas) break;
      fila(indice + 1, d.alumnos[indice] ?? null);
      y += ALTO_FILA;
    }
    pie(doc, d, W, M);
  }
}

function pie(doc: PDFKit.PDFDocument, d: ListaAsistenciaData, W: number, M: number): void {
  const H = doc.page.height;
  doc.font('Helvetica').fontSize(8).fillColor('#666')
    .text(
      'Documento de control de asistencia. Los datos identificativos se tratan con la única finalidad de acreditar ' +
      'la participación en la actividad formativa y su custodia corresponde a la entidad organizadora.',
      M, H - 58, { width: W - M * 2 - 220 },
    );
  doc.moveTo(W - M - 200, H - 42).lineTo(W - M, H - 42).lineWidth(0.8).strokeColor('#555').stroke();
  doc.fontSize(8).fillColor('#333')
    .text(d.director ? `Fdo.: ${d.director}` : 'Fdo.: el/la responsable de la actividad', W - M - 200, H - 36, {
      width: 200, align: 'center',
    });
}
