import { query } from '../config/database.js';

export type UserType = 'user' | 'student';
export interface Recipient { id: string; type: UserType }

/**
 * Notificaciones in-app. Es la capa base; más adelante aquí mismo se puede
 * enganchar el envío por email (Resend) o push sin tocar los llamadores.
 */
export async function notify(
  to: Recipient,
  title: string,
  body?: string | null,
  link?: string | null,
): Promise<void> {
  await query(
    'INSERT INTO notifications (user_id, user_type, title, body, link) VALUES ($1,$2,$3,$4,$5)',
    [to.id, to.type, title, body ?? null, link ?? null],
  );
}

/** Notifica a varios destinatarios. `link` puede depender del tipo de destinatario. */
export async function notifyMany(
  recipients: Recipient[],
  title: string,
  body: string | null,
  link: (to: Recipient) => string | null,
): Promise<void> {
  for (const to of recipients) {
    await notify(to, title, body, link(to));
  }
}
