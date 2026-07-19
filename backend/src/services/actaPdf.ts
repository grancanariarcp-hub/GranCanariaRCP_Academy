import type { ActaSnapshot } from './actaData.js';

/**
 * Acta del curso en A4 vertical.
 *
 * Documento serio: sin adornos, con numeración de páginas, secciones
 * identificables y pie de verificación en todas las hojas. Lo que se imprime
 * sale del snapshot congelado, nunca de una consulta en vivo.
 */

export interface ActaPdfData {
  snapshot: ActaSnapshot;
  numero: string;
  version: number;
  hash: string;
  closedAt: string;
  qrBuffer?: Buffer;
  verifyUrl?: string;
  /** Marca de agua para el borrador previo al cierre. */
  borrador?: boolean;
}

/** NUMERIC llega como cadena ("20.0"): se imprime sin decimales inútiles. */
function horas(v: number | null): string {
  if (v === null || v === undefined) return 'no declarada';
  const n = Number(v);
  return `${Number.isInteger(n) ? n : n.toFixed(1)} horas`;
}

const NAVY = '#1a365d';
const GRIS = '#555';

export function renderActa(doc: PDFKit.PDFDocument, d: ActaPdfData): void {
  const s = d.snapshot;
  const M = 50;
  const W = doc.page.width;
  const anchoUtil = W - M * 2;

  let pagina = 0;
  const nuevaPagina = (primera = false) => {
    if (!primera) doc.addPage();
    pagina++;
    cabecera(doc, d, M, anchoUtil, W);
    if (d.borrador) marcaBorrador(doc, W);
    doc.y = 108;
  };

  // Salto de página cuando el bloque siguiente no cabe.
  const asegurar = (alto: number) => {
    if (doc.y + alto > doc.page.height - 78) nuevaPagina();
  };

  nuevaPagina(true);

  titulo(doc, 'ACTA DE LA ACTIVIDAD FORMATIVA', M, anchoUtil, 16, true);
  doc.moveDown(0.6);

  // ----------------------------------------------------------- identificación
  seccion(doc, '1. Identificación de la actividad', M, anchoUtil);
  campos(doc, M, anchoUtil, [
    ['Denominación', s.curso.titulo],
    ['Área / tema', [s.curso.tema, s.curso.subtema].filter(Boolean).join(' · ') || '—'],
    ['Modalidad', s.curso.modalidad],
    ['Periodo de impartición', s.curso.periodo],
    ['Duración lectiva', horas(s.curso.horas)],
    ['Dirigida a', s.curso.publicoObjetivo.length ? s.curso.publicoObjetivo.join(', ') : '—'],
    ...(s.curso.acreditacion ? [['Acreditación', s.curso.acreditacion] as [string, string]] : []),
    ...(s.curso.cfc ? [['Créditos CFC', s.curso.cfc] as [string, string]] : []),
  ]);

  // -------------------------------------------------------------- profesorado
  asegurar(90);
  seccion(doc, '2. Dirección y profesorado', M, anchoUtil);
  campos(doc, M, anchoUtil, [['Director/a del curso', s.director ?? 'no designado']]);
  doc.moveDown(0.2);
  for (const p of s.profesorado) {
    asegurar(18);
    doc.font('Helvetica').fontSize(10).fillColor('#111')
      .text(`• ${p.nombre}${p.titular ? ` — ${p.titular}` : ''} (${p.rol === 'director' ? 'director/a' : 'docente'})`,
        M + 8, doc.y, { width: anchoUtil - 8 });
    doc.moveDown(0.25);
  }

  // ---------------------------------------------------------------- objetivos
  if (s.curso.objetivoGeneral || s.curso.objetivosEspecificos) {
    asegurar(80);
    seccion(doc, '3. Objetivos', M, anchoUtil);
    if (s.curso.objetivoGeneral) {
      etiqueta(doc, 'General', M);
      doc.font('Helvetica').fontSize(10).fillColor('#111')
        .text(s.curso.objetivoGeneral, M, doc.y, { width: anchoUtil, align: 'justify' });
      doc.moveDown(0.5);
    }
    if (s.curso.objetivosEspecificos) {
      etiqueta(doc, 'Específicos', M);
      doc.font('Helvetica').fontSize(10).fillColor('#111')
        .text(s.curso.objetivosEspecificos, M, doc.y, { width: anchoUtil, align: 'justify' });
      doc.moveDown(0.5);
    }
  }

  // ------------------------------------------------------------------ temario
  asegurar(70);
  seccion(doc, '4. Temario impartido', M, anchoUtil);
  for (const m of s.temario) {
    asegurar(24);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111').text(m.modulo, M + 8, doc.y, { width: anchoUtil - 8 });
    if (m.actividades.length > 0) {
      doc.font('Helvetica').fontSize(9).fillColor(GRIS)
        .text(m.actividades.join(' · '), M + 18, doc.y + 1, { width: anchoUtil - 18 });
    }
    doc.moveDown(0.45);
  }

  // ----------------------------------------------------------------- resumen
  asegurar(110);
  seccion(doc, '5. Resultados globales', M, anchoUtil);
  campos(doc, M, anchoUtil, [
    ['Alumnos matriculados', String(s.resumen.matriculados)],
    ['Presentados a evaluación', String(s.resumen.presentados)],
    ['Aptos', String(s.resumen.aptos)],
    ['No aptos', String(s.resumen.noAptos)],
    ...(s.resumen.notaMedia !== null ? [['Calificación media', `${s.resumen.notaMedia} / 100`] as [string, string]] : []),
    ...(s.resumen.jornadasPresenciales > 0
      ? [
        ['Jornadas presenciales', String(s.resumen.jornadasPresenciales)] as [string, string],
        ['Asistencia media', s.resumen.asistenciaMedia !== null ? `${s.resumen.asistenciaMedia} %` : '—'] as [string, string],
        ['Asistencia mínima exigida', `${s.curso.minAsistenciaPct} %`] as [string, string],
      ]
      : []),
  ]);

  // ------------------------------------------------------------ calificaciones
  asegurar(90);
  seccion(doc, '6. Relación de alumnos y calificaciones', M, anchoUtil);
  tablaAlumnos(doc, s, M, anchoUtil, asegurar, nuevaPagina);

  // ------------------------------------------------------------------ encuesta
  asegurar(100);
  seccion(doc, '7. Evaluación de la actividad por el alumnado', M, anchoUtil);
  if (s.encuesta.respuestas === 0) {
    doc.font('Helvetica-Oblique').fontSize(10).fillColor(GRIS)
      .text('No se registraron respuestas a la encuesta de satisfacción.', M + 8, doc.y, { width: anchoUtil - 8 });
    doc.moveDown(0.6);
  } else {
    campos(doc, M, anchoUtil, [
      ['Respuestas', `${s.encuesta.respuestas} (${s.encuesta.participacionPct} % de participación)`],
      ['Valoración global', s.encuesta.mediaGlobal !== null ? `${s.encuesta.mediaGlobal} / 10` : '—'],
      ['La recomendarían', s.encuesta.recomiendanPct !== null ? `${s.encuesta.recomiendanPct} %` : '—'],
    ]);
    for (const i of s.encuesta.porItem.slice(0, 14)) {
      asegurar(15);
      doc.font('Helvetica').fontSize(9).fillColor('#111')
        .text(`• ${i.etiqueta}: ${i.media !== null ? `${i.media} / 10` : 'sin valorar'} (n=${i.n})`,
          M + 8, doc.y, { width: anchoUtil - 8 });
      doc.moveDown(0.22);
    }
  }

  // ------------------------------------------------------------------- cierre
  asegurar(150);
  seccion(doc, '8. Cierre y firma', M, anchoUtil);
  doc.font('Helvetica').fontSize(10).fillColor('#111')
    .text(
      `Se cierra la presente acta el ${new Date(d.closedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}, ` +
      `haciendo constar la veracidad de los datos consignados y de los resultados obtenidos por el alumnado relacionado.`,
      M, doc.y, { width: anchoUtil, align: 'justify' },
    );
  doc.moveDown(2.2);

  const yFirma = doc.y;
  doc.moveTo(M, yFirma).lineTo(M + 220, yFirma).lineWidth(0.8).strokeColor(GRIS).stroke();
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111')
    .text(s.director ?? 'El/la responsable de la actividad', M, yFirma + 6, { width: 220 });
  doc.font('Helvetica').fontSize(9).fillColor(GRIS).text('Director/a del curso', M, yFirma + 20, { width: 220 });

  if (d.qrBuffer) {
    const qs = 84;
    doc.image(d.qrBuffer, W - M - qs, yFirma - 14, { width: qs, height: qs });
    doc.font('Helvetica').fontSize(7).fillColor(GRIS)
      .text('Verificar autenticidad', W - M - qs - 20, yFirma + qs - 8, { width: qs + 40, align: 'center' });
  }

  // Pie en todas las páginas: el rango se recorre al final para saber el total.
  const total = doc.bufferedPageRange().count;
  for (let i = 0; i < total; i++) {
    doc.switchToPage(i);
    pie(doc, d, M, anchoUtil, W, i + 1, total);
  }
}

