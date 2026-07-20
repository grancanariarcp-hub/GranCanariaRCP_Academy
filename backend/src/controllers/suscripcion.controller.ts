import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { audit } from '../services/audit.js';
import { clientIp } from '../utils/asyncHandler.js';

/**
 * Suscripción del alumno a un curso por periodos.
 *
 * Reglas que impone la normativa española de consumidores y que aquí se
 * cumplen por diseño, no por un texto en las condiciones:
 *
 *  · Cancelar es tan fácil como contratar: un botón, sin preaviso. Surte
 *    efecto al terminar el periodo pagado, que se conserva íntegro.
 *  · 14 días de desistimiento desde la contratación.
 *  · No se devuelve la parte no consumida del periodo en curso, cosa que sí es
 *    válida siempre que se informe ANTES de contratar.
 */

const PERIODOS = {
  mensual: { meses: 1, columna: 'price_mensual_cents' },
  trimestral: { meses: 3, columna: 'price_trimestral_cents' },
  semestral: { meses: 6, columna: 'price_semestral_cents' },
  anual: { meses: 12, columna: 'price_anual_cents' },
} as const;

type Periodo = keyof typeof PERIODOS;

/** GET /api/public/courses/:id/planes — periodos ofrecidos y su precio. */
export async function planesDelCurso(req: Request, res: Response): Promise<void> {
  const { rows } = await query<{
    billing_type: string; price_mensual_cents: number | null; price_trimestral_cents: number | null;
    price_semestral_cents: number | null; price_anual_cents: number | null;
  }>(
    `SELECT billing_type, price_mensual_cents, price_trimestral_cents,
            price_semestral_cents, price_anual_cents
       FROM courses WHERE id = $1 AND status = 'publicado'`,
    [req.params.id],
  );
  const c = rows[0];
  if (!c) throw notFound('Curso no encontrado');
  if (c.billing_type !== 'suscripcion') {
    res.json({ suscripcion: false, planes: [] });
    return;
  }

  const mensual = c.price_mensual_cents ?? 0;
  const planes = (Object.keys(PERIODOS) as Periodo[])
    .map((p) => {
      const total = (c as unknown as Record<string, number | null>)[PERIODOS[p].columna] ?? 0;
      const meses = PERIODOS[p].meses;
      return {
        periodo: p,
        meses,
        totalCents: total,
        // Equivalente mensual: es como lo compara quien elige.
        porMesCents: Math.round(total / meses),
        ahorroPct: mensual > 0 ? Math.round((1 - total / meses / mensual) * 100) : 0,
      };
    })
    .filter((p) => p.totalCents > 0);

  res.json({ suscripcion: true, planes });
}

const suscribirSchema = z.object({
  periodo: z.enum(['mensual', 'trimestral', 'semestral', 'anual']),
  /**
   * Renuncia expresa a esperar los 14 días de desistimiento para empezar a
   * usar el servicio. Sin ella no se puede dar acceso inmediato.
   */
  aceptaInicioInmediato: z.literal(true, {
    errorMap: () => ({ message: 'Debes aceptar empezar a usarlo de inmediato para poder acceder ya' }),
  }),
  aceptaCondiciones: z.literal(true, {
    errorMap: () => ({ message: 'Debes aceptar las condiciones de la suscripción' }),
  }),
});

/** POST /api/student/courses/:courseId/subscribe — contratar un periodo. */
export async function suscribirse(req: Request, res: Response): Promise<void> {
  const d = suscribirSchema.parse(req.body);
  const courseId = req.params.courseId;
  const studentId = req.auth!.sub;

  const curso = await query<{ status: string; enrollment_open: boolean; billing_type: string; title: string }>(
    `SELECT status, enrollment_open, billing_type, title,
            price_mensual_cents, price_trimestral_cents, price_semestral_cents, price_anual_cents
       FROM courses WHERE id = $1`,
    [courseId],
  );
  const c = curso.rows[0] as unknown as Record<string, unknown>;
  if (!c) throw notFound('Curso no encontrado');
  if (c.status !== 'publicado' || !c.enrollment_open) throw badRequest('La matrícula no está abierta', 'ENROLL_CLOSED');
  if (c.billing_type !== 'suscripcion') throw badRequest('Este curso no se contrata por suscripción', 'NO_SUSCRIPCION');

  const total = Number(c[PERIODOS[d.periodo].columna] ?? 0);
  if (total <= 0) throw badRequest('Ese periodo no está disponible en este curso', 'PERIODO_NO_DISPONIBLE');

  const { rows } = await query<{ id: string; status: string }>(
    `INSERT INTO enrollments
       (student_id, course_id, status, price_paid_cents, periodo, auto_renew,
        withdrawal_until, immediate_start_ack)
     VALUES ($1,$2,'pendiente_pago',$3,$4,TRUE, NOW() + INTERVAL '14 days', TRUE)
     ON CONFLICT (student_id, course_id) DO UPDATE
       SET price_paid_cents = EXCLUDED.price_paid_cents,
           periodo = EXCLUDED.periodo,
           auto_renew = TRUE,
           cancelled_at = NULL,
           withdrawal_until = EXCLUDED.withdrawal_until,
           immediate_start_ack = TRUE
     RETURNING id, status`,
    [studentId, courseId, total, d.periodo],
  );

  await audit({
    actorId: studentId, actorType: 'student', action: 'SUBSCRIPTION_START',
    entity: 'enrollment', entityId: rows[0].id, ip: clientIp(req),
    // Queda constancia de qué aceptó y cuándo: es la prueba de la información previa.
    metadata: { periodo: d.periodo, totalCents: total, inicioInmediato: true, condiciones: true },
  }).catch(() => { /* no bloquear la contratación */ });

  res.status(201).json({
    enrollmentId: rows[0].id,
    periodo: d.periodo,
    totalCents: total,
    estado: rows[0].status,
    siguiente: 'Completa el pago para activar el acceso.',
  });
}

