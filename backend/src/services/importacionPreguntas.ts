import { badRequest } from '../utils/httpError.js';

/**
 * Lectura de preguntas importadas, en un único sitio.
 *
 * Había tres analizadores —uno por cada puerta de importación— y ya habían
 * divergido: el mismo fichero se leía distinto según por dónde entrara. El más
 * grave: dos separaban las opciones por «|» y «;» y el tercero por comas, de
 * modo que una opción tan corriente como «Adrenalina, 1 mg» se partía en dos y
 * la pregunta entraba mal sin dar ningún error.
 *
 * Reglas, ahora comunes:
 *  · Las opciones se separan por «|» o «;». La coma NO separa, porque aparece
 *    dentro de las opciones constantemente en contenido clínico.
 *  · La respuesta correcta se indica por letra (A, B, C…) o por número
 *    EMPEZANDO EN 1, igual en todos los formatos.
 *  · Las opciones vacías se descartan al final, reajustando el índice de la
 *    correcta, nunca antes.
 */

/** Minúsculas y sin acentos, para comparar cabeceras y valores con tolerancia. */
export function norm(s: unknown): string {
  return String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Separa las opciones CONSERVANDO las vacías y su posición: la letra que marcó
 * el autor está referida a esta lista, y quitar huecos aquí la descolocaría.
 */
export function separarOpciones(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x ?? '').trim());
  return String(v ?? '').split(/[|;]/).map((x) => x.trim());
}

/**
 * Listas de etiquetas o de públicos objetivo, donde la coma SÍ separa.
 *
 * Es lo contrario que en las opciones de una pregunta: «sanitarios, docentes»
 * son dos etiquetas, mientras que «Adrenalina, 1 mg» es una sola opción.
 */
export function separarEtiquetas(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x ?? '').trim()).filter(Boolean);
  return String(v ?? '').split(/[,;|]/).map((x) => x.trim()).filter(Boolean);
}

/** La correcta, por letra o por número empezando en 1. `n` es cuántas hay. */
export function resolverCorrecta(v: unknown, n: number): number | null {
  const s = String(v ?? '').trim().toUpperCase();
  const letra = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5 }[s as 'A'];
  if (letra !== undefined && letra < n) return letra;
  const num = parseInt(s, 10);
  if (Number.isInteger(num) && num >= 1 && num <= n) return num - 1;
  return null;
}

/**
 * Depura las opciones sin mover la respuesta correcta de sitio.
 *
 * Las opciones en blanco se descartan, y eso DESPLAZA a las que vienen detrás.
 * Antes se guardaba el índice tal cual lo había marcado el autor, que estaba
 * referido a la lista original: quien rellenaba ["Adrenalina", "", "Amiodarona",
 * "Atropina"] y marcaba la 3.ª acababa con «Atropina» como correcta, sin ningún
 * aviso, y todo el que acertaba quedaba suspenso. Aquí se recalcula el índice
 * sobre la lista ya depurada.
 */
export function opcionesDepuradas(
  brutas: string[],
  marcada: number | undefined,
): { options: string[]; correctIndex: number } {
  const vivas = brutas
    .map((o, original) => ({ texto: String(o ?? '').trim(), original }))
    .filter((o) => o.texto !== '');
  const options = vivas.map((o) => o.texto);
  if (options.length < 2) throw badRequest('Un test necesita al menos 2 opciones', 'FEW_OPTIONS');

  const correctIndex = vivas.findIndex((o) => o.original === marcada);
  if (marcada === undefined || correctIndex === -1) {
    // O no marcó ninguna, o marcó precisamente una que estaba vacía.
    throw badRequest('Marca cuál de las opciones escritas es la correcta', 'BAD_CORRECT');
  }
  return { options, correctIndex };
}