function cabecera(doc: PDFKit.PDFDocument, d: ActaPdfData, M: number, ancho: number, W: number): void {
  doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY)
    .text('GRAN CANARIA RCP · CAMPUS DE FORMACIÓN', M, 40, { width: ancho, characterSpacing: 0.6 });
  doc.font('Helvetica').fontSize(9).fillColor(GRIS)
    .text(`Acta ${d.numero}${d.version > 1 ? ` · versión ${d.version}` : ''}`, M, 40, { width: ancho, align: 'right' });
  doc.moveTo(M, 58).lineTo(W - M, 58).lineWidth(1).strokeColor(NAVY).stroke();
}

function marcaBorrador(doc: PDFKit.PDFDocument, W: number): void {
  doc.save();
  doc.rotate(-32, { origin: [W / 2, 380] });
  doc.font('Helvetica-Bold').fontSize(72).fillColor('#c41e3a').opacity(0.09)
    .text('BORRADOR', 0, 340, { width: W, align: 'center' });
  doc.opacity(1).restore();
}

function pie(doc: PDFKit.PDFDocument, d: ActaPdfData, M: number, ancho: number, W: number, n: number, total: number): void {
  const H = doc.page.height;
  doc.moveTo(M, H - 58).lineTo(W - M, H - 58).lineWidth(0.5).strokeColor('#c8d3e0').stroke();
  doc.font('Helvetica').fontSize(7).fillColor('#777')
    .text(
      d.borrador
        ? 'Documento provisional sin validez: el acta no ha sido cerrada.'
        : `Documento verificable en ${d.verifyUrl || 'la plataforma'} · Huella SHA-256: ${d.hash}`,
      M, H - 50, { width: ancho - 60 },
    );
  doc.text(`Página ${n} de ${total}`, M, H - 50, { width: ancho, align: 'right' });
}

