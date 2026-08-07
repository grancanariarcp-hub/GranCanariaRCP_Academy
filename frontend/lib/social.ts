/**
 * Catálogo de redes sociales del profesorado.
 *
 * El orden importa: las tres primeras (Instagram, LinkedIn, X) y el sitio web
 * son las opciones destacadas del desplegable; el resto van después, y «otra»
 * siempre al final para nombrar a mano cualquiera que no esté en la lista.
 *
 * Los iconos son SVG inline (sin dependencias ni peticiones externas) y heredan
 * el color del texto, para verse bien sobre cualquier fondo.
 */
export interface EnlaceSocial {
  red: string;
  etiqueta?: string;
  url: string;
}

export interface RedInfo {
  id: string;
  nombre: string;
  /** SVG de 24×24 que usa fill="currentColor". */
  icono: string;
}

const IG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.3-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.3-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2m0 1.9c-3.1 0-3.5 0-4.7.1-1.1.1-1.7.2-2.1.4-.5.2-.9.4-1.2.8-.4.3-.6.7-.8 1.2-.2.4-.3 1-.4 2.1C2.7 8.5 2.7 8.9 2.7 12s0 3.5.1 4.7c.1 1.1.2 1.7.4 2.1.2.5.4.9.8 1.2.3.4.7.6 1.2.8.4.2 1 .3 2.1.4 1.2.1 1.6.1 4.7.1s3.5 0 4.7-.1c1.1-.1 1.7-.2 2.1-.4.5-.2.9-.4 1.2-.8.4-.3.6-.7.8-1.2.2-.4.3-1 .4-2.1.1-1.2.1-1.6.1-4.7s0-3.5-.1-4.7c-.1-1.1-.2-1.7-.4-2.1-.2-.5-.4-.9-.8-1.2-.3-.4-.7-.6-1.2-.8-.4-.2-1-.3-2.1-.4-1.2-.1-1.6-.1-4.7-.1m0 3.3a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2m0 7.6a3 3 0 1 1 0-6 3 3 0 0 1 0 6m5.8-7.8a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0"/></svg>';
const LI = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20.4 20.4h-3.6v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9v5.7H9.3V9h3.4v1.6h.1c.5-.9 1.6-1.9 3.4-1.9 3.6 0 4.3 2.4 4.3 5.5v6.2M5.3 7.4a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2m1.8 13H3.5V9h3.6v11.4M22.2 0H1.8C.8 0 0 .8 0 1.7v20.6c0 .9.8 1.7 1.8 1.7h20.4c1 0 1.8-.8 1.8-1.7V1.7c0-.9-.8-1.7-1.8-1.7"/></svg>';
const X = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M18.9 1.2h3.7l-8 9.1L24 22.8h-7.4l-5.8-7.6-6.6 7.6H.5l8.6-9.8L0 1.2h7.6l5.2 6.9 6.1-6.9m-1.3 19.4h2L6.5 3.3H4.3z"/></svg>';
const WEB = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c2.5 2.5 3.8 5.9 3.8 9.5s-1.3 7-3.8 9.5c-2.5-2.5-3.8-5.9-3.8-9.5S9.5 5 12 2.5"/></svg>';
const FB = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.6 4.5-4.6 1.3 0 2.6.2 2.6.2v2.9h-1.5c-1.4 0-1.9.9-1.9 1.8V12h3.3l-.5 3.5h-2.8v8.4A12 12 0 0 0 24 12"/></svg>';
const YT = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M23.5 6.5a3 3 0 0 0-2.1-2.1C19.5 3.9 12 3.9 12 3.9s-7.5 0-9.4.5A3 3 0 0 0 .5 6.5C0 8.4 0 12 0 12s0 3.6.5 5.5a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.5.5-5.5s0-3.6-.5-5.5M9.5 15.6V8.4l6.3 3.6-6.3 3.6"/></svg>';
const TT = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M16.6 0h-3.3v13.4a2.7 2.7 0 1 1-2.7-2.7c.3 0 .5 0 .8.1V7.5a6 6 0 0 0-.8-.1 6 6 0 1 0 6 6V7.7a7.3 7.3 0 0 0 4.3 1.4V5.8a4.3 4.3 0 0 1-4.3-4.3z"/></svg>';
const OTRA = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9.5 14.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1M14.5 9.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1"/></svg>';

/** Redes en el orden del desplegable: destacadas, web, resto, y «otra» al final. */
export const REDES: RedInfo[] = [
  { id: 'instagram', nombre: 'Instagram', icono: IG },
  { id: 'linkedin', nombre: 'LinkedIn', icono: LI },
  { id: 'x', nombre: 'X', icono: X },
  { id: 'web', nombre: 'Sitio web', icono: WEB },
  { id: 'facebook', nombre: 'Facebook', icono: FB },
  { id: 'youtube', nombre: 'YouTube', icono: YT },
  { id: 'tiktok', nombre: 'TikTok', icono: TT },
  { id: 'otra', nombre: 'Otra…', icono: OTRA },
];

const PORID = new Map(REDES.map((r) => [r.id, r]));

export function redInfo(id: string): RedInfo {
  return PORID.get(id) ?? REDES[REDES.length - 1]; // «otra» como respaldo
}

/** Nombre a mostrar: la etiqueta libre si es «otra», si no el nombre de la red. */
export function nombreEnlace(e: EnlaceSocial): string {
  return e.red === 'otra' ? (e.etiqueta || 'Enlace') : redInfo(e.red).nombre;
}