/** GET /api/student/courses/:courseId/subscription — estado de mi suscripción. */
export async function miSuscripcion(req: Request, res: Response): Promise<void> {
  const { rows } = await query<{
    status: string; periodo: string | null; price_paid_cents: number | null;
    access_until: string | null; auto_renew: boolean; cancelled_at: string | null;
    withdrawal_until: string | null; billing_type: string;
  }>(
    `SELECT e.status, e.periodo, e.price_paid_cents, e.access_until, e.auto_renew,
            e.cancelled_at, e.withdrawal_until, c.billing_type
       FROM enrollments e JOIN courses c ON c.id = e.course_id
      WHERE e.course_id = $1 AND e.student_id = $2`,
    [req.params.courseId, req.auth!.sub],
  );
  const s = rows[0];
  if (!s) { res.json({ suscrito: false }); return; }

  const ahora = new Date();
  const vence = s.access_until ? new Date(s.access_until) : null;
  const diasRestantes = vence ? Math.ceil((vence.getTime() - ahora.getTime()) / 86_400_000) : null;

  res.json({
    suscrito: true,
    esSuscripcion: s.billing_type === 'suscripcion',
    estado: s.status,
    periodo: s.periodo,
    importeCents: s.price_paid_cents ?? 0,
    accessUntil: s.access_until,
    diasRestantes,
    renovacionAutomatica: s.auto_renew && !s.cancelled_at,
    canceladaEl: s.cancelled_at,
    // Dentro de plazo aún cabe desistir; fuera, ya no.
    desistimientoHasta: s.withdrawal_until,
    puedeDesistir: !!s.withdrawal_until && new Date(s.withdrawal_until) > ahora,
  });
}

/**
 * POST /api/student/courses/:courseId/cancel-renewal
 *
 * Cancelar la renovación. Sin preaviso ni formularios: exigirlo sería una
 * cláusula abusiva. El acceso se conserva hasta que venza lo pagado.
 */
export async function cancelarRenovacion(req: Request, res: Response): Promise<void> {
  const { rows } = await query<{ access_until: string | null }>(
    `UPDATE enrollments SET auto_renew = FALSE, cancelled_at = NOW()
      WHERE course_id = $1 AND student_id = $2 AND auto_renew = TRUE
      RETURNING access_until`,
    [req.params.courseId, req.auth!.sub],
  );
  if (rows.length === 0) throw badRequest('Esta suscripción ya estaba cancelada', 'YA_CANCELADA');

  await audit({
    actorId: req.auth!.sub, actorType: 'student', action: 'SUBSCRIPTION_CANCELLED',
    entity: 'enrollment', entityId: null, ip: clientIp(req),
    metadata: { courseId: req.params.courseId, accesoHasta: rows[0].access_until },
  }).catch(() => { /* idem */ });

  res.json({
    ok: true,
    accessUntil: rows[0].access_until,
    mensaje: rows[0].access_until
      ? `Suscripción cancelada. Conservas el acceso hasta el ${new Date(rows[0].access_until).toLocaleDateString('es-ES')} y no se te volverá a cobrar.`
      : 'Suscripción cancelada. No se te volverá a cobrar.',
  });
}

/** POST /api/student/courses/:courseId/reactivate — volver a activar la renovación. */
export async function reactivarRenovacion(req: Request, res: Response): Promise<void> {
  const { rowCount } = await query(
    `UPDATE enrollments SET auto_renew = TRUE, cancelled_at = NULL
      WHERE course_id = $1 AND student_id = $2`,
    [req.params.courseId, req.auth!.sub],
  );
  if (rowCount === 0) throw notFound('No tienes una suscripción a este curso');
  res.json({ ok: true });
}
