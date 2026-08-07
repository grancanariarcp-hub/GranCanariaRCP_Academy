import type { Request, Response } from 'express';
import { query } from '../config/database.js';
import { notify } from '../services/notify.js';

/**
 * Recordatorios automáticos de fecha límite.
 *
 * Pensado para dispararse una vez al día desde un cron externo (cron-job.org),
 * el mismo que mantiene la API despierta. Avisa al alumnado matriculado y aún no
 * apto de que el examen final se acerca, a varios días vista.
 *
 * Idempotente: cada aviso se registra en course_reminders con ON CONFLICT DO
 * NOTHING, así que ejecutar el cron dos veces el mismo día no duplica avisos.
 *
 * Protegido por CRON_SECRET (cabecera x-cron-key o ?key=): no está tras login,
 * pero sin el secreto no hace nada. Si el secreto no está configurado, el
 * endpoint queda deshabilitado (503) en vez de abierto.
 */

// Días antes del cierre del examen en los que se recuerda, con su etiqueta.
const AVISOS: Array<{ dias: number; kind: string }> = [
  { dias: 3, kind: 'examen_3d' },
  { dias: 1, kind: 'examen_1d' },
];

export async function enviarRecordatorios(req: Request, res: Response): Promise<void> {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) { res.status(503).json({ error: 'Recordatorios no configurados (falta CRON_SECRET)' }); return; }
  const dado = req.header('x-cron-key') || String(req.query.key || '');
  if (dado !== secreto) { res.status(401).json({ error: 'Clave no válida' }); return; }

  let enviados = 0;
  for (const aviso of AVISOS) {
    // Alumnos activos de cursos publicados cuyo examen cierra dentro de `dias`,
    // que aún no han aprobado y a los que aún no se ha enviado ESTE aviso.
    const pendientes = await query<{ student_id: string; course_id: string; title: string; fin: string }>(
      `SELECT e.student_id, c.id AS course_id, c.title, c.final_exam_end AS fin
         FROM courses c
         JOIN enrollments e ON e.course_id = c.id AND e.status IN ('activo','completado')
        WHERE c.status = 'publicado'
          AND c.final_exam_end = (CURRENT_DATE + $1::int)
          AND NOT EXISTS (
            SELECT 1 FROM exam_attempts a
              JOIN exams x ON x.id = a.exam_id
              JOIN modules m ON m.id = x.module_id
             WHERE m.course_id = c.id AND a.student_id = e.student_id AND a.passed = TRUE)
          AND NOT EXISTS (
            SELECT 1 FROM course_reminders r
             WHERE r.student_id = e.student_id AND r.course_id = c.id AND r.kind = $2)`,
      [aviso.dias, aviso.kind],
    );

    for (const p of pendientes.rows) {
      // El registro es la garantía anti-duplicado: si otro proceso se adelantó,
      // el INSERT no crea fila y no se envía el aviso.
      const ins = await query(
        `INSERT INTO course_reminders (student_id, course_id, kind) VALUES ($1,$2,$3)
         ON CONFLICT DO NOTHING RETURNING student_id`,
        [p.student_id, p.course_id, aviso.kind],
      );
      if (ins.rowCount === 0) continue;
      const cuando = aviso.dias === 1 ? 'mañana' : `en ${aviso.dias} días`;
      await notify(
        { id: p.student_id, type: 'student' },
        `El examen de «${p.title}» cierra ${cuando}`,
        `Tienes hasta el ${p.fin} para presentarte al examen final. No lo dejes para el último día.`,
        `/student/curso/${p.course_id}`,
        { email: true },
      ).catch(() => { /* un aviso fallido no debe cortar el resto */ });
      enviados++;
    }
  }

  res.json({ ok: true, enviados });
}
