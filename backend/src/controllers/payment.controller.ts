import type { Request, Response } from 'express';
import type Stripe from 'stripe';
import { query, withTransaction } from '../config/database.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { stripe, stripeConfigurado, stripeEnProduccion, NOTA_EXENCION } from '../services/stripe.js';
import { precioDe, euros } from '../services/pricing.js';
import { notify } from '../services/notify.js';
import { audit } from '../services/audit.js';
import { clientIp } from '../utils/asyncHandler.js';

/**
 * Cobro de matrículas.
 *
 * El importe NO se recibe del navegador: se recalcula siempre en el servidor a
 * partir del precio congelado en la matrícula. De lo contrario cualquiera
 * podría pagar un curso al precio que quisiera.
 *
 * La matrícula se activa únicamente desde el webhook de Stripe, no al volver el
 * alumno a la página de éxito: esa vuelta puede falsificarse o no ocurrir
 * nunca si cierra el navegador tras pagar.
 */

function frontendBase(): string {
  return (process.env.FRONTEND_URL || (process.env.CORS_ORIGIN || '').split(',')[0] || '').replace(/\/$/, '');
}

/**
 * POST /api/student/courses/:courseId/checkout
 * Devuelve la URL de pago de Stripe para la matrícula pendiente.
 */
export async function createCheckoutSession(req: Request, res: Response): Promise<void> {
  if (!stripeConfigurado()) throw badRequest('El cobro con tarjeta aún no está activo', 'STRIPE_NOT_CONFIGURED');

  const courseId = req.params.courseId;
  const studentId = req.auth!.sub;

  const { rows } = await query<{
    enrollment_id: string; enrollment_status: string; price_paid_cents: number | null;
    title: string; price_cents: number; early_bird_until: string | null; late_surcharge_pct: number | null;
  }>(
    `SELECT e.id AS enrollment_id, e.status AS enrollment_status, e.price_paid_cents,
            c.title, c.price_cents, c.early_bird_until, c.late_surcharge_pct
       FROM enrollments e JOIN courses c ON c.id = e.course_id
      WHERE e.course_id = $1 AND e.student_id = $2`,
    [courseId, studentId],
  );
  const m = rows[0];
  if (!m) throw badRequest('Primero debes matricularte en el curso', 'NOT_ENROLLED');
  if (m.enrollment_status === 'activo') throw badRequest('Esta matrícula ya está pagada', 'ALREADY_PAID');

  // Importe congelado en la matrícula; si faltara, se recalcula.
  const cents = m.price_paid_cents ?? precioDe({
    priceCents: m.price_cents, earlyBirdUntil: m.early_bird_until, lateSurchargePct: m.late_surcharge_pct,
  }).cents;
  if (cents <= 0) throw badRequest('Este curso es gratuito', 'FREE_COURSE');

  // Si ya hay una sesión de pago viva, se reutiliza en vez de crear otra.
  const abierta = await query<{ id: string; stripe_session_id: string }>(
    `SELECT id, stripe_session_id FROM payments
      WHERE enrollment_id = $1 AND status = 'pendiente' AND stripe_session_id IS NOT NULL
      ORDER BY created_at DESC LIMIT 1`,
    [m.enrollment_id],
  );
  if (abierta.rows[0]) {
    try {
      const previa = await stripe().checkout.sessions.retrieve(abierta.rows[0].stripe_session_id);
      if (previa.status === 'open' && previa.url) {
        res.json({ url: previa.url, reutilizada: true });
        return;
      }
    } catch {
      /* sesión inservible: se crea una nueva */
    }
  }

  const alumno = await query<{ email: string | null; display_name: string }>(
    'SELECT email, display_name FROM students WHERE id = $1',
    [studentId],
  );

  const sesion = await stripe().checkout.sessions.create({
    mode: 'payment',
    // La enseñanza está exenta: se cobra el importe tal cual, sin impuesto.
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: cents,
        product_data: { name: `Matrícula · ${m.title}`, description: NOTA_EXENCION },
      },
    }],
    customer_email: alumno.rows[0]?.email || undefined,
    success_url: `${frontendBase()}/student/curso/${courseId}?pago=ok`,
    cancel_url: `${frontendBase()}/student/curso/${courseId}?pago=cancelado`,
    // Sirven para casar el webhook con la matrícula sin fiarse del navegador.
    metadata: { enrollmentId: m.enrollment_id, courseId, studentId },
  });

  await query(
    `INSERT INTO payments (enrollment_id, student_id, course_id, amount_cents, status, stripe_session_id, livemode, tax_note)
     VALUES ($1,$2,$3,$4,'pendiente',$5,$6,$7)
     ON CONFLICT (stripe_session_id) DO NOTHING`,
    [m.enrollment_id, studentId, courseId, cents, sesion.id, stripeEnProduccion(), NOTA_EXENCION],
  );

  res.json({ url: sesion.url });
}

