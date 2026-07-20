import type { Role } from '@/lib/auth';

/**
 * Manual de uso de la plataforma.
 *
 * El manual no vive en un PDF aparte que nadie abre, sino en piezas pequeñas
 * ("artículos") que se muestran dentro de la propia pantalla que explican. Cada
 * artículo tiene identidad propia para poder enlazarlo desde un botón de ayuda,
 * desde otro artículo o desde el índice general en /ayuda.
 *
 * El contenido se escribe en TypeScript en lugar de en la base de datos a
 * propósito: así viaja en el mismo commit que el cambio que documenta, y es
 * imposible que la plataforma se despliegue con la ayuda de la versión anterior.
 */

/** A quién va dirigido un artículo. 'todos' incluye a quien no ha entrado. */
export type Audiencia = Role | 'publico';

export type Bloque =
  /** Párrafo normal. Admite **negrita** y [enlaces](/ruta). */
  | { tipo: 'texto'; texto: string }
  /** Secuencia numerada: el "haz esto, luego esto". */
  | { tipo: 'pasos'; pasos: string[] }
  /** Lista sin orden, para enumerar opciones o conceptos. */
  | { tipo: 'lista'; items: string[] }
  /** Algo que conviene saber antes de equivocarse. */
  | { tipo: 'aviso'; texto: string }
  /** Atajo o buena práctica; se puede ignorar sin consecuencias. */
  | { tipo: 'truco'; texto: string }
  /** Subtítulo dentro de un artículo largo. */
  | { tipo: 'titulo'; texto: string }
  /** Pregunta y respuesta, para las dudas recurrentes. */
  | { tipo: 'duda'; pregunta: string; respuesta: string };

export interface Articulo {
  /** Identificador estable: es lo que se pasa a <Ayuda tema="..." />. */
  id: string;
  titulo: string;
  /** Una línea que resume el artículo; se ve en el índice y en el buscador. */
  resumen: string;
  /** Capítulo del manual al que pertenece. */
  seccion: string;
  /** Quién necesita este artículo. Determina qué ve cada uno en /ayuda. */
  para: Audiencia[];
  cuerpo: Bloque[];
  /** Otros artículos que se leen bien a continuación. */
  relacionados?: string[];
}

/** Capítulos del manual, en el orden en que se muestran. */
export const SECCIONES = [
  'Primeros pasos',
  'Para el alumno',
  'Preparar una oposición',
  'Para el profesorado',
  'Dirigir un curso',
  'Administración',
  'Centros educativos',
  'Comisión CFC',
  'Zona pública',
] as const;
