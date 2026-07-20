import type { Role } from '@/lib/auth';
import type { Articulo, Audiencia } from './tipos';
import { SECCIONES } from './tipos';
import { GENERAL } from './general';
import { ALUMNO } from './alumno';
import { PROFESOR } from './profesor';
import { ADMIN } from './admin';

export type { Articulo, Bloque, Audiencia } from './tipos';
export { SECCIONES } from './tipos';

export const ARTICULOS: Articulo[] = [...GENERAL, ...ALUMNO, ...PROFESOR, ...ADMIN];

const PORID = new Map(ARTICULOS.map((a) => [a.id, a]));

export function articulo(id: string): Articulo | undefined {
  return PORID.get(id);
}

/** Los artículos que le sirven a alguien, en el orden de los capítulos. */
export function articulosPara(rol: Role | null): Articulo[] {
  const audiencia: Audiencia = rol ?? 'publico';
  return ARTICULOS.filter((a) => a.para.includes(audiencia)).sort(
    (a, b) => SECCIONES.indexOf(a.seccion as never) - SECCIONES.indexOf(b.seccion as never),
  );
}

/** Capítulos con contenido para ese rol, respetando el orden de SECCIONES. */
export function seccionesPara(rol: Role | null): Array<{ seccion: string; articulos: Articulo[] }> {
  const suyos = articulosPara(rol);
  return SECCIONES.map((seccion) => ({
    seccion,
    articulos: suyos.filter((a) => a.seccion === seccion),
  })).filter((s) => s.articulos.length > 0);
}

/**
 * Búsqueda por palabras sueltas sobre título, resumen y cuerpo.
 *
 * Sin acentos y sin distinguir mayúsculas: quien busca ayuda escribe deprisa y
 * mal, y "certificado" debe encontrar lo mismo que "Certificádo".
 */
/** Los acentos van escritos como ̀-ͯ para no depender de cómo se
 *  guarde este fichero: son los signos diacríticos que separa NFD. */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Todo el texto de un artículo, aplanado, para poder buscar dentro. */
function textoDe(a: Articulo): string {
  const trozos: string[] = [a.titulo, a.resumen, a.seccion];
  for (const b of a.cuerpo) {
    if (b.tipo === 'pasos') trozos.push(...b.pasos);
    else if (b.tipo === 'lista') trozos.push(...b.items);
    else if (b.tipo === 'duda') trozos.push(b.pregunta, b.respuesta);
    else trozos.push(b.texto);
  }
  return normalizar(trozos.join(' '));
}

const TEXTOS = new Map(ARTICULOS.map((a) => [a.id, textoDe(a)]));

export function buscar(consulta: string, rol: Role | null): Articulo[] {
  const palabras = normalizar(consulta).split(/\s+/).filter((p) => p.length > 1);
  if (palabras.length === 0) return [];

  return articulosPara(rol)
    .map((a) => {
      const texto = TEXTOS.get(a.id)!;
      const titulo = normalizar(a.titulo);
      // Todas las palabras deben aparecer; las del título pesan más, para que
      // "acta" saque el artículo del acta antes que los que la mencionan.
      if (!palabras.every((p) => texto.includes(p))) return null;
      const puntos = palabras.reduce((n, p) => n + (titulo.includes(p) ? 10 : 1), 0);
      return { a, puntos };
    })
    .filter((r): r is { a: Articulo; puntos: number } => r !== null)
    .sort((x, y) => y.puntos - x.puntos)
    .map((r) => r.a);
}

/**
 * Qué artículo explica la pantalla en la que estás.
 *
 * Las rutas se comparan de la más específica a la más general, porque
 * /student/ope/test tiene ayuda propia y /student/ope no debe robársela.
 */
const RUTAS: Array<[RegExp, string]> = [
  // Alumno
  [/^\/student\/ope\/estadisticas/, 'ope-estadisticas'],
  [/^\/student\/ope\/test/, 'ope-test'],
  [/^\/student\/ope/, 'ope-panel'],
  [/^\/student\/curso\/[^/]+\/examen/, 'alumno-examen'],
  [/^\/student\/curso/, 'alumno-aula'],
  [/^\/student\/perfil/, 'alumno-perfil'],
  [/^\/student/, 'alumno-panel'],

  // Gestión
  [/^\/admin\/cursos\/[^/]+\/examen/, 'profesor-examen'],
  [/^\/admin\/cursos\/[^/]+/, 'profesor-alumnos'],
  [/^\/admin\/cursos/, 'profesor-curso-crear'],
  [/^\/admin\/preguntas/, 'profesor-preguntas'],
  [/^\/admin\/bancos/, 'profesor-bancos'],
  [/^\/admin\/documentos/, 'profesor-documentos'],
  [/^\/admin\/convocatorias/, 'admin-convocatorias'],
  [/^\/admin\/desafios/, 'admin-desafios'],
  [/^\/admin\/reconocimientos/, 'admin-diplomas'],
  [/^\/admin\/profesores/, 'admin-profesores'],
  [/^\/admin\/auditores/, 'admin-cfc'],
  [/^\/admin\/perfil/, 'profesor-perfil'],
  [/^\/admin$/, 'admin-resumen'],

  // Centros
  [/^\/institucion/, 'institucion-panel'],
  [/^\/maestro/, 'maestro-clases'],

  // Público
  [/^\/desafios/, 'desafios-publico'],
  [/^\/practica/, 'practica-libre'],
  [/^\/rankings/, 'desafios-publico'],
  [/^\/asistencia/, 'alumno-asistencia'],
  [/^\/curso\//, 'alumno-matricula'],
  [/^\/(certificado|acta|reconocimiento)\//, 'verificar'],
  [/^\/registro/, 'acceder'],
  [/^\/login/, 'acceder'],
  [/^\/$/, 'que-es'],
];

/** El artículo que corresponde a una ruta, o null si esa pantalla no tiene ayuda. */
export function temaDeRuta(pathname: string): string | null {
  // El auditor entra por /admin/cursos, pero lo que necesita es su propia guía.
  const encontrado = RUTAS.find(([patron]) => patron.test(pathname));
  return encontrado ? encontrado[1] : null;
}

/** Igual que temaDeRuta, pero atendiendo a quién lo pregunta. */
export function temaDePantalla(pathname: string, rol: Role | null): string | null {
  if (rol === 'auditor') return 'auditor-guia';
  return temaDeRuta(pathname);
}
