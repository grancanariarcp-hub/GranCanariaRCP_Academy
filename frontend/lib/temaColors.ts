/**
 * Paleta de color por tema de curso, para identificarlos de un vistazo.
 * Guía corporativa (sin iconos, solo color):
 *   SVA rojo · SVI naranja · SVB amarillo · Medicina intensiva azul ·
 *   Enfermería verde oscuro · Emergencias negro.
 * Para temas no listados, asigna una paleta estable por hash.
 */
export interface TemaPalette { main: string; grad: string; text: string }

const KEYWORD: Array<{ re: RegExp; p: TemaPalette }> = [
  { re: /\bsva\b|avanzad/i,             p: { main: '#dc2626', grad: 'linear-gradient(135deg,#b91c1c,#ef4444)', text: '#fff' } }, // rojo
  { re: /\bsvi\b|inmediat/i,            p: { main: '#ea580c', grad: 'linear-gradient(135deg,#c2410c,#fb923c)', text: '#fff' } }, // naranja
  { re: /\bsvb\b|b[aá]sic/i,            p: { main: '#eab308', grad: 'linear-gradient(135deg,#ca8a04,#fde047)', text: '#1a202c' } }, // amarillo
  { re: /intensiv|uci|cr[ií]tic/i,     p: { main: '#2563eb', grad: 'linear-gradient(135deg,#1d4ed8,#60a5fa)', text: '#fff' } }, // azul
  { re: /enferm/i,                     p: { main: '#166534', grad: 'linear-gradient(135deg,#14532d,#22c55e)', text: '#fff' } }, // verde oscuro
  { re: /emergenc|urgenc/i,            p: { main: '#111827', grad: 'linear-gradient(135deg,#000000,#374151)', text: '#fff' } }, // negro
];

const FALLBACK: TemaPalette[] = [
  { main: '#0369a1', grad: 'linear-gradient(135deg,#0369a1,#38bdf8)', text: '#fff' },
  { main: '#7c3aed', grad: 'linear-gradient(135deg,#6d28d9,#a78bfa)', text: '#fff' },
  { main: '#0f766e', grad: 'linear-gradient(135deg,#0f766e,#5eead4)', text: '#fff' },
  { main: '#9d174d', grad: 'linear-gradient(135deg,#9d174d,#f472b6)', text: '#fff' },
  { main: '#475569', grad: 'linear-gradient(135deg,#334155,#64748b)', text: '#fff' },
];

export function temaPalette(tema?: string | null): TemaPalette {
  const t = (tema || '').trim();
  if (!t) return { main: '#475569', grad: 'linear-gradient(135deg,#334155,#64748b)', text: '#fff' };
  for (const k of KEYWORD) if (k.re.test(t)) return k.p;
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
}
