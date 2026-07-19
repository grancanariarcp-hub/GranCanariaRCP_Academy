'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';

/**
 * Pago de la matrícula pendiente.
 *
 * El importe se muestra a partir del que quedó congelado al matricularse; el
 * cobro real lo calcula siempre el servidor, nunca se envía desde aquí.
 */

const euros = (cents: number) => (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

export function PayEnrollment({
  courseId,
  estado,
  importeCents,
}: {
  courseId: string;
  estado: string;
  importeCents: number;
}) {
  const [yendo, setYendo] = useState(false);
  const [error, setError] = useState('');

  if (estado !== 'pendiente_pago') return null;

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
    <div className="card animate-pop" style={{ marginBottom: 20, borderLeft: '4px solid var(--warning)' }}>
      <div className="card-header">
        <div className="card-title">Matrícula pendiente de pago</div>
        <div className="card-subtitle">Completa el pago para acceder al contenido del curso</div>
      </div>

      {error && <p className="alert alert-error">{error}</p>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <div>
          <div className="muted" style={{ fontSize: 12 }}>Importe</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{euros(importeCents)}</div>
        </div>
        <button className="btn btn-primary press" onClick={pagar} disabled={yendo}>
          {yendo ? 'Abriendo pago seguro…' : 'Pagar matrícula'}
        </button>
      </div>

      <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
        El pago se realiza en la pasarela segura de Stripe; la plataforma no almacena datos de tu tarjeta.
        Actividad formativa exenta de impuesto indirecto: el importe indicado es el total.
      </p>
    </div>
  );
}
