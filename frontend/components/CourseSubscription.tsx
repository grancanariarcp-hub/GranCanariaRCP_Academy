'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';

/**
 * Precios por suscripción del curso.
 *
 * Cada periodo se cobra ENTERO por adelantado, no mes a mes: evita los impagos
 * a mitad de periodo y da mejor caja. Se muestra el equivalente mensual porque
 * es como lo compara quien elige, pero lo que se cobra es el total.
 */

export interface PreciosCurso {
  billing_type: string;
  price_mensual_cents: number | null;
  price_trimestral_cents: number | null;
  price_semestral_cents: number | null;
  price_anual_cents: number | null;
}

const euros = (cents: number) => (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

interface Periodo {
  clave: 'mensual' | 'trimestral' | 'semestral' | 'anual';
  etiqueta: string;
  meses: number;
  /** El que se destaca en la venta; ver la nota del componente. */
  recomendado?: boolean;
}

const PERIODOS: Periodo[] = [
  { clave: 'mensual', etiqueta: 'Mensual', meses: 1 },
  { clave: 'trimestral', etiqueta: 'Trimestral', meses: 3 },
  { clave: 'semestral', etiqueta: 'Semestral', meses: 6, recomendado: true },
  { clave: 'anual', etiqueta: 'Anual', meses: 12 },
];

export function CourseSubscription({ courseId, course, onSaved }: {
  courseId: string; course: PreciosCurso; onSaved: () => void;
}) {
  const [activa, setActiva] = useState(course.billing_type === 'suscripcion');
  const [precios, setPrecios] = useState({
    mensual: ((course.price_mensual_cents ?? 1000) / 100).toFixed(2),
    trimestral: ((course.price_trimestral_cents ?? 2700) / 100).toFixed(2),
    semestral: ((course.price_semestral_cents ?? 4800) / 100).toFixed(2),
    anual: ((course.price_anual_cents ?? 8400) / 100).toFixed(2),
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cents = (v: string) => Math.round((Number(v.replace(',', '.')) || 0) * 100);
  const mensualCents = cents(precios.mensual);

  async function guardar() {
    setGuardando(true);
    setMsg(null);
    try {
      await api(`/api/courses/${courseId}`, {
        method: 'PATCH', auth: true,
        body: JSON.stringify({
          billingType: activa ? 'suscripcion' : 'unico',
          priceMensualCents: cents(precios.mensual),
          priceTrimestralCents: cents(precios.trimestral),
          priceSemestralCents: cents(precios.semestral),
          priceAnualCents: cents(precios.anual),
        }),
      });
      setMsg({ ok: true, text: '✅ Suscripción guardada' });
      onSaved();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError ? e.message : 'No se pudo guardar' });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <div className="card-title">Suscripción</div>
        <div className="card-subtitle">Para cursos que se pagan por periodos, como la preparación de oposiciones</div>
      </div>

      {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}

      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14.5, marginBottom: 16 }}>
        <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
        Cobrar este curso por suscripción en lugar de un pago único
      </label>

      {activa && (
        <>
          <div className="grid grid-4" style={{ gap: 12, marginBottom: 14 }}>
            {PERIODOS.map((p) => {
              const total = cents(precios[p.clave]);
              const porMes = p.meses > 0 ? Math.round(total / p.meses) : total;
              const ahorro = mensualCents > 0 ? Math.round((1 - porMes / mensualCents) * 100) : 0;
              return (
                <div key={p.clave} style={{
                  padding: 12, borderRadius: 10,
                  border: p.recomendado ? '2px solid var(--success)' : '1px solid var(--gray-200)',
                  background: p.recomendado ? '#f2fbf6' : '#fff',
                }}>
                  <label className="form-label" htmlFor={`s-${p.clave}`}>
                    {p.etiqueta}
                    {p.recomendado && <span className="badge badge-success" style={{ marginLeft: 5, fontSize: 10 }}>destacado</span>}
                  </label>
                  <input id={`s-${p.clave}`} className="form-input" inputMode="decimal"
                    value={precios[p.clave]}
                    onChange={(e) => setPrecios({ ...precios, [p.clave]: e.target.value })} />
                  <div className="muted" style={{ fontSize: 12, marginTop: 5 }}>
                    {euros(porMes)}/mes
                    {ahorro > 0 && <strong style={{ color: 'var(--success)' }}> · −{ahorro} %</strong>}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="muted" style={{ fontSize: 12.5, marginBottom: 14 }}>
            El importe indicado es el <strong>total del periodo</strong>, que se cobra por adelantado.
            Debajo se muestra su equivalente mensual, que es como lo compara quien elige. Deja un precio en
            0 para no ofrecer ese periodo.
          </p>
        </>
      )}

      <button className="btn btn-primary btn-small" onClick={guardar} disabled={guardando}>
        {guardando ? 'Guardando…' : 'Guardar suscripción'}
      </button>

      {activa && (
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          El acceso se cierra al vencer el periodo y se ofrece la renovación. El cobro recurrente automático
          se activará cuando se conecte la pasarela en modo real; mientras tanto, puedes prorrogar accesos a
          mano.
        </p>
      )}
    </div>
  );
}