/** Número correlativo del justificante: RCP-AAAA-000123. */
async function siguienteNumeroJustificante(anio: number): Promise<string> {
  const { rows } = await query<{ last_no: number }>(
    `INSERT INTO receipt_counters (year, last_no) VALUES ($1, 1)
     ON CONFLICT (year) DO UPDATE SET last_no = receipt_counters.last_no + 1
     RETURNING last_no`,
    [anio],
  );
  return `RCP-${anio}-${String(rows[0].last_no).padStart(6, '0')}`;
}

/**
 * POST /api/stripe/webhook — confirmación de pago.
 *
 * Va montada ANTES del parseo de JSON porque la firma se calcula sobre el
 * cuerpo en crudo: si Express lo reinterpreta, la verificación falla siempre.
 */
export async function stripeWebhook(req: Request, res: Response): Promise<void> {
  const secreto = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secreto || !stripeConfigurado()) {
    res.status(503).json({ error: 'Webhook no configurado' });
    return;
  }

  let evento: Stripe.Event;
  try {
    evento = stripe().webhooks.constructEvent(req.body as Buffer, req.headers['stripe-signature'] as string, secreto);
  } catch (e) {
    // Firma inválida: puede ser un intento de activar matrículas sin pagar.
    res.status(400).json({ error: `Firma no válida: ${e instanceof Error ? e.message : 'desconocida'}` });
    return;
  }

  if (evento.type === 'checkout.session.completed') {
    const sesion = evento.data.object as Stripe.Checkout.Session;
    if (sesion.payment_status === 'paid') await confirmarPago(sesion);
  } else if (evento.type === 'checkout.session.expired') {
    await query(
      `UPDATE payments SET status = 'cancelado' WHERE stripe_session_id = $1 AND status = 'pendiente'`,
      [(evento.data.object as Stripe.Checkout.Session).id],
    );
  } else if (evento.type === 'charge.refunded') {
    const cargo = evento.data.object as Stripe.Charge;
    if (cargo.payment_intent) {
      await query(
        `UPDATE payments SET status = 'reembolsado' WHERE stripe_payment_intent_id = $1`,
        [String(cargo.payment_intent)],
      );
    }
  }

  // Siempre 200: si respondemos error, Stripe reintenta en bucle.
  res.json({ received: true });
}

/** Activa la matrícula y numera el justificante. Idempotente por diseño. */
async function confirmarPago(sesion: Stripe.Checkout.Session): Promise<void> {
  const enrollmentId = sesion.metadata?.enrollmentId;
  if (!enrollmentId) return;

  const yaPagado = await withTransaction(async (c) => {
    // Stripe reenvía eventos: solo el primero que encuentre la fila pendiente
    // la marca como pagada; los demás no hacen nada.
    const upd = await c.query(
      `UPDATE payments
          SET status = 'pagado', paid_at = NOW(), stripe_payment_intent_id = $2
        WHERE stripe_session_id = $1 AND status <> 'pagado'
        RETURNING id`,
      [sesion.id, sesion.payment_intent ? String(sesion.payment_intent) : null],
    );
    if (upd.rowCount === 0) return false;

    await c.query(
      `UPDATE enrollments SET status = 'activo' WHERE id = $1 AND status <> 'activo'`,
      [enrollmentId],
    );
    return true;
  });

  if (!yaPagado) return;

  const numero = await siguienteNumeroJustificante(new Date().getFullYear());
  await query('UPDATE payments SET receipt_number = $1 WHERE stripe_session_id = $2', [numero, sesion.id]);

  const info = await query<{ student_id: string; course_id: string; title: string; amount_cents: number }>(
    `SELECT p.student_id, p.course_id, c.title, p.amount_cents
       FROM payments p JOIN courses c ON c.id = p.course_id
      WHERE p.stripe_session_id = $1`,
    [sesion.id],
  );
  const p = info.rows[0];
  if (!p) return;

  await notify(
    { id: p.student_id, type: 'student' },
    'Matrícula confirmada',
    `Tu pago de ${euros(p.amount_cents)} por «${p.title}» se ha registrado. Justificante ${numero}.`,
    `/student/curso/${p.course_id}`,
  ).catch(() => { /* no bloquear la confirmación por un aviso */ });

  const staff = await query<{ user_id: string }>('SELECT user_id FROM course_staff WHERE course_id = $1', [p.course_id]);
  for (const s of staff.rows) {
    await notify({ id: s.user_id, type: 'user' }, 'Matrícula pagada',
      `Se ha cobrado ${euros(p.amount_cents)} de «${p.title}»`, `/admin/cursos/${p.course_id}`)
      .catch(() => { /* idem */ });
  }

  await audit({
    actorId: p.student_id, actorType: 'student', action: 'PAYMENT_CONFIRMED',
    entity: 'payment', entityId: sesion.id, ip: null,
    metadata: { amountCents: p.amount_cents, receipt: numero, livemode: sesion.livemode },
  }).catch(() => { /* idem */ });
}

