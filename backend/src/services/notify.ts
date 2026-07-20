import { query } from '../config/database.js';
import { emailConfigured, sendEmail, emailTemplate, frontendBase } from './email.js';

export type UserType = 'user' | 'student';
export interface Recipient { id: string; type: UserType }
export interface NotifyOpts { email?: boolean }

/** Busca el email del destinatario (staff en users, alumno en students). */
async function recipientEmail(to: Recipient): Promise<string | null> {
  const table = to.type === 'student' ? 'students' : 'users';
  const { rows } = await query<{ email: string | null }>(`SELECT email FROM ${table} WHERE id = $1`, [to.id]);
  return rows[0]?.email ?? null;
}

/**
 * Notificaciones. Siempre in-app; además por email si opts.email y Resend está
 * configurado. El email nunca bloquea ni rompe el flujo del llamador.
 */
export async function notify(
  to: Recipient,
  title: string,
  body?: string | null,
  link?: string | null,
  opts?: NotifyOpts,
): Promise<void> {
  await query(
    'INSERT INTO notifications (user_id, user_type, title, body, link) VALUES ($1,$2,$3,$4,$5)',
    [to.id, to.type, title, body ?? null, link ?? null],
  );

  if (opts?.email && emailConfigured()) {
    try {
      const email = await recipientEmail(to);
      if (email) {
        const url = link ? `${frontendBase()}${link}` : null;
        await sendEmail(email, title, emailTemplate(title, body ?? null, url));
      }
    } catch { /* el email nunca debe romper la notificación in-app */ }
  }
}

/**
 * Avisa de una vez a todo el profesorado de un curso.
 *
 * Era un bucle repetido en tres sitios que hacía una consulta por profesor.
 * Dos de esas copias están dentro del webhook de Stripe, que tiene un plazo de
 * respuesta: cuanto menos trabajo haya entre el cobro y el 200, menos
 * posibilidades de que Stripe lo dé por fallido y reintente el cobro entero.
 * Aquí es una sola sentencia, sin bucle y sin viaje por destinatario.
 */
export async function notifyCourseStaff(
  courseId: string,
  title: string,
  body: string | null,
  link: string | null,
): Promise<void> {
  await query(
    `INSERT INTO notifications (user_id, user_type, title, body, link)
     SELECT cs.user_id, 'user', $2, $3, $4 FROM course_staff cs WHERE cs.course_id = $1`,
    [courseId, title, body, link],
  );
}

/** Notifica a varios destinatarios. `link` puede depender del tipo de destinatario. */
export async function notifyMany(
  recipients: Recipient[],
  title: string,
  body: string | null,
  link: (to: Recipient) => string | null,
  opts?: NotifyOpts,
): Promise<void> {
  for (const to of recipients) {
    await notify(to, title, body, link(to), opts);
  }
}
