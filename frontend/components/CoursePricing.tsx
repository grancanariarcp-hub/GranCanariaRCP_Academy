'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';

/**
 * Precio de matrícula del curso, con matrícula anticipada.
 *
 * Se fija un precio base —el anticipado— y un recargo porcentual que se aplica
 * a quien se matricule pasada la fecha límite. Se guarda el recargo y no el
 * segundo importe para que al cambiar el precio base el recargado se ajuste
 * solo, sin poder quedar descuadrados.
 */

export interface PrecioCurso {
  price_cents: number;
  early_bird_until: string | null;
  late_surcharge_pct: number | string | null;
}

const euros = (cents: number) => (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

export function CoursePricing({ courseId, course, onSaved }: { courseId: string; course: PrecioCurso; onSaved: () => void }) {
  const [precio, setPrecio] = useState((course.price_cents / 100).toFixed(2));
  const [hasta, setHasta] = useState(course.early_bird_until ? course.early_bird_until.slice(0, 10) : '');
  const [recargo, setRecargo] = useState(String(Number(course.late_surcharge_pct) || 0));
  const [msg, setMsg] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const baseCents = Math.round((Number(precio.replace(',', '.')) || 0) * 100);
  const pct = Number(recargo.replace(',', '.')) || 0;
  const recargadoCents = Math.round(baseCents * (1 + pct / 100));
  const hayTramos = baseCents > 0 && !!hasta && pct > 0;
  const vigenteAnticipado = hayTramos && new Date().toISOString().slice(0, 10) <= hasta;

  async function guardar() {
    setGuardando(true);
    setMsg(null);
    try {
      await api(`/api/courses/${courseId}`, {
        method: 'PATCH', auth: true,
        body: JSON.stringify({
          priceCents: baseCents,
          earlyBirdUntil: hasta || null,
          lateSurchargePct: pct,
        }),
      });
      setMsg('✅ Precio guardado');
      onSaved();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'No se pudo guardar el precio');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <div className="card-title">Precio de matrícula</div>
        <div className="card-subtitle">Deja el precio en 0 para que el curso sea gratuito</div>
      </div>

      {msg && <div className={`alert ${msg.includes('✅') ? 'alert-success' : 'alert-error'}`}>{msg}</div>}

      <div className="grid grid-3" style={{ gap: 12 }}>
        <div>
          <label className="form-label" htmlFor="p-base">Precio (€)</label>
          <input id="p-base" className="form-input" inputMode="decimal" value={precio}
            onChange={(e) => setPrecio(e.target.value)} placeholder="120,00" />
        </div>
        <div>
          <label className="form-label" htmlFor="p-hasta">Matrícula anticipada hasta</label>
          <input id="p-hasta" type="date" className="form-input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <div>
          <label className="form-label" htmlFor="p-recargo">Recargo posterior (%)</label>
          <input id="p-recargo" className="form-input" inputMode="decimal" value={recargo}
            onChange={(e) => setRecargo(e.target.value)} placeholder="20" />
        </div>
      </div>

      {/* Resultado en euros: fijar un porcentaje sin ver el importe se presta a errores. */}
      <div style={{ marginTop: 14, padding: 12, background: 'var(--gray-100)', borderRadius: 10 }}>
        {baseCents === 0 ? (
          <span className="badge badge-success">Curso gratuito</span>
        ) : hayTramos ? (
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>
                Hasta el {new Date(hasta).toLocaleDateString('es-ES')} {vigenteAnticipado && '· vigente ahora'}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)' }}>{euros(baseCents)}</div>
            </div>
            <div style={{ fontSize: 20, color: 'var(--gray-500)' }}>→</div>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>
                Desde el día siguiente {!vigenteAnticipado && hasta && '· vigente ahora'}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{euros(recargadoCents)}</div>
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              Diferencia: {euros(recargadoCents - baseCents)}
            </div>
          </div>
        ) : (
          <div>
            <div className="muted" style={{ fontSize: 12 }}>Precio único</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{euros(baseCents)}</div>
            {!hasta && pct > 0 && (
              <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Indica una fecha límite para que el recargo llegue a aplicarse.
              </p>
            )}
          </div>
        )}
      </div>

      <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
        El importe se congela al matricularse: un cambio posterior de precio no afecta a quien ya se matriculó.
      </p>

      <button className="btn btn-primary btn-small" style={{ marginTop: 12 }} onClick={guardar} disabled={guardando}>
        {guardando ? 'Guardando…' : 'Guardar precio'}
      </button>
    </div>
  );
}
