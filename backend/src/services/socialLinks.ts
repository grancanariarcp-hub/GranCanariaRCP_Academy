import { z } from 'zod';

/**
 * Enlaces a redes sociales del profesorado.
 *
 * Redes con icono propio; «otra» lleva una etiqueta libre que pone el docente.
 * La lista es corta a propósito: es una tarjeta de presentación, no un directorio.
 */
export const REDES = ['instagram', 'linkedin', 'x', 'web', 'facebook', 'youtube', 'tiktok', 'otra'] as const;
export type Red = (typeof REDES)[number];

const enlaceSchema = z.object({
  red: z.enum(REDES),
  // Solo obligatoria —y solo se conserva— cuando la red es «otra».
  etiqueta: z.string().max(40).optional().default(''),
  url: z.string().trim().max(300),
});

/** Lista validada y saneada, lista para guardar. Máximo 8. */
export const socialLinksSchema = z
  .array(enlaceSchema)
  .max(8)
  .transform((arr) =>
    arr
      .map((e) => ({
        red: e.red,
        etiqueta: e.red === 'otra' ? (e.etiqueta || '').trim().slice(0, 40) : '',
        url: normalizarUrl(e.url),
      }))
      // Un enlace sin URL válida no se guarda: así una fila a medias no ensucia
      // la ficha pública ni deja un icono que no lleva a ninguna parte.
      .filter((e) => e.url && (e.red !== 'otra' || e.etiqueta)),
  );

/**
 * Acepta que el docente escriba «instagram.com/yo» sin el https:// y lo
 * completa. Solo http/https: nunca un javascript: o data: que acabaría siendo
 * un enlace ejecutable en la ficha pública.
 */
export function normalizarUrl(v: string): string {
  const s = (v || '').trim();
  if (!s) return '';
  const conProtocolo = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(conProtocolo);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.toString();
  } catch {
    return '';
  }
}
