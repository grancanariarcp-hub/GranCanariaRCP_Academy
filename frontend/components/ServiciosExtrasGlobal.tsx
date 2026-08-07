'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

/**
 * Configuración global de «Servicios extras» de la academia (solo super admin).
 * Vive en el perfil. Es SOLO configuración: fija precios y límites incluidos; el
 * cobro efectivo al profesor aún no está activo. Los cursos nuevos parten de
 * estos valores y cada curso puede ajustarlos por su cuenta (override).
 */

type Settings = {
  coste_minimo_curso_cents: number;
  pct_matricula: number | string;
  gestion_cfc_cents: number;
  memoria_incluida_mb: number;
  memoria_extra_bloque_mb: number;
  memoria_extra_cents: number;
  ia_creditos_incluidos: number;
  ia_paquete_creditos: number;
  ia_paquete_cents: number;
};

const eur = (cents: number) => (cents / 100).toFixed(2);

export function ServiciosExtrasGlobal() {
  const [s, setS] = useState<Settings | null>(null);
  const [f, setF] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api<{ settings: Settings }>('/api/admin/academia', { auth: true })
      .then((r) => { setS(r.settings); rellenar(r.settings); })
      .catch(() => {});
  }, []);

  function rellenar(x: Settings) {
    setF({
      coste_minimo: eur(x.coste_minimo_curso_cents),
      pct: String(x.pct_matricula),
      gestion_cfc: eur(x.gestion_cfc_cents),
      mem_incluida: String(x.memoria_incluida_mb),
      mem_bloque: String(x.memoria_extra_bloque_mb),
      mem_precio: eur(x.memoria_extra_cents),
      ia_incluidos: String(x.ia_creditos_incluidos),
      ia_paquete: String(x.ia_paquete_creditos),
      ia_precio: eur(x.ia_paquete_cents),
    });
  }

  async function guardar() {
    setMsg(null);
    const cents = (v: string) => Math.round((parseFloat(v) || 0) * 100);
    const int = (v: string) => Math.max(0, Math.round(parseFloat(v) || 0));
    try {
      const r = await api<{ settings: Settings }>('/api/admin/academia', {
        method: 'PUT', auth: true,
        body: JSON.stringify({
          coste_minimo_curso_cents: cents(f.coste_minimo),
          pct_matricula: parseFloat(f.pct) || 0,
          gestion_cfc_cents: cents(f.gestion_cfc),
          memoria_incluida_mb: int(f.mem_incluida),
          memoria_extra_bloque_mb: Math.max(1, int(f.mem_bloque)),
          memoria_extra_cents: cents(f.mem_precio),
          ia_creditos_incluidos: int(f.ia_incluidos),
          ia_paquete_creditos: Math.max(1, int(f.ia_paquete)),
          ia_paquete_cents: cents(f.ia_precio),
        }),
      });
      setS(r.settings); rellenar(r.settings);
      setMsg({ ok: true, text: 'Configuración guardada ✅' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError ? e.message : 'No se pudo guardar' });
    }
  }

  if (!s) return null;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <div className="card-title">Servicios extras de la academia</div>
        <div className="card-subtitle">Precios y límites incluidos. Los cursos nuevos parten de aquí; cada curso puede ajustarlo.</div>
      </div>

      <div className="alert" style={{ background: 'var(--secondary-light, #eef2ff)', color: 'var(--secondary-dark)', fontSize: 13 }}>
        <strong>Solo configuración.</strong> Aquí fijas cuánto cuesta cada cosa y qué va incluido gratis. El cobro
        efectivo al profesor todavía <strong>no está activo</strong>: de momento nadie paga estas cuotas.
      </div>

      {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}

      <div style={{ fontWeight: 700, fontSize: 13, margin: '10px 0 6px' }}>Curso</div>
      <div className="grid grid-2" style={{ gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Coste mínimo por curso (€)</label>
          <input className="form-input" type="number" step="0.01" min="0" value={f.coste_minimo} onChange={set('coste_minimo')} />
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>Lo mínimo que se cobra por publicar un curso.</p>
        </div>
        <div className="form-group">
          <label className="form-label">Comisión de matrícula (%)</label>
          <input className="form-input" type="number" step="0.1" min="0" max="100" value={f.pct} onChange={set('pct')} />
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>Porcentaje de cada matrícula que se queda la academia.</p>
        </div>
      </div>

      <div style={{ fontWeight: 700, fontSize: 13, margin: '10px 0 6px' }}>Acreditación CFC</div>
      <div className="form-group">
        <label className="form-label">Gestión de los CFC por la academia (€)</label>
        <input className="form-input" type="number" step="0.01" min="0" value={f.gestion_cfc} onChange={set('gestion_cfc')} />
        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          <strong>Gratis</strong> si el profesor tramita los CFC por su cuenta. Este importe es solo si prefiere que
          se los gestione la academia.
        </p>
      </div>

      <div style={{ fontWeight: 700, fontSize: 13, margin: '10px 0 6px' }}>Almacenamiento</div>
      <div className="grid grid-2" style={{ gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Incluido gratis por profesor (MB)</label>
          <input className="form-input" type="number" min="0" value={f.mem_incluida} onChange={set('mem_incluida')} />
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>Va sin coste con la cuenta.</p>
        </div>
        <div className="form-group">
          <label className="form-label">Bloque de memoria extra (MB)</label>
          <input className="form-input" type="number" min="1" value={f.mem_bloque} onChange={set('mem_bloque')} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Precio por bloque extra (€)</label>
        <input className="form-input" type="number" step="0.01" min="0" value={f.mem_precio} onChange={set('mem_precio')} />
        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          Se paga solo al superar los {f.mem_incluida} MB incluidos: {f.mem_precio} € por cada {f.mem_bloque} MB más.
        </p>
      </div>

      <div style={{ fontWeight: 700, fontSize: 13, margin: '10px 0 6px' }}>Créditos de IA</div>
      <div className="grid grid-2" style={{ gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Incluidos gratis</label>
          <input className="form-input" type="number" min="0" value={f.ia_incluidos} onChange={set('ia_incluidos')} />
        </div>
        <div className="form-group">
          <label className="form-label">Créditos por paquete extra</label>
          <input className="form-input" type="number" min="1" value={f.ia_paquete} onChange={set('ia_paquete')} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Precio del paquete (€)</label>
        <input className="form-input" type="number" step="0.01" min="0" value={f.ia_precio} onChange={set('ia_precio')} />
        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          {f.ia_incluidos} créditos incluidos; después, {f.ia_precio} € por cada {f.ia_paquete} créditos.
        </p>
      </div>

      <button className="btn btn-primary" onClick={guardar} style={{ marginTop: 8 }}>Guardar configuración</button>
    </div>
  );
}
