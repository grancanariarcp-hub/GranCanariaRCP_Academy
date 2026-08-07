'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

/**
 * Servicios extras aplicados a un curso concreto. Muestra el valor efectivo
 * (heredado de la academia o propio del curso) con claridad: qué se cobra y qué
 * va incluido gratis. El super admin puede ajustarlo solo para este curso;
 * dejar un campo vacío = usar el valor de la academia.
 */

type Vals = Record<string, number | string | null>;
const CAMPOS: Array<{ key: string; label: string; unit: 'eur' | 'pct' | 'mb' | 'int'; grupo: string }> = [
  { key: 'coste_minimo_curso_cents', label: 'Coste mínimo del curso', unit: 'eur', grupo: 'Curso' },
  { key: 'pct_matricula', label: 'Comisión de matrícula', unit: 'pct', grupo: 'Curso' },
  { key: 'gestion_cfc_cents', label: 'Gestión CFC por la academia', unit: 'eur', grupo: 'CFC' },
  { key: 'memoria_incluida_mb', label: 'Almacenamiento incluido', unit: 'mb', grupo: 'Almacenamiento' },
  { key: 'memoria_extra_bloque_mb', label: 'Bloque de memoria extra', unit: 'mb', grupo: 'Almacenamiento' },
  { key: 'memoria_extra_cents', label: 'Precio por bloque extra', unit: 'eur', grupo: 'Almacenamiento' },
  { key: 'ia_creditos_incluidos', label: 'Créditos de IA incluidos', unit: 'int', grupo: 'IA' },
  { key: 'ia_paquete_creditos', label: 'Créditos por paquete', unit: 'int', grupo: 'IA' },
  { key: 'ia_paquete_cents', label: 'Precio del paquete de IA', unit: 'eur', grupo: 'IA' },
];

function fmt(unit: string, v: number | string | null): string {
  const n = Number(v ?? 0);
  if (unit === 'eur') return `${(n / 100).toFixed(2)} €`;
  if (unit === 'pct') return `${n} %`;
  if (unit === 'mb') return `${n} MB`;
  return String(n);
}

export function ServiciosExtrasCurso({ courseId, canEdit }: { courseId: string; canEdit: boolean }) {
  const [efectivo, setEfectivo] = useState<Vals | null>(null);
  const [override, setOverride] = useState<Vals | null>(null);
  const [global, setGlobal] = useState<Vals | null>(null);
  const [editar, setEditar] = useState(false);
  const [f, setF] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function cargar() {
    try {
      const r = await api<{ global: Vals; override: Vals | null; efectivo: Vals }>(`/api/courses/${courseId}/extras`, { auth: true });
      setEfectivo(r.efectivo); setOverride(r.override); setGlobal(r.global);
      const ini: Record<string, string> = {};
      for (const c of CAMPOS) {
        const ov = r.override ? r.override[c.key] : null;
        ini[c.key] = ov == null ? '' : (c.unit === 'eur' ? (Number(ov) / 100).toFixed(2) : String(ov));
      }
      setF(ini);
    } catch { /* ignore */ }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [courseId]);

  async function guardar() {
    setMsg(null);
    const body: Record<string, number | null> = {};
    for (const c of CAMPOS) {
      const raw = (f[c.key] ?? '').trim();
      if (raw === '') { body[c.key] = null; continue; } // vacío = heredar de la academia
      const num = parseFloat(raw) || 0;
      body[c.key] = c.unit === 'eur' ? Math.round(num * 100) : Math.max(0, Math.round(num));
    }
    try {
      await api(`/api/courses/${courseId}/extras`, { method: 'PUT', auth: true, body: JSON.stringify(body) });
      setMsg({ ok: true, text: 'Ajustes de este curso guardados ✅' });
      setEditar(false); cargar();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError ? e.message : 'No se pudo guardar' });
    }
  }

  if (!efectivo) return null;
  const esPropio = (key: string) => override != null && override[key] != null;
  const grupos = Array.from(new Set(CAMPOS.map((c) => c.grupo)));

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <div className="card-title">Servicios extras de este curso</div>
        <div className="card-subtitle">Qué se cobra y qué va incluido. Solo configuración: aún no se cobra nada.</div>
      </div>

      {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}

      {!editar ? (
        <>
          {grupos.map((g) => (
            <div key={g} style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{g}</div>
              {CAMPOS.filter((c) => c.grupo === g).map((c) => (
                <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--gray-200)', fontSize: 13.5 }}>
                  <span>{c.label}</span>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <strong>{fmt(c.unit, efectivo[c.key])}</strong>
                    <span className="badge" style={{ fontSize: 10, background: esPropio(c.key) ? 'var(--secondary-dark)' : 'var(--gray-300)', color: esPropio(c.key) ? '#fff' : 'var(--gray-700)' }}>
                      {esPropio(c.key) ? 'este curso' : 'academia'}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          ))}
          <div className="info-box" style={{ fontSize: 12.5, marginTop: 8 }}>
            <strong>Incluido gratis:</strong> {fmt('mb', efectivo.memoria_incluida_mb)} de almacenamiento
            {Number(efectivo.ia_creditos_incluidos) > 0 && <> · {efectivo.ia_creditos_incluidos} créditos de IA</>}.
            Tramitar los CFC por tu cuenta es gratis.
          </div>
          {canEdit && <button className="btn btn-outline btn-small" onClick={() => setEditar(true)} style={{ marginTop: 12 }}>Ajustar para este curso</button>}
        </>
      ) : (
        <>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>
            Deja un campo <strong>vacío</strong> para usar el valor de la academia. Lo que escribas afecta solo a este curso.
          </p>
          {grupos.map((g) => (
            <div key={g} style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 13, margin: '6px 0' }}>{g}</div>
              <div className="grid grid-2" style={{ gap: 12 }}>
                {CAMPOS.filter((c) => c.grupo === g).map((c) => (
                  <div className="form-group" key={c.key}>
                    <label className="form-label">{c.label} {c.unit === 'eur' ? '(€)' : c.unit === 'pct' ? '(%)' : c.unit === 'mb' ? '(MB)' : ''}</label>
                    <input className="form-input" type="number" step={c.unit === 'eur' ? '0.01' : c.unit === 'pct' ? '0.1' : '1'} min="0"
                      placeholder={`academia: ${fmt(c.unit, global ? global[c.key] : 0)}`}
                      value={f[c.key] ?? ''} onChange={(e) => setF((p) => ({ ...p, [c.key]: e.target.value }))} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-primary btn-small" onClick={guardar}>Guardar</button>
            <button className="btn btn-outline btn-small" onClick={() => { setEditar(false); cargar(); }}>Cancelar</button>
          </div>
        </>
      )}
    </div>
  );
}
