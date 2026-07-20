'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

/**
 * Estado de mi suscripción, con la cancelación a un clic.
 *
 * Cancelar tiene que ser tan fácil como contratar: un botón visible, sin
 * formularios ni preavisos. Además de ser lo correcto, evita la cláusula
 * abusiva y las reclamaciones.
 */

interface Estado {
  suscrito: boolean;
  esSuscripcion?: boolean;
  estado?: string;
  periodo?: string | null;
  importeCents?: number;
  accessUntil?: string | null;
  diasRestantes?: number | null;
  renovacionAutomatica?: boolean;
  cobroRecurrenteActivo?: boolean;
  renovacionPendienteDeActivar?: boolean;
  canceladaEl?: string | null;
  desistimientoHasta?: string | null;
  puedeDesistir?: boolean;
}

const euros = (c: number) => (c / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const NOMBRE: Record<string, string> = {
  mensual: 'mensual', trimestral: 'trimestral', semestral: 'semestral', anual: 'anual',
};

export function MySubscription({ courseId }: { courseId: string }) {
  const [s, setS] = useState<Estado | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const cargar = useCallback(() => {
    api<Estado>(`/api/student/courses/${courseId}/subscription`, { auth: true }).then(setS).catch(() => {});
  }, [courseId]);

  useEffect(() => { cargar(); }, [cargar]);

  if (!s?.suscrito || !s.esSuscripcion) return null;

  async function cancelar() {
    if (!confirm(
      'Al cancelar dejarás de pagar, pero conservas el acceso hasta que termine el periodo ya pagado.\n\n'
      + 'No se devuelve la parte no consumida. ¿Continuar?',
    )) return;
    try {
      const r = await api<{ mensaje: string }>(`/api/student/courses/${courseId}/cancel-renewal`, { method: 'POST', auth: true });
      setMsg({ ok: true, text: r.mensaje });
      cargar();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError ? e.message : 'No se pudo cancelar' });
    }
  }

  async function reactivar() {
    await api(`/api/student/courses/${courseId}/reactivate`, { method: 'POST', auth: true });
    setMsg({ ok: true, text: 'Renovación reactivada.' });
    cargar();
  }

  const vence = s.accessUntil ? new Date(s.accessUntil).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }) : null;
  const porVencer = (s.diasRestantes ?? 99) <= 7;

  return (
    <div className="card" style={{
      marginBottom: 20,
      borderLeft: `4px solid ${s.renovacionAutomatica || s.renovacionPendienteDeActivar ? 'var(--success)' : 'var(--warning)'}`,
    }}>
      <div className="card-header">
        <div className="card-title">Tu suscripción</div>
        <div className="card-subtitle">
          Plan {NOMBRE[s.periodo ?? ''] ?? s.periodo} · {euros(s.importeCents ?? 0)} por periodo
        </div>
      </div>

      {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div className="muted" style={{ fontSize: 12 }}>
            {s.renovacionAutomatica ? 'Se renueva el' : 'Acceso hasta el'}
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: porVencer ? 'var(--warning)' : undefined }}>
            {vence ?? 'Pendiente de pago'}
          </div>
          {s.diasRestantes !== null && s.diasRestantes !== undefined && s.diasRestantes > 0 && (
            <div className="muted" style={{ fontSize: 12 }}>
              quedan {s.diasRestantes} día{s.diasRestantes === 1 ? '' : 's'}
            </div>
          )}
        </div>
        <div>
          <div className="muted" style={{ fontSize: 12 }}>Renovación</div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>
            {s.renovacionPendienteDeActivar
              ? <span>Manual</span>
              : s.renovacionAutomatica
                ? <span style={{ color: 'var(--success)' }}>Automática</span>
                : <span style={{ color: 'var(--warning)' }}>Cancelada</span>}
          </div>
        </div>
      </div>

      {/* Mientras el cobro recurrente no esté activo en la pasarela, NO se
          renueva nada: decir lo contrario sería prometer un cargo que no
          ocurrirá y dejar al alumno sin acceso sin avisarle. */}
      {s.renovacionPendienteDeActivar ? (
        <>
          <p style={{ fontSize: 13.5, marginBottom: 12 }}>
            Has pagado un periodo completo. <strong>No hay cobro automático</strong>: tu acceso llega hasta
            el {vence} y, para continuar después, tendrás que renovarlo tú.
          </p>
          <p className="muted" style={{ fontSize: 12.5 }}>
            Te avisaremos antes de que venza. No tienes nada que cancelar.
          </p>
        </>
      ) : s.renovacionAutomatica ? (
        <>
          <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
            Se te cobrará {euros(s.importeCents ?? 0)} automáticamente el {vence}. Puedes cancelar cuando
            quieras: conservarás el acceso hasta esa fecha y no se te volverá a cobrar.
          </p>
          <button className="btn btn-outline btn-small" onClick={cancelar}>Cancelar la renovación</button>
        </>
      ) : (
        <>
          <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
            No se te volverá a cobrar. Mantienes el acceso hasta el {vence}; después necesitarás renovar para
            seguir usando el curso.
          </p>
          <button className="btn btn-primary btn-small press" onClick={reactivar}>Reactivar la renovación</button>
        </>
      )}

      {s.puedeDesistir && s.desistimientoHasta && (
        <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
          Estás dentro del plazo de desistimiento de 14 días (hasta el{' '}
          {new Date(s.desistimientoHasta).toLocaleDateString('es-ES')}). Para ejercerlo, escríbenos y se te
          reembolsará lo pagado descontando la parte que hayas utilizado.
        </p>
      )}
    </div>
  );
}
