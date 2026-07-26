import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';

/**
 * Venta cruzada con PÚLSAR (simulación clínica presencial).
 *
 * Una tarjeta de «partner» configurable que promociona PÚLSAR dentro de la
 * academia, simétrica a la que PÚLSAR muestra de nosotros. Es SOLO una capa de
 * marketing: no toca cursos, actas ni matrículas.
 *
 * Se guarda como un único JSON en platform_settings (clave/valor ya existente),
 * así que no necesita tabla propia. Trae valores por defecto con el mensaje
 * acordado, de modo que funciona desde el primer día aunque nadie lo edite.
 */

const CLAVE = 'partner_banner';
const REF = 'academia';

interface Banner {
  activo: boolean;
  titulo: string;
  texto: string;
  imagenUrl: string;
  enlace: string;
  textoBoton: string;
}

const POR_DEFECTO: Banner = {
  activo: true,
  titulo: 'La fase práctica presencial se realiza con PÚLSAR',
  texto:
    'Simulación clínica avanzada, 100 % web y sin hardware: monitor de paciente, desfibrilador '
    + 'y evaluación por competencias. Aquí la teoría acreditada; la práctica, con PÚLSAR. '
    + 'Juntos, el curso de soporte vital completo.',
  imagenUrl: '',
  enlace: 'https://pulsar.astormanager.com/presupuesto/',
  textoBoton: 'Pedir presupuesto',
};

/** Añade ?ref=academia al enlace de salida para poder medir el origen del lead. */
function conRef(url: string): string {
  const limpio = (url || POR_DEFECTO.enlace).trim();
  if (!/^https?:\/\//i.test(limpio)) return POR_DEFECTO.enlace + `?ref=${REF}`;
  if (/[?&]ref=/.test(limpio)) return limpio;
  return limpio + (limpio.includes('?') ? '&' : '?') + `ref=${REF}`;
}

async function leer(): Promise<Banner> {
  const { rows } = await query<{ value: string | null }>(
    'SELECT value FROM platform_settings WHERE key = $1', [CLAVE],
  );
  if (!rows[0]?.value) return POR_DEFECTO;
  try {
    return { ...POR_DEFECTO, ...(JSON.parse(rows[0].value) as Partial<Banner>) };
  } catch {
    return POR_DEFECTO;
  }
}

/** GET /api/public/partner-banner — la tarjeta que se muestra, si está activa. */
export async function getPartnerBanner(_req: Request, res: Response): Promise<void> {
  const b = await leer();
  if (!b.activo) { res.json({ banner: null }); return; }
  res.json({ banner: { ...b, enlace: conRef(b.enlace) } });
}

/** GET /api/admin/partner-banner — la configuración completa, para editarla. */
export async function getPartnerBannerAdmin(_req: Request, res: Response): Promise<void> {
  res.json({ banner: await leer() });
}

const guardarSchema = z.object({
  activo: z.boolean(),
  titulo: z.string().max(120),
  texto: z.string().max(400),
  imagenUrl: z.string().url('Enlace de imagen no válido').or(z.literal('')),
  enlace: z.string().url('Enlace no válido'),
  textoBoton: z.string().max(40),
});

/** POST /api/admin/partner-banner — guardar la configuración (super_admin). */
export async function setPartnerBanner(req: Request, res: Response): Promise<void> {
  const d = guardarSchema.parse(req.body);
  await query(
    `INSERT INTO platform_settings (key, value, updated_at) VALUES ($1,$2,NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [CLAVE, JSON.stringify(d)],
  );
  res.json({ ok: true, banner: d });
}

/**
 * POST /api/public/referido — registra una llegada con ?ref=... (p.ej. pulsar).
 *
 * Simétrico a lo que PÚLSAR hace con nuestro ?ref=academia. No guarda nada
 * personal: solo la fuente y la página. Silencioso ante entradas basura.
 */
export async function recordReferral(req: Request, res: Response): Promise<void> {
  const d = z.object({
    ref: z.string().min(1).max(40),
    path: z.string().max(200).optional(),
  }).safeParse(req.body);
  if (!d.success) { res.json({ ok: true }); return; }
  await query('INSERT INTO referral_hits (ref, path) VALUES ($1,$2)', [d.data.ref, d.data.path ?? null]);
  res.json({ ok: true });
}

/** GET /api/admin/referidos — resumen de llegadas por fuente (super_admin). */
export async function listReferrals(_req: Request, res: Response): Promise<void> {
  const { rows } = await query<{ ref: string; total: string; mes: string }>(
    `SELECT ref, COUNT(*) AS total,
            COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE)) AS mes
       FROM referral_hits GROUP BY ref ORDER BY COUNT(*) DESC`,
  );
  res.json({ fuentes: rows.map((r) => ({ ref: r.ref, total: Number(r.total), esteMes: Number(r.mes) })) });
}