/** GET /api/student/payments — mis pagos, para el perfil del alumno. */
export async function myPayments(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT p.id, p.amount_cents, p.status, p.receipt_number, p.paid_at, p.created_at,
            p.tax_note, c.title AS course_title, c.id AS course_id
       FROM payments p JOIN courses c ON c.id = p.course_id
      WHERE p.student_id = $1
      ORDER BY p.created_at DESC`,
    [req.auth!.sub],
  );
  res.json({ payments: rows, stripeActivo: stripeConfigurado() });
}

/** GET /api/courses/:id/payments — cobros del curso, para su dirección. */
export async function coursePayments(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT p.id, p.amount_cents, p.status, p.receipt_number, p.paid_at, p.livemode,
            s.display_name, s.email
       FROM payments p JOIN students s ON s.id = p.student_id
      WHERE p.course_id = $1
      ORDER BY p.created_at DESC`,
    [req.params.id],
  );
  const totales = await query<{ cobrado: string; pendiente: string }>(
    `SELECT COALESCE(SUM(amount_cents) FILTER (WHERE status = 'pagado'), 0)     AS cobrado,
            COALESCE(SUM(amount_cents) FILTER (WHERE status = 'pendiente'), 0) AS pendiente
       FROM payments WHERE course_id = $1`,
    [req.params.id],
  );
  res.json({
    payments: rows,
    totales: { cobradoCents: Number(totales.rows[0].cobrado), pendienteCents: Number(totales.rows[0].pendiente) },
    modoPruebas: stripeConfigurado() && !stripeEnProduccion(),
  });
}

/** GET /api/admin/stripe-status — diagnóstico para el super admin. */
export async function stripeStatus(_req: Request, res: Response): Promise<void> {
  const configurado = stripeConfigurado();
  let cuenta: { id: string; chargesEnabled: boolean; pais: string | null } | null = null;
  if (configurado) {
    try {
      // Sin argumentos apunta a la cuenta de la propia clave.
      const a = await stripe().accounts.retrieve('');
      cuenta = { id: a.id, chargesEnabled: !!a.charges_enabled, pais: a.country ?? null };
    } catch {
      cuenta = null;
    }
  }
  res.json({
    configurado,
    webhookConfigurado: !!process.env.STRIPE_WEBHOOK_SECRET,
    modo: !configurado ? 'sin configurar' : stripeEnProduccion() ? 'produccion' : 'pruebas',
    cuenta,
    regimenFiscal: NOTA_EXENCION,
  });
}

/** GET /api/student/payments/:id/receipt — justificante en PDF. */
export async function receiptPdf(req: Request, res: Response): Promise<void> {
  const { rows } = await query<{
    amount_cents: number; receipt_number: string | null; paid_at: string | null; tax_note: string | null;
    course_title: string; display_name: string; nombre: string | null; apellidos: string | null; dni: string | null;
  }>(
    `SELECT p.amount_cents, p.receipt_number, p.paid_at, p.tax_note,
            c.title AS course_title, s.display_name, s.nombre, s.apellidos, s.dni
       FROM payments p JOIN courses c ON c.id = p.course_id JOIN students s ON s.id = p.student_id
      WHERE p.id = $1 AND p.student_id = $2 AND p.status = 'pagado'`,
    [req.params.id, req.auth!.sub],
  );
  if (rows.length === 0) throw notFound('Justificante no encontrado');
  const p = rows[0];

  const { default: PDFDocument } = await import('pdfkit');
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="justificante-${p.receipt_number || 'pago'}.pdf"`);
  doc.pipe(res);

  doc.fillColor('#1a365d').font('Helvetica-Bold').fontSize(18).text('Justificante de pago', { align: 'center' });
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(11).fillColor('#555')
    .text('Gran Canaria RCP · Campus de formación', { align: 'center' });
  doc.moveDown(1.5);

  const alumno = p.apellidos ? `${p.nombre || ''} ${p.apellidos}`.trim() : p.display_name;
  const filas: Array<[string, string]> = [
    ['Nº de justificante', p.receipt_number || '—'],
    ['Fecha de pago', p.paid_at ? new Date(p.paid_at).toLocaleDateString('es-ES') : '—'],
    ['Alumno', alumno],
    ...(p.dni ? [['DNI', p.dni] as [string, string]] : []),
    ['Concepto', `Matrícula · ${p.course_title}`],
    ['Importe total', euros(p.amount_cents)],
  ];
  doc.fontSize(11).fillColor('#111');
  for (const [etiqueta, valor] of filas) {
    doc.font('Helvetica-Bold').text(`${etiqueta}: `, { continued: true });
    doc.font('Helvetica').text(valor);
    doc.moveDown(0.4);
  }

  doc.moveDown(1);
  doc.font('Helvetica-Oblique').fontSize(9).fillColor('#555')
    .text(p.tax_note || NOTA_EXENCION, { width: 480 });

  doc.end();
}
