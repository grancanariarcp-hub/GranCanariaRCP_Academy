import { pool, query, withTransaction } from '../config/database.js';

/**
 * Retirada de los cobros de prueba.
 *
 * Antes de cobrar de verdad hay que dejar la contabilidad limpia. Un pago hecho
 * en modo de prueba tiene `livemode = false` y no ha movido un solo euro, pero
 * en la base de datos es indistinguible de uno real: activa la matrícula y,
 * sobre todo, CONSUME UN NÚMERO DE JUSTIFICANTE. Si las pruebas se llevaron del
 * RCP-2026-000001 al 000004, el primer cobro real saldría con el 000005 y la
 * numeración correlativa empezaría con cuatro huecos que no se pueden explicar.
 *
 * Por defecto NO borra nada: enseña lo que haría. Para ejecutarlo de verdad hay
 * que pedirlo explícitamente con --aplicar.
 *
 *   npm run db:limpiar-pruebas              -> informe, sin tocar nada
 *   npm run db:limpiar-pruebas -- --aplicar -> lo ejecuta
 */

const APLICAR = process.argv.includes('--aplicar');

/**
 * Correos cuya matrícula se respeta.
 *
 * Entre los cobros de prueba puede haber personas de verdad a las que se dio de
 * alta durante las pruebas, o que pagaron por otra vía (transferencia, en
 * mano). Su cobro en Stripe es igualmente ficticio y hay que retirarlo, pero
 * quitarles el acceso al curso sería un daño real causado por una limpieza
 * contable.
 *
 *   npm run db:limpiar-pruebas -- --aplicar --conservar alguien@correo.es
 */
const CONSERVAR = (() => {
  const i = process.argv.indexOf('--conservar');
  return i > -1 && process.argv[i + 1]
    ? process.argv[i + 1].split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
    : [];
})();

const euros = (c: number) => (c / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

async function main(): Promise<void> {
  const pruebas = await query<{
    id: string; amount_cents: number; status: string; receipt_number: string | null;
    paid_at: string | null; alumno: string; email: string | null; curso: string;
    enrollment_id: string; enrollment_status: string;
  }>(
    `SELECT p.id, p.amount_cents, p.status, p.receipt_number, p.paid_at,
            s.display_name AS alumno, s.email, c.title AS curso,
            e.id AS enrollment_id, e.status AS enrollment_status
       FROM payments p
       JOIN students s    ON s.id = p.student_id
       JOIN courses c     ON c.id = p.course_id
       JOIN enrollments e ON e.id = p.enrollment_id
      WHERE p.livemode = FALSE
      ORDER BY p.created_at`,
  );

  const reales = await query<{ n: string; total: string }>(
    `SELECT COUNT(*)::text AS n, COALESCE(SUM(amount_cents), 0)::text AS total
       FROM payments WHERE livemode = TRUE AND status = 'pagado'`,
  );

  console.log(`\nCobros REALES ya registrados: ${reales.rows[0].n} (${euros(Number(reales.rows[0].total))})`);
  console.log(`Cobros de PRUEBA encontrados: ${pruebas.rows.length}\n`);

  if (pruebas.rows.length === 0) {
    console.log('No hay nada que limpiar.');
    return;
  }

  for (const p of pruebas.rows) {
    const respetado = CONSERVAR.includes((p.email ?? '').toLowerCase());
    console.log(`  ${p.receipt_number ?? '(sin justificante)'}  ${euros(p.amount_cents).padStart(10)}  ${p.status.padEnd(11)}` +
      `  ${p.alumno} <${p.email ?? 'sin correo'}>`);
    console.log(`      curso: ${p.curso}  ·  ` + (respetado
      ? `CONSERVA su acceso (matrícula intacta: ${p.enrollment_status})`
      : `matrícula quedará como "pendiente_pago" (ahora: ${p.enrollment_status})`));
  }
  if (CONSERVAR.length > 0) {
    const sinCoincidir = CONSERVAR.filter((e) => !pruebas.rows.some((p) => (p.email ?? '').toLowerCase() === e));
    if (sinCoincidir.length > 0) {
      console.log(`\n  AVISO: estos correos de --conservar no aparecen entre los cobros de prueba: ${sinCoincidir.join(', ')}`);
      console.log('  Revisa que estén bien escritos: un correo mal tecleado no protege a nadie.');
    }
  }

  // Los justificantes se numeran por año natural: hay que devolver cada
  // contador al último número REAL de ese año, no simplemente a cero, para no
  // reutilizar un número ya emitido a un cliente de verdad.
  const contadores = await query<{ year: number; last_no: number; real_max: number }>(
    `SELECT rc.year, rc.last_no,
            COALESCE((
              SELECT MAX(SUBSTRING(p.receipt_number FROM '[0-9]+$')::int)
                FROM payments p
               WHERE p.livemode = TRUE AND p.receipt_number LIKE 'RCP-' || rc.year || '-%'
            ), 0) AS real_max
       FROM receipt_counters rc
      ORDER BY rc.year`,
  );

  console.log('\nNumeración de justificantes:');
  for (const c of contadores.rows) {
    const siguiente = String(c.real_max + 1).padStart(6, '0');
    console.log(`  ${c.year}: va por ${c.last_no} -> se devuelve a ${c.real_max}` +
      ` (el próximo cobro real será RCP-${c.year}-${siguiente})`);
  }

  if (!APLICAR) {
    console.log('\n--- INFORME, NO SE HA TOCADO NADA ---');
    console.log('Para ejecutarlo:  npm run db:limpiar-pruebas -- --aplicar\n');
    return;
  }

  await withTransaction(async (c) => {
    // La matrícula vuelve a "pendiente de pago": nadie pagó por ella. No se
    // borra, porque si detrás hay una persona real conserva su sitio y solo
    // tiene que abonarla.
    const m = await c.query(
      `UPDATE enrollments SET status = 'pendiente_pago', access_until = NULL
        WHERE id IN (
          SELECT p.enrollment_id FROM payments p
            JOIN students s ON s.id = p.student_id
           WHERE p.livemode = FALSE AND LOWER(COALESCE(s.email, '')) <> ALL($1::text[])
        )`,
      [CONSERVAR],
    );
    const p = await c.query('DELETE FROM payments WHERE livemode = FALSE');
    await c.query(
      `UPDATE receipt_counters rc
          SET last_no = COALESCE((
            SELECT MAX(SUBSTRING(pa.receipt_number FROM '[0-9]+$')::int)
              FROM payments pa
             WHERE pa.livemode = TRUE AND pa.receipt_number LIKE 'RCP-' || rc.year || '-%'
          ), 0)`,
    );
    console.log(`\nHecho: ${p.rowCount} cobros de prueba retirados, ${m.rowCount} matrículas devueltas a pendiente de pago.`);
    console.log('La numeración de justificantes queda continua para los cobros reales.\n');
  });
}

main()
  .catch((e) => {
    console.error('La limpieza ha fallado:', e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
