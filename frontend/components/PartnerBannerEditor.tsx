'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

/**
 * Editor de la tarjeta de venta cruzada con PÚLSAR (super admin).
 *
 * Configura título, texto, imagen, enlace, botón y si está activa. Debajo, el
 * recuento de referidos entrantes (?ref=...), para medir la reciprocidad con
 * PÚLSAR. Es solo marketing: no toca cursos ni matrículas.
 */

interface Banner {
  activo: boolean; titulo: string; texto: string; imagenUrl: string; enlace: string; textoBoton: string;
}
interface Fuente { ref: string; total: number; esteMes: number }

export function PartnerBannerEditor() {
  const [b, setB] = useState<Banner | null>(null);
  const [fuentes, setFuentes] = useState<Fuente[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api<{ banner: Banner }>('/api/admin/partner-banner', { auth: true }).then((r) => setB(r.banner)).catch(() => {});
    api<{ fuentes: Fuente[] }>('/api/admin/referidos', { auth: true }).then((r) => setFuentes(r.fuentes)).catch(() => {});
  }, []);

  async function guardar() {
    if (!b) return;
    setGuardando(true); setMsg(null);
    try {
      await api('/api/admin/partner-banner', { method: 'POST', auth: true, body: JSON.stringify(b) });
      setMsg({ ok: true, texto: 'Guardado. Ya se ve en el campus.' });
    } catch (e) {
      setMsg({ ok: false, texto: e instanceof ApiError ? e.message : 'No se pudo guardar' });
    } finally {
      setGuardando(false);
    }
  }

  if (!b) return null;
  const set = (k: keyof Banner, v: string | boolean) => setB({ ...b, [k]: v });

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <div className="card-title">Promoción de PÚLSAR (venta cruzada)</div>
        <div className="card-subtitle">La tarjeta que ofrece la práctica presencial con PÚLSAR</div>
      </div>

      {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`} style={{ fontSize: 13 }}>{msg.texto}</div>}

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 14 }}>
        <input type="checkbox" checked={b.activo} onChange={(e) => set('activo', e.target.checked)} />
        <strong>Mostrar la tarjeta</strong> en el campus (portada, panel del alumno y fichas de soporte vital)
      </label>

      <div className="form-group">
        <label className="form-label">Título</label>
        <input className="form-input" value={b.titulo} maxLength={120} onChange={(e) => set('titulo', e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Texto</label>
        <textarea className="form-input" style={{ height: 70, padding: 10 }} maxLength={400} value={b.texto} onChange={(e) => set('texto', e.target.value)} />
      </div>
      <div className="grid grid-2" style={{ gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Enlace de salida</label>
          <input className="form-input" value={b.enlace} onChange={(e) => set('enlace', e.target.value)} />
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>Se le añade <code>?ref=academia</code> automáticamente para medir el origen.</p>
        </div>
        <div className="form-group">
          <label className="form-label">Texto del botón</label>
          <input className="form-input" value={b.textoBoton} maxLength={40} onChange={(e) => set('textoBoton', e.target.value)} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Imagen (URL, opcional)</label>
        <input className="form-input" placeholder="https://…" value={b.imagenUrl} onChange={(e) => set('imagenUrl', e.target.value)} />
      </div>

      <button className="btn btn-primary btn-small" onClick={guardar} disabled={guardando}>
        {guardando ? 'Guardando…' : 'Guardar'}
      </button>

      {fuentes.length > 0 && (
        <div style={{ marginTop: 18, borderTop: '1px solid var(--gray-200)', paddingTop: 12 }}>
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>Visitas que llegaron con un enlace de referido:</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {fuentes.map((f) => (
              <div key={f.ref} className="info-box" style={{ minWidth: 120 }}>
                <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }} className="muted">{f.ref}</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{f.total}</div>
                <div className="muted" style={{ fontSize: 12 }}>{f.esteMes} este mes</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
