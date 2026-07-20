'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';

/**
 * Contratación por suscripción.
 *
 * Las condiciones que la ley obliga a informar ANTES de contratar van a la
 * vista y con casillas separadas, no escondidas en un enlace: es lo que
 * convierte «no se devuelve la parte no consumida» en una cláusula válida.
 */

interface Plan { periodo: string; meses: number; totalCents: number; porMesCents: number; ahorroPct: number }

const euros = (c: number) => (c / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const NOMBRE: Record<string, string> = {
  mensual: 'Mensual', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual',
};

export function SubscriptionPlans({ courseId, onContratado }: { courseId: string; onContratado?: () => void }) {
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [sel, setSel] = useState('');
  const [inicio, setInicio] = useState(false);
  const [condiciones, setCondiciones] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api<{ suscripcion: boolean; planes: Plan[] }>(`/api/public/courses/${courseId}/planes`)
      .then((r) => {
        setPlanes(r.planes);
        // Se preselecciona el semestral: encaja con el ciclo de preparación.
        setSel(r.planes.find((p) => p.periodo === 'semestral')?.periodo ?? r.planes[0]?.periodo ?? '');
      })
      .catch(() => {});
  }, [courseId]);

  if (planes.length === 0) return null;
  const elegido = planes.find((p) => p.periodo === sel);

  async function contratar() {
    setError('');
    setEnviando(true);
    try {
      await api(`/api/student/courses/${courseId}/subscribe`, {
        method: 'POST', auth: true,
        body: JSON.stringify({ periodo: sel, aceptaInicioInmediato: inicio, aceptaCondiciones: condiciones }),
      });
      const pago = await api<{ url: string }>(`/api/student/courses/${courseId}/checkout`, { method: 'POST', auth: true });
      window.location.href = pago.url;
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === 'STRIPE_NOT_CONFIGURED'
          ? 'El pago con tarjeta aún no está disponible. Ponte en contacto con la organización.'
          : e instanceof Error ? e.message : 'No se pudo completar la contratación',
      );
      setEnviando(false);
      onContratado?.();
    }
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header">
        <div className="card-title">Elige tu suscripción</div>
        <div className="card-subtitle">Cuanto más largo el periodo, menos pagas al mes</div>
      </div>

      {error && <p className="alert alert-error">{error}</p>}

      <div className="grid grid-4" style={{ gap: 10, marginBottom: 16 }}>
        {planes.map((p) => (
          <button key={p.periodo} type="button" onClick={() => setSel(p.periodo)}
            style={{
              textAlign: 'center', padding: 14, borderRadius: 12, cursor: 'pointer',
              border: sel === p.periodo ? '2px solid var(--primary-dark)' : '1px solid var(--gray-300)',
              background: sel === p.periodo ? 'var(--gray-100)' : '#fff',
            }}>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{NOMBRE[p.periodo] ?? p.periodo}</div>
            <div style={{ fontSize: 22, fontWeight: 800, margin: '6px 0 2px' }}>{euros(p.porMesCents)}</div>
            <div className="muted" style={{ fontSize: 11.5 }}>al mes</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{euros(p.totalCents)} en total</div>
            {p.ahorroPct > 0 && (
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--success)', marginTop: 3 }}>
                ahorras {p.ahorroPct} %
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Información previa obligatoria, a la vista y en lenguaje claro. */}
      {elegido && (
        <div className="info-box" style={{ fontSize: 13.5, marginBottom: 14 }}>
          <strong>Antes de contratar, esto es lo que aceptas:</strong>
          <ul style={{ margin: '8px 0 0 18px', lineHeight: 1.7 }}>
            <li>
              Pagas <strong>{euros(elegido.totalCents)}</strong> ahora por {elegido.meses}{' '}
              {elegido.meses === 1 ? 'mes' : 'meses'} completos.
            </li>
            <li>
              <strong>La renovación es automática</strong>: al terminar el periodo se cobrará de nuevo{' '}
              {euros(elegido.totalCents)} cada {elegido.meses === 1 ? 'mes' : `${elegido.meses} meses`}, salvo
              que canceles.
            </li>
            <li>
              <strong>Puedes cancelar cuando quieras</strong>, con un botón y sin avisar con antelación.
              Conservas el acceso hasta que termine el periodo que ya has pagado.
            </li>
            <li>
              Al cancelar <strong>no se devuelve la parte no consumida</strong> del periodo en curso: lo
              mantienes hasta su vencimiento.
            </li>
            <li>
              Tienes <strong>14 días naturales para desistir</strong> desde la contratación. Si empiezas a
              usarlo de inmediato y luego desistes, se descuenta la parte que hayas usado.
            </li>
          </ul>
        </div>
      )}

      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13.5, marginBottom: 8 }}>
        <input type="checkbox" checked={inicio} onChange={(e) => setInicio(e.target.checked)} style={{ marginTop: 3 }} />
        <span>
          Quiero <strong>empezar a usarlo de inmediato</strong> y entiendo que, si desisto dentro de los 14
          días, se me descontará la parte proporcional ya utilizada.
        </span>
      </label>

      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13.5, marginBottom: 16 }}>
        <input type="checkbox" checked={condiciones} onChange={(e) => setCondiciones(e.target.checked)} style={{ marginTop: 3 }} />
        <span>
          He leído y acepto las <Link href="/terminos">condiciones de la suscripción</Link> y la{' '}
          <Link href="/privacidad">política de privacidad</Link>, incluida la renovación automática.
        </span>
      </label>

      <button className="btn btn-primary btn-full press" onClick={contratar}
        disabled={!sel || !inicio || !condiciones || enviando}>
        {enviando ? 'Abriendo pago seguro…' : elegido ? `Suscribirme por ${euros(elegido.totalCents)}` : 'Suscribirme'}
      </button>

      <p className="muted" style={{ fontSize: 12, marginTop: 10, textAlign: 'center' }}>
        Pago seguro con tarjeta. Actividad formativa exenta de impuesto indirecto: el importe es el total.
      </p>
    </div>
  );
}
