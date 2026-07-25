'use client';

import { useEffect, useState } from 'react';
import { api, downloadFile, ApiError } from '@/lib/api';
import { Ayuda } from '@/components/ayuda/Ayuda';

/**
 * Subgrupos de alumnos + puente con PÚLSAR.
 *
 * El director reparte a los matriculados en subgrupos (por color) para la parte
 * práctica, exporta el curso para PÚLSAR e importa después los resultados. Todo
 * vive junto porque es un mismo flujo: agrupar → exportar → (práctica) → importar.
 */

interface Subgrupo { id: string; nombre: string; color: string | null; orden: number; alumnos: number }
interface Alumno { enrollmentId: string; nombre: string; subgroupId: string | null; sinDocumento: boolean }
interface Color { nombre: string; color: string }

export function SubgruposPanel({ courseId }: { courseId: string }) {
  const [subgrupos, setSubgrupos] = useState<Subgrupo[]>([]);
  const [roster, setRoster] = useState<Alumno[]>([]);
  const [colores, setColores] = useState<Color[]>([]);
  const [num, setNum] = useState(2);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [cargando, setCargando] = useState(false);

  function cargar() {
    api<{ subgrupos: Subgrupo[]; roster: Alumno[]; colores: Color[] }>(`/api/courses/${courseId}/subgrupos`, { auth: true })
      .then((r) => { setSubgrupos(r.subgrupos); setRoster(r.roster); setColores(r.colores); })
      .catch(() => {});
  }
  useEffect(cargar, [courseId]);

  async function repartir() {
    setCargando(true); setMsg(null);
    try {
      await api(`/api/courses/${courseId}/subgrupos/auto`, {
        method: 'POST', auth: true, body: JSON.stringify({ numSubgrupos: num, usarColores: true }),
      });
      cargar();
      setMsg({ ok: true, texto: `Repartidos en ${num} subgrupos al azar.` });
    } catch (e) {
      setMsg({ ok: false, texto: e instanceof ApiError ? e.message : 'No se pudo repartir' });
    } finally { setCargando(false); }
  }

  // Un fallo (permiso, red, validación) debe verse: si se tragara, el repintado
  // dejaría el estado anterior y parecería que la acción "se deshizo sola".
  async function asignar(enrollmentId: string, subgroupId: string) {
    setMsg(null);
    try {
      await api(`/api/courses/${courseId}/subgrupos/asignar`, {
        method: 'PATCH', auth: true, body: JSON.stringify({ enrollmentId, subgroupId: subgroupId || null }),
      });
    } catch (e) {
      setMsg({ ok: false, texto: e instanceof ApiError ? e.message : 'No se pudo asignar' });
    }
    cargar();
  }

  async function crearManual() {
    setMsg(null);
    const usados = new Set(subgrupos.map((s) => s.nombre));
    const libre = colores.find((c) => !usados.has(c.nombre));
    if (!libre) { setMsg({ ok: false, texto: 'Ya has usado todos los colores.' }); return; }
    try {
      await api(`/api/courses/${courseId}/subgrupos`, {
        method: 'POST', auth: true, body: JSON.stringify({ nombre: libre.nombre, color: libre.color }),
      });
    } catch (e) {
      setMsg({ ok: false, texto: e instanceof ApiError ? e.message : 'No se pudo crear el subgrupo' });
    }
    cargar();
  }

  async function borrar(id: string) {
    setMsg(null);
    try {
      await api(`/api/courses/${courseId}/subgrupos/${id}`, { method: 'DELETE', auth: true });
    } catch (e) {
      setMsg({ ok: false, texto: e instanceof ApiError ? e.message : 'No se pudo borrar' });
    }
    cargar();
  }

  async function exportar() {
    setMsg(null);
    try {
      await downloadFile(`/api/courses/${courseId}/pulsar/export`, 'curso-academia.json');
    } catch (e) {
      setMsg({ ok: false, texto: e instanceof ApiError ? e.message : 'No se pudo exportar' });
    }
  }

  const sinDoc = roster.filter((a) => a.sinDocumento);

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <div className="card-title">Subgrupos y práctica (PÚLSAR) <Ayuda tema="pulsar-subgrupos" /></div>
        <div className="card-subtitle">{roster.length} alumnos · {subgrupos.length} subgrupos</div>
      </div>

      {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`} style={{ fontSize: 13 }}>{msg.texto}</div>}

      {sinDoc.length > 0 && (
        <div className="alert alert-error" style={{ fontSize: 13 }}>
          {sinDoc.length} alumno(s) sin documento: {sinDoc.map((a) => a.nombre).join(', ')}. No podrás exportar el
          curso hasta que lo completen en su perfil.
        </div>
      )}

      {/* Reparto */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <label style={{ fontSize: 13 }}>Repartir al azar en</label>
        <input type="number" min={1} max={8} value={num} onChange={(e) => setNum(Number(e.target.value))}
          className="form-input" style={{ width: 64 }} />
        <span style={{ fontSize: 13 }}>subgrupos</span>
        <button className="btn btn-primary btn-small" onClick={repartir} disabled={cargando || roster.length === 0}>
          {cargando ? 'Repartiendo…' : 'Repartir'}
        </button>
        <span style={{ opacity: 0.4 }}>·</span>
        <button className="btn btn-outline btn-small" onClick={crearManual}>+ Subgrupo manual</button>
      </div>

      {/* Subgrupos actuales */}
      {subgrupos.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {subgrupos.map((s) => (
            <span key={s.id} className="badge" style={{
              background: s.color ?? 'var(--gray-300)', color: '#fff', display: 'inline-flex', gap: 6, alignItems: 'center',
            }}>
              {s.nombre} · {s.alumnos}
              <button onClick={() => borrar(s.id)} aria-label={`Borrar ${s.nombre}`}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* Asignación manual por alumno */}
      {subgrupos.length > 0 && (
        <div className="table-responsive" style={{ maxHeight: 300, marginBottom: 16 }}>
          <table className="table-plain">
            <thead><tr><th>Alumno</th><th>Subgrupo</th></tr></thead>
            <tbody>
              {roster.map((a) => (
                <tr key={a.enrollmentId}>
                  <td>{a.nombre}</td>
                  <td>
                    <select className="form-input" style={{ padding: '4px 8px', fontSize: 13 }}
                      value={a.subgroupId ?? ''} onChange={(e) => asignar(a.enrollmentId, e.target.value)}>
                      <option value="">— sin asignar —</option>
                      {subgrupos.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Puente PÚLSAR */}
      <div style={{ borderTop: '1px solid var(--gray-300)', paddingTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-small" onClick={exportar} disabled={roster.length === 0}>
          ⬇ Exportar para PÚLSAR
        </button>
        <ImportarPulsar courseId={courseId} onHecho={cargar} />
      </div>
    </div>
  );
}

/** Subir el resultados-pulsar.json: primero muestra qué hará, luego lo aplica. */
function ImportarPulsar({ courseId, onHecho }: { courseId: string; onHecho: () => void }) {
  const [preview, setPreview] = useState<{ casados: unknown[]; huerfanos: { documento: string; nombre: string }[]; cursoCorrecto: boolean; resumen: string } | null>(null);
  const [datos, setDatos] = useState<unknown>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setMsg(null);
    try {
      const json = JSON.parse(await file.text());
      setDatos(json);
      const r = await api<typeof preview>(`/api/courses/${courseId}/pulsar/import?preview=1`, {
        method: 'POST', auth: true, body: JSON.stringify(json),
      });
      setPreview(r);
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'El archivo no es un JSON válido de PÚLSAR');
    }
    e.target.value = '';
  }

  async function aplicar() {
    try {
      const r = await api<{ mensaje: string }>(`/api/courses/${courseId}/pulsar/import`, {
        method: 'POST', auth: true, body: JSON.stringify(datos),
      });
      setMsg(r.mensaje); setPreview(null); setDatos(null); onHecho();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'No se pudo importar');
    }
  }

  return (
    <>
      <label className="btn btn-outline btn-small" style={{ cursor: 'pointer', margin: 0 }}>
        ⬆ Importar resultados
        <input type="file" accept="application/json,.json" onChange={elegir} style={{ display: 'none' }} />
      </label>
      {msg && <div className="alert" style={{ fontSize: 13, width: '100%' }}>{msg}</div>}

      {preview && (
        <div className="modal-backdrop" onClick={() => setPreview(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Revisar antes de importar</h3>
            {!preview.cursoCorrecto && (
              <div className="alert alert-error" style={{ fontSize: 13 }}>
                Cuidado: el archivo dice pertenecer a otro curso. Comprueba que es el correcto.
              </div>
            )}
            <p style={{ fontSize: 14 }}>{preview.resumen}</p>
            {preview.huerfanos.length > 0 && (
              <div className="alert alert-error" style={{ fontSize: 12.5 }}>
                No se encuentran por documento (no se cargarán):{' '}
                {preview.huerfanos.map((h) => `${h.nombre || h.documento}`).join(', ')}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-primary btn-small" onClick={aplicar}>Importar</button>
              <button className="btn btn-outline btn-small" onClick={() => setPreview(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