function titulo(doc: PDFKit.PDFDocument, texto: string, M: number, ancho: number, size: number, centrado = false): void {
  doc.font('Helvetica-Bold').fontSize(size).fillColor(NAVY)
    .text(texto, M, doc.y, { width: ancho, align: centrado ? 'center' : 'left', characterSpacing: 0.5 });
}

function seccion(doc: PDFKit.PDFDocument, texto: string, M: number, ancho: number): void {
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY).text(texto, M, doc.y, { width: ancho });
  doc.moveTo(M, doc.y + 2).lineTo(M + ancho, doc.y + 2).lineWidth(0.5).strokeColor('#9fb3c8').stroke();
  doc.moveDown(0.55);
}

function etiqueta(doc: PDFKit.PDFDocument, texto: string, M: number): void {
  doc.font('Helvetica-Bold').fontSize(9).fillColor(GRIS).text(texto, M, doc.y);
  doc.moveDown(0.1);
}

function campos(doc: PDFKit.PDFDocument, M: number, ancho: number, filas: Array<[string, string]>): void {
  const anchoEtiqueta = 165;
  for (const [k, v] of filas) {
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(GRIS).text(`${k}:`, M + 8, y, { width: anchoEtiqueta });
    doc.font('Helvetica').fontSize(9.5).fillColor('#111')
      .text(v, M + 8 + anchoEtiqueta, y, { width: ancho - anchoEtiqueta - 16 });
    doc.moveDown(0.32);
  }
  doc.moveDown(0.25);
}

function tablaAlumnos(
  doc: PDFKit.PDFDocument,
  s: ActaSnapshot,
  M: number,
  ancho: number,
  asegurar: (alto: number) => void,
  _nuevaPagina: () => void,
): void {
  const hayAsistencia = s.resumen.jornadasPresenciales > 0;
  const cols = hayAsistencia ? [26, 210, 78, 70, 70] : [30, 280, 92, 92];
  const cab = hayAsistencia
    ? ['Nº', 'Apellidos, nombre', 'DNI', 'Asistencia', 'Calificación']
    : ['Nº', 'Apellidos, nombre', 'DNI', 'Calificación'];
  // La última columna absorbe el sobrante para que la tabla llegue al margen.
  cols[cols.length - 1] = ancho - cols.slice(0, -1).reduce((a, b) => a + b, 0);

  const filaCabecera = () => {
    doc.rect(M, doc.y, ancho, 18).fillColor('#eef2f7').fill();
    let x = M;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#333');
    cab.forEach((c, i) => {
      doc.text(c, x + 4, doc.y + 5, { width: cols[i] - 8, lineBreak: false });
      x += cols[i];
    });
    doc.y += 18;
  };

  filaCabecera();

  s.alumnos.forEach((al, i) => {
    if (doc.y + 17 > doc.page.height - 78) {
      asegurar(1000); // fuerza salto
      filaCabecera();
    }
    const y = doc.y;
    doc.rect(M, y, ancho, 17).lineWidth(0.4).strokeColor('#d5dee8').stroke();
    let x = M;
    const valores = hayAsistencia
      ? [
        String(i + 1), al.nombre, al.dni || '—',
        al.asistenciaPct !== null ? `${al.asistenciaPct} %` : '—',
        al.notaFinal !== null ? `${al.notaFinal} · ${al.apto ? 'APTO' : 'NO APTO'}` : 'No presentado',
      ]
      : [
        String(i + 1), al.nombre, al.dni || '—',
        al.notaFinal !== null ? `${al.notaFinal} · ${al.apto ? 'APTO' : 'NO APTO'}` : 'No presentado',
      ];
    doc.font('Helvetica').fontSize(8.5).fillColor('#111');
    valores.forEach((v, j) => {
      doc.text(v, x + 4, y + 5, { width: cols[j] - 8, lineBreak: false, ellipsis: true });
      x += cols[j];
    });
    doc.y = y + 17;
  });

  if (s.alumnos.length === 0) {
    doc.font('Helvetica-Oblique').fontSize(9).fillColor(GRIS)
      .text('Sin alumnos matriculados.', M + 8, doc.y + 6, { width: ancho - 16 });
    doc.moveDown(1);
  }
  doc.moveDown(0.6);
}
