'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Ayuda } from '@/components/ayuda/Ayuda';

/**
 * Cobros del curso.
 *
 * Se emitían justificantes y se registraban pagos que la dirección del curso no
 * podía consultar en ninguna parte: para saber quién había pagado había que
 * entrar en Stripe.
 */

interface Pago {
  id: string; amount_cents: number; status: string; receipt_number: string | null;
  paid_at: string | null; livemode: boolean; display_name: string; email: string | null;
  refunded_cents: number; refunded_at: string | null;
}

const euros = (c: number) => (c / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const ETIQUETA: Record<string, string> = {
  pagado: 'Pagado', pendiente: 'Pendiente', fallido: 'Fallido',
  reembolsado: 'Reembolsado', cancelado: 'Cancelado',
};

export function CoursePayments({ courseId }: { courseId: string }) {
  const [datos, setDatos] = useState<{
    payments: Pago[];
    totales: { cobradoCents: number; pendienteCents: number; devueltoCents: number };
    modoPruebas: boolean;
  } | null>(null);

  useEffect(() => {
    api<NonNullable<typeof datos>>(`/api/courses/${courseId}/payments`, { auth: true })
      .then(setDatos).catch(() => {});
  }, [courseId]);

  if (!datos || datos.payments.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <div className="card-title">Cobros del curso <Ayuda tema="profesor-pagos" /></div>
        <div className="card-subtitle">{datos.payments.length} movimientos</div>
      </div>

      {datos.modoPruebas && (
        <div className="alert alert-error" style={{ fontSize: 13 }}>
          La pasarela está en modo de pruebas: estos importes <strong>no son dinero real</strong>.
        </div>
      )}

      <div className="grid grid-2" style={{ gap: 12, marginBottom: 14 }}>
        <div className="info-box">
          <div className="muted" style={{ fontSize: 12 }}>Cobrado</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>
            {euros(datos.totales.cobradoCents)}
          </div>
          {datos.totales.devueltoCents > 0 && (
            <div className="muted" style={{ fontSize: 11.5 }}>
              ya descontados {euros(datos.totales.devueltoCents)} devueltos
            </div>
          )}
        </div>
        <div className="info-box">
          <div className="muted" style={{ fontSize: 12 }}>Pendiente de pago</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: datos.totales.pendienteCents > 0 ? 'var(--warning)' : undefined }}>
            {euros(datos.totales.pendienteCents)}
          </div>
        </div>
      </div>

      <div className="table-responsive" style={{ maxHeight: 320 }}>
        <table className="table-plain">
          <thead>
            <tr><th>Alumno</th><th>Importe</th><th>Estado</th><th>Justificante</th><th>Fecha</th></tr>
          </thead>
          <tbody>
            {datos.payments.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.display_name}
                  {p.email && <div className="muted" style={{ fontSize: 11.5 }}>{p.email}</div>}
                </td>
                <td>
                  <strong>{euros(p.amount_cents)}</strong>
                  {p.refunded_cents > 0 && (
                    <div className="muted" style={{ fontSize: 11.5 }}>
                      −{euros(p.refunded_cents)} devuelto
                    </div>
                  )}
                </td>
                <td>
                  <span className={`badge ${p.status === 'pagado' ? 'badge-success' : p.status === 'pendiente' ? 'badge-warning' : ''}`}>
                    {ETIQUETA[p.status] ?? p.status}
                  </span>
                </td>
                <td className="muted" style={{ fontSize: 12.5, fontFamily: 'monospace' }}>{p.receipt_number ?? '—'}</td>
                <td className="muted" style={{ fontSize: 12.5 }}>
                  {p.paid_at ? new Date(p.paid_at).toLocaleDateString('es-ES') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
