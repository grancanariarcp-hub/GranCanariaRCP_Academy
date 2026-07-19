'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';

/**
 * Pantalla de bloqueo por matrícula sin pagar.
 *
 * El servidor no sirve el contenido del curso mientras la matrícula esté
 * pendiente, así que aquí no se muestra nada de la materia: solo el importe y
 * la vía para completar el pago. El acceso se abre al confirmarlo Stripe.
 */

const euros = (cents: number) => (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

interface Pago {
  course_id: string;
  course_title: string;
  amount_cents: number;
  status: string;
}

export function PaymentGate({ courseId }: { courseId: string }) {
  const [pago, setPago] = useState<Pago | null>(null);
  const [error, setError] = useState('');
  const [yendo, setYendo] = useState(false);

  useEffect(() => {
    api<{ payments: Pago[] }>('/api/student/payments', { auth: true })
      .then((r) => setPago(r.payments.find((p) => p.course_id === courseId) ?? null))
      .catch(() => {});
  }, [courseId]);

  async function pagar() {
    setYendo(true);
    setError('');
    try {
      const r = await api<{ url: string }>(`/api/student/courses/${courseId}/checkout`, { method: 'POST', auth: true });
      window.location.href = r.url;
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === 'STRIPE_NOT_CONFIGURED'
          ? 'El pago con tarjeta aún no está disponible. Ponte en contacto con la organización.'
          : e instanceof Error ? e.message : 'No se pudo iniciar el pago',
      );
      setYendo(false);
    }
  }

  return (
    <div className="card animate-pop" style={{ maxWidth: 520, margin: '0 auto', borderTop: '4px solid var(--warning)' }}>
      <h2 style={{ fontSize: 21, marginBottom: 8 }}>Completa el pago para acceder</h2>
      <p className="muted" style={{ fontSize: 14, marginBottom: 18 }}>
        Tu plaza está reservada{pago?.course_title ? ` en «${pago.course_title}»` : ''}, pero el contenido del curso
        no se abre hasta que se confirme el pago de la matrícula.
      </p>

      {error && <p className="alert alert-error">{error}</p>}

      {pago && (
        <div style={{ background: 'var(--gray-100)', borderRadius: 10, padding: 14, marginBottom: 18, textAlign: 'center' }}>
          <div className="muted" style={{ fontSize: 12 }}>Importe de la matrícula</div>
          <div style={{ fontSize: 30, fontWeight: 700 }}>{euros(pago.amount_cents)}</div>
        </div>
      )}

      <button className="btn btn-primary btn-full press" onClick={pagar} disabled={yendo}>
        {yendo ? 'Abriendo pago seguro…' : 'Pagar matrícula'}
      </button>

      <Link href="/student" className="btn btn-outline btn-full" style={{ marginTop: 10 }}>
        Volver a mis cursos
      </Link>

      <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
        El pago se realiza en la pasarela segura de Stripe; la plataforma no almacena los datos de tu tarjeta.
        Actividad formativa exenta de impuesto indirecto: el importe indicado es el total.
      </p>
    </div>
  );
}
