/**
 * Paleta de color por tema de curso, para identificarlos de un vistazo.
 * Colores corporativos/serios pero con contraste. Primero intenta emparejar por
 * palabras clave del tema; si no, asigna una paleta estable por hash.
 */
export interface TemaPalette { main: string; grad: string; icon: string }

const KEYWORD: Array<{ re: RegExp; p: TemaPalette }> = [
  { re: /(rcp|reanimaci|parada|svb|soporte vital b)/i, p: { main: '#c41e3a', grad: 'linear-gradient(135deg,#c41e3a,#e85d75)', icon: '❤️' } },
  { re: /(sva|avanzad|soporte vital a)/i, p: { main: '#1a365d', grad: 'linear-gradient(135deg,#1a365d,#2c5282)', icon: '🫀' } },
  { re: /(svi|inmediat)/i, p: { main: '#2b6cb0', grad: 'linear-gradient(135deg,#2b6cb0,#4299e1)', icon: '🩺' } },
  { re: /(intensiv|uci|crític|critico|shock)/i, p: { main: '#6b46c1', grad: 'linear-gradient(135deg,#6b46c1,#9f7aea)', icon: '🏥' } },
  { re: /(enferm)/i, p: { main: '#0d9488', grad: 'linear-gradient(135deg,#0d9488,#2dd4bf)', icon: '💉' } },
  { re: /(pediatr|niñ|infant|neonat)/i, p: { main: '#db2777', grad: 'linear-gradient(135deg,#db2777,#f472b6)', icon: '🧒' } },
  { re: /(primeros auxilios|auxilio|pa\b)/i, p: { main: '#ea580c', grad: 'linear-gradient(135deg,#ea580c,#fb923c)', icon: '🚑' } },
  { re: /(trauma|urgenc|emergenc)/i, p: { main: '#b45309', grad: 'linear-gradient(135deg,#b45309,#f59e0b)', icon: '⚠️' } },
  { re: /(cardio|coronari|arritmi)/i, p: { main: '#be123c', grad: 'linear-gradient(135deg,#be123c,#fb7185)', icon: '💓' } },
];

const FALLBACK: TemaPalette[] = [
  { main: '#0369a1', grad: 'linear-gradient(135deg,#0369a1,#38bdf8)', icon: '📘' },
  { main: '#15803d', grad: 'linear-gradient(135deg,#15803d,#4ade80)', icon: '📗' },
  { main: '#7c3aed', grad: 'linear-gradient(135deg,#7c3aed,#a78bfa)', icon: '📙' },
  { main: '#0f766e', grad: 'linear-gradient(135deg,#0f766e,#5eead4)', icon: '📕' },
  { main: '#9d174d', grad: 'linear-gradient(135deg,#9d174d,#f472b6)', icon: '📓' },
];

export function temaPalette(tema?: string | null): TemaPalette {
  const t = (tema || '').trim();
  if (!t) return { main: '#334155', grad: 'linear-gradient(135deg,#334155,#64748b)', icon: '📚' };
  for (const k of KEYWORD) if (k.re.test(t)) return k.p;
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
}
