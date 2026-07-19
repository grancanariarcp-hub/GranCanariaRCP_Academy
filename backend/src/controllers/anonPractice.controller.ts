import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { badRequest } from '../utils/httpError.js';

/**
 * Práctica libre sin registro.
 *
 * Se permite UNA ronda a quien llega de nuevas y después aparece el muro de
 * registro. Dejar probar antes de pedir nada convierte mucho mejor que un muro
 * por delante: quien llega al resultado ya está interesado.
 *
 * Nada de esto identifica a nadie: el testigo lo genera el navegador, no se
 * guarda IP ni agente de usuario en claro, y de la procedencia solo queda el
 * país y el tipo de dispositivo, que son datos agregables.
 */

const RONDAS_GRATIS = 1;
const PREGUNTAS_POR_RONDA = 10;

/** Tipo de dispositivo a partir del agente, sin almacenar el agente. */
function dispositivoDe(ua: string): string {
  const s = ua.toLowerCase();
  if (/ipad|tablet/.test(s)) return 'tablet';
  if (/mobi|android|iphone/.test(s)) return 'movil';
  return 'escritorio';
}

/** País que aporta la CDN; nunca se deduce de la IP por nuestra cuenta. */
function paisDe(req: Request): string | null {
  const p = (req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry']) as string | undefined;
  return p && /^[A-Za-z]{2}$/.test(p) ? p.toUpperCase() : null;
}

const visitorSchema = z.string().min(8).max(64).regex(/^[a-zA-Z0-9_-]+$/, 'Testigo no válido');

/** GET /api/public/practice/status?visitor=... — ¿le queda ronda gratis? */
export async function anonStatus(req: Request, res: Response): Promise<void> {
  const visitor = visitorSchema.parse(String(req.query.visitor || ''));
  const { rows } = await query<{ n: string }>(
    'SELECT COUNT(*)::text AS n FROM anon_practice WHERE visitor = $1',
    [visitor],
  );
  const usadas = Number(rows[0].n);
  res.json({
    usadas,
    restantes: Math.max(0, RONDAS_GRATIS - usadas),
    preguntasPorRonda: PREGUNTAS_POR_RONDA,
    requiereRegistro: usadas >= RONDAS_GRATIS,
  });
}

const startSchema = z.object({
  visitor: visitorSchema,
  bankId: z.string().uuid().optional(),
  tema: z.string().max(120).optional(),
});

/** POST /api/public/practice/start — preguntas de la ronda gratuita. */
export async function anonStart(req: Request, res: Response): Promise<void> {
  const d = startSchema.parse(req.body);

  const previas = await query<{ n: string }>(
    'SELECT COUNT(*)::text AS n FROM anon_practice WHERE visitor = $1',
    [d.visitor],
  );
  if (Number(previas.rows[0].n) >= RONDAS_GRATIS) {
    throw badRequest('Ya has hecho tu test gratuito. Regístrate para seguir practicando.', 'REGISTRO_REQUERIDO');
  }

  // Solo bancos públicos: la práctica libre no puede filtrar material privado.
  const conds = ['q.is_active = TRUE', "b.visibility = 'publico'"];
  const params: unknown[] = [];
  if (d.bankId) { params.push(d.bankId); conds.push(`q.bank_id = $${params.length}`); }
  if (d.tema) { params.push(d.tema); conds.push(`q.tema = $${params.length}`); }
  params.push(PREGUNTAS_POR_RONDA);

  const { rows } = await query(
    `SELECT q.id, q.category, q.tema, q.text, q.options
       FROM questions q JOIN question_banks b ON b.id = q.bank_id
      WHERE ${conds.join(' AND ')}
      ORDER BY RANDOM() LIMIT $${params.length}`,
    params,
  );
  if (rows.length === 0) throw badRequest('No hay preguntas disponibles ahora mismo', 'NO_QUESTIONS');

  res.json({ questions: rows });
}

const submitSchema = z.object({
  visitor: visitorSchema,
  answers: z.record(z.union([z.number(), z.null()])),
  seconds: z.number().int().min(0).max(86400).optional(),
  bankId: z.string().uuid().optional(),
  tema: z.string().max(120).optional(),
  origen: z.string().max(60).optional(),
});

/** POST /api/public/practice/submit — corrige y levanta el muro. */
export async function anonSubmit(req: Request, res: Response): Promise<void> {
  const d = submitSchema.parse(req.body);
  const ids = Object.keys(d.answers);
  if (ids.length === 0) throw badRequest('No hay respuestas que corregir', 'SIN_RESPUESTAS');

  const { rows } = await query<{ id: string; correct_index: number; explanation: string | null; options: string[] }>(
    'SELECT id, correct_index, explanation, options FROM questions WHERE id = ANY($1::uuid[])',
    [ids],
  );

  let correct = 0;
  const revision = rows.map((q) => {
    const marcada = d.answers[q.id];
    const acierto = marcada !== null && marcada === q.correct_index;
    if (acierto) correct++;
    return {
      id: q.id,
      correcta: q.correct_index,
      marcada,
      acierto,
      // La explicación es lo que aporta valor y engancha a seguir.
      explicacion: q.explanation,
    };
  });

  await query(
    `INSERT INTO anon_practice (visitor, bank_id, tema, dispositivo, pais, origen, total, correct, seconds)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      d.visitor, d.bankId || null, d.tema || null,
      dispositivoDe(String(req.headers['user-agent'] || '')),
      paisDe(req), d.origen || null,
      rows.length, correct, d.seconds ?? 0,
    ],
  );

  res.json({
    total: rows.length,
    correct,
    revision,
    // A partir de aquí hay que registrarse: se dice sin rodeos.
    requiereRegistro: true,
  });
}

/** POST /api/public/practice/converted — marcar que esa sesión sí se registró. */
export async function anonConverted(req: Request, res: Response): Promise<void> {
  const visitor = visitorSchema.parse(String(req.body?.visitor || ''));
  await query('UPDATE anon_practice SET converted = TRUE WHERE visitor = $1', [visitor]);
  res.json({ ok: true });
}

/** GET /api/admin/anon-practice — cuánta gente participa y con qué perfil. */
export async function anonStats(_req: Request, res: Response): Promise<void> {
  const totales = await query<{
    sesiones: string; personas: string; convertidas: string; media_aciertos: string | null; media_minutos: string | null;
  }>(
    `SELECT COUNT(*)::text AS sesiones,
            COUNT(DISTINCT visitor)::text AS personas,
            COUNT(*) FILTER (WHERE converted)::text AS convertidas,
            ROUND(AVG(correct::numeric / NULLIF(total, 0) * 100), 1)::text AS media_aciertos,
            ROUND(AVG(seconds) / 60.0, 1)::text AS media_minutos
       FROM anon_practice`,
  );

  const periodos = await query(
    `SELECT COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE))::int AS mes_actual,
            COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
                               AND created_at <  date_trunc('month', CURRENT_DATE))::int AS mes_anterior,
            COUNT(*) FILTER (WHERE created_at >= date_trunc('year', CURRENT_DATE))::int AS anio
       FROM anon_practice`,
  );

  const porDispositivo = await query(
    `SELECT COALESCE(dispositivo, 'desconocido') AS clave, COUNT(*)::int AS n
       FROM anon_practice GROUP BY 1 ORDER BY n DESC`,
  );
  const porPais = await query(
    `SELECT COALESCE(pais, '—') AS clave, COUNT(*)::int AS n
       FROM anon_practice GROUP BY 1 ORDER BY n DESC LIMIT 10`,
  );
  const porTema = await query(
    `SELECT COALESCE(tema, 'sin tema') AS clave, COUNT(*)::int AS n,
            ROUND(AVG(correct::numeric / NULLIF(total, 0) * 100), 1)::text AS aciertos
       FROM anon_practice GROUP BY 1 ORDER BY n DESC LIMIT 10`,
  );
  const diario = await query(
    `SELECT to_char(created_at::date, 'YYYY-MM-DD') AS dia, COUNT(*)::int AS n
       FROM anon_practice WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY 1 ORDER BY 1`,
  );

  const t = totales.rows[0];
  const sesiones = Number(t.sesiones);
  res.json({
    totales: {
      sesiones,
      personas: Number(t.personas),
      convertidas: Number(t.convertidas),
      conversionPct: sesiones > 0 ? Math.round((Number(t.convertidas) / sesiones) * 100) : 0,
      mediaAciertosPct: t.media_aciertos ? Number(t.media_aciertos) : null,
      mediaMinutos: t.media_minutos ? Number(t.media_minutos) : null,
    },
    periodos: periodos.rows[0],
    porDispositivo: porDispositivo.rows,
    porPais: porPais.rows,
    porTema: porTema.rows,
    diario: diario.rows,
  });
}
