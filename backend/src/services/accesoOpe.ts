import { query } from '../config/database.js';

/**
 * Qué bancos de oposición puede usar una persona.
 *
 * El contenido OPE se vende por suscripción, así que NO basta con que el banco
 * sea público: hay que estar suscrito a la convocatoria que lo incluye. Sin
 * este filtro, cualquiera con una cuenta gratuita podía generar tests de todo
 * el catálogo y el producto era gratis de hecho.
 *
 * Da acceso:
 *  · una convocatoria ABIERTA (sin curso asociado), que son las de captación;
 *  · una convocatoria cuyo curso tenga matrícula pagada y no vencida;
 *  · los bancos creados por la propia persona, para el profesorado.
 */
export async function bancosOpeAccesibles(
  userId: string,
  rol: string,
): Promise<{ todos: boolean; ids: string[] }> {
  // Quien administra o audita revisa el catálogo entero.
  if (rol === 'super_admin' || rol === 'auditor') return { todos: true, ids: [] };

  const { rows } = await query<{ bank_id: string }>(
    `SELECT DISTINCT cb.bank_id
       FROM ope_convocatoria_banks cb
       JOIN ope_convocatorias c ON c.id = cb.convocatoria_id AND c.is_active
      WHERE c.course_id IS NULL
         OR EXISTS (
              SELECT 1 FROM enrollments e
               WHERE e.course_id = c.course_id
                 AND e.student_id = $1
                 AND e.status <> 'pendiente_pago'
                 AND (e.access_until IS NULL OR e.access_until > NOW())
            )
     UNION
     SELECT id AS bank_id FROM question_banks WHERE created_by = $1`,
    [userId],
  );
  return { todos: false, ids: rows.map((r) => r.bank_id) };
}

/** Fragmento SQL y parámetro para acotar una consulta a esos bancos. */
export function filtroBancos(
  acceso: { todos: boolean; ids: string[] },
  columna: string,
  params: unknown[],
): string {
  if (acceso.todos) return 'TRUE';
  if (acceso.ids.length === 0) return 'FALSE';
  params.push(acceso.ids);
  return `${columna} = ANY($${params.length}::uuid[])`;
}
