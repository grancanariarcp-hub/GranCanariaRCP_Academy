'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useSession } from '@/hooks/useSession';
import { adminNav } from '@/lib/nav';
import { api, ApiError } from '@/lib/api';

/**
 * Cuentas de auditoría para la comisión de formación continuada.
 *
 * Ven toda la plataforma en modo consulta, no pueden descargar nada ni
 * modificar, no obtienen calificaciones y no figuran en las actas porque no
 * son alumnado. Cada consulta suya queda registrada. Además se les puede
 * vincular a los cursos concretos que evalúan para otorgar los CFC, con la
 * ventana de fechas de esa evaluación.
 */

interface Auditor {
  id: string; name: string; email: string; status: string; notes: string | null;
  access_expires_at: string | null; last_login_at: string | null; created_at: string; consultas: number;
}
interface Registro { action: string; metadata: { ruta?: string } | null; ip: string | null; created_at: string }
interface CursoCFC { id: string; title: string; codigo_curso: string | null; starts_at: string | null; ends_at: string | null }

const VACIO = { name: '', email: '', password: '', notes: '', expiresAt: '' };

export default function AuditoresPage() {
  const user = useSession(['super_admin'], '/login/admin');
  const [items, setItems] = useState<Auditor[]>([]);
  const [form, setForm] = useState({ ...VACIO });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [verActividadDe, setVerActividadDe] = useState<string | null>(null);
  const [actividad, setActividad] = useState<Registro[]>([]);
  // Cursos CFC de cada auditor
  const [verCursosDe, setVerCursosDe] = useState<string | null>(null);
  const [cursos, setCursos] = useState<CursoCFC[]>([]);
  const [nuevoCodigo, setNuevoCodigo] = useState('');
  const [cursoMsg, setCursoMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const cargar = useCallback(async () => {
    try {
      setItems((await api<{ auditores: Auditor[] }>('/api/admin/auditores', { auth: true })).auditores);
    } catch { /* la pantalla avisa al guardar */ }
  }, []);

  useEffect(() => { if (user) cargar(); }, [user, cargar]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api('/api/admin/auditores', {
        method: 'POST', auth: true,
        body: JSON.stringify({
          name: form.name, email: form.email, password: form.password,
          notes: form.notes || undefined, expiresAt: form.expiresAt || null,
        }),
      });
      setMsg({ ok: true, text: `✅ Cuenta creada. Entrega estas credenciales: ${form.email} / ${form.password}` });
      setForm({ ...VACIO });
      cargar();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'No se pudo crear' });
    }
  }

  async function alternarBloqueo(a: Auditor) {
    await api(`/api/admin/auditores/${a.id}`, {
      method: 'PATCH', auth: true,
      body: JSON.stringify({ status: a.status === 'blocked' ? 'active' : 'blocked' }),
    });
    cargar();
  }

  async function cambiarClave(a: Auditor) {
    const nueva = prompt(`Nueva contraseña para «${a.name}» (mínimo 8 caracteres):`);
    if (!nueva) return;
    try {
      await api(`/api/admin/auditores/${a.id}`, { method: 'PATCH', auth: true, body: JSON.stringify({ password: nueva }) });
      setMsg({ ok: true, text: `✅ Contraseña cambiada. Entrégala: ${a.email} / ${nueva}` });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'No se pudo cambiar' });
    }
  }

  async function renombrar(a: Auditor) {
    const nombre = prompt('Nuevo nombre:', a.name);
    if (!nombre) return;
    await api(`/api/admin/auditores/${a.id}`, { method: 'PATCH', auth: true, body: JSON.stringify({ name: nombre }) });
    cargar();
  }

  async function borrar(a: Auditor) {
    if (!confirm(`¿Eliminar la cuenta de «${a.name}»? Su registro de auditoría se conserva.`)) return;
    await api(`/api/admin/auditores/${a.id}`, { method: 'DELETE', auth: true });
    cargar();
  }

  async function verActividad(a: Auditor) {
    if (verActividadDe === a.id) { setVerActividadDe(null); return; }
    setVerActividadDe(a.id);
    const r = await api<{ actividad: Registro[] }>(`/api/admin/auditores/${a.id}/actividad`, { auth: true });
    setActividad(r.actividad);
  }

  async function verCursos(a: Auditor) {
    if (verCursosDe === a.id) { setVerCursosDe(null); return; }
    setVerCursosDe(a.id);
    setNuevoCodigo(''); setCursoMsg(null);
    const r = await api<{ cursos: CursoCFC[] }>(`/api/admin/auditores/${a.id}/cursos`, { auth: true });
    setCursos(r.cursos);
  }

  async function vincularCurso(a: Auditor) {
    if (!nuevoCodigo.trim()) return;
    setCursoMsg(null);
    try {
      await api(`/api/admin/auditores/${a.id}/cursos`, {
        method: 'POST', auth: true, body: JSON.stringify({ codigo: nuevoCodigo.trim() }),
      });
      setNuevoCodigo('');
      const r = await api<{ cursos: CursoCFC[] }>(`/api/admin/auditores/${a.id}/cursos`, { auth: true });
      setCursos(r.cursos);
      setCursoMsg({ ok: true, text: 'Curso vinculado con sus fechas ✅' });
    } catch (err) {
      setCursoMsg({ ok: false, text: err instanceof ApiError ? err.message : 'No se pudo vincular' });
    }
  }

  async function desvincular(a: Auditor, courseId: string) {
    await api(`/api/admin/auditores/${a.id}/cursos/${courseId}`, { method: 'DELETE', auth: true });
    setCursos((cs) => cs.filter((c) => c.id !== courseId));
  }

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  const fecha = (d: string | null) => (d ? new Date(d).toLocaleDateString('es-ES') : '—');

  return (
    <AppShell user={user} title="Comisión CFC" nav={adminNav(user.role, '/admin/auditores')}>
      {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}

      {/* Alta de cuenta: plegada para dejar el listado a ancho completo. */}
      <details className="card" style={{ marginBottom: 16 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 16 }}>
          Nueva cuenta de auditoría <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>· para la comisión de formación continuada</span>
        </summary>
        <div style={{ marginTop: 14 }}>
          <div className="info-box" style={{ marginBottom: 16, fontSize: 13 }}>
            Esta cuenta <strong>ve toda la plataforma</strong> pero no puede modificar nada ni descargar
            documentos, no obtiene calificaciones y no figura en las actas. Cada consulta queda registrada.
          </div>

          <form onSubmit={crear}>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="a-name">Nombre</label>
                <input id="a-name" className="form-input" required value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Comisión de Formación Continuada de Canarias" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="a-email">Email (será su usuario)</label>
                <input id="a-email" type="email" className="form-input" required value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="a-pass">Contraseña</label>
                <input id="a-pass" className="form-input" required minLength={8} value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="a-exp">Caduca el (opcional)</label>
                <input id="a-exp" type="date" className="form-input" value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="a-notes">Expediente</label>
              <input id="a-notes" className="form-input" value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Expediente 2026/014" />
            </div>
            <button className="btn btn-primary">Crear cuenta</button>
          </form>

          <p className="muted" style={{ fontSize: 12.5, marginTop: 14 }}>
            <strong>Recomendación:</strong> crea una cuenta por persona de la comisión en lugar de una
            compartida. Con cuentas separadas el registro dice quién consultó qué y puedes revocar a uno sin
            dejar fuera a los demás; con una sola, el registro solo dirá «la comisión».
          </p>
        </div>
      </details>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Cuentas de la comisión</div>
        </div>

        {items.length === 0 ? (
          <p className="muted">Aún no hay cuentas de auditoría.</p>
        ) : items.map((a) => {
          const caducada = a.access_expires_at && new Date(a.access_expires_at) < new Date();
          return (
            <div key={a.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--gray-100)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <strong>{a.name}</strong>
                  {a.status === 'blocked' && <span className="badge badge-warning" style={{ marginLeft: 6 }}>bloqueada</span>}
                  {caducada && <span className="badge badge-warning" style={{ marginLeft: 6 }}>caducada</span>}
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    {a.email}
                    {a.notes && ` · ${a.notes}`}
                    {a.access_expires_at && ` · caduca ${fecha(a.access_expires_at)}`}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {a.consultas} consulta{a.consultas === 1 ? '' : 's'}
                    {a.last_login_at && ` · último acceso ${fecha(a.last_login_at)}`}
                  </div>
                </div>
                <div className="row-actions" style={{ whiteSpace: 'nowrap' }}>
                  <button className="link-action" onClick={() => verCursos(a)}>Cursos CFC</button>{' · '}
                  <button className="link-action" onClick={() => verActividad(a)}>Actividad</button>{' · '}
                  <button className="link-action" onClick={() => renombrar(a)}>Renombrar</button>{' · '}
                  <button className="link-action" onClick={() => cambiarClave(a)}>Contraseña</button>{' · '}
                  <button className="link-action" onClick={() => alternarBloqueo(a)}>
                    {a.status === 'blocked' ? 'Desbloquear' : 'Bloquear'}
                  </button>{' · '}
                  <button className="link-action danger" onClick={() => borrar(a)}>Borrar</button>
                </div>
              </div>

              {/* Cursos que evalúa para los CFC */}
              {verCursosDe === a.id && (
                <div style={{ marginTop: 10, padding: 12, background: 'var(--gray-50)', borderRadius: 10, border: '1px solid var(--gray-200)' }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>Cursos que evalúa para los CFC</div>
                  {cursoMsg && <div className={`alert ${cursoMsg.ok ? 'alert-success' : 'alert-error'}`} style={{ fontSize: 13 }}>{cursoMsg.text}</div>}

                  {cursos.length === 0 ? (
                    <p className="muted" style={{ fontSize: 13, margin: '0 0 10px' }}>Todavía no evalúa ningún curso.</p>
                  ) : (
                    <div className="table-responsive" style={{ marginBottom: 10 }}>
                      <table className="table-plain">
                        <thead><tr><th>Código</th><th>Curso</th><th>Desde</th><th>Hasta</th><th></th></tr></thead>
                        <tbody>
                          {cursos.map((c) => (
                            <tr key={c.id}>
                              <td><code style={{ fontSize: 12 }}>{c.codigo_curso ?? '—'}</code></td>
                              <td style={{ fontSize: 13 }}>{c.title}</td>
                              <td style={{ fontSize: 12.5 }}>{fecha(c.starts_at)}</td>
                              <td style={{ fontSize: 12.5 }}>{fecha(c.ends_at)}</td>
                              <td><button className="link-action danger" onClick={() => desvincular(a, c.id)}>Quitar</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input className="form-input" style={{ width: 'auto', minWidth: 200 }}
                      placeholder="Código del curso (ej. SVA-ONL-2026-01)"
                      value={nuevoCodigo} onChange={(e) => setNuevoCodigo(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); vincularCurso(a); } }} />
                    <button className="btn btn-primary btn-small" onClick={() => vincularCurso(a)}>Vincular curso</button>
                    <span className="muted" style={{ fontSize: 12 }}>La ventana de evaluación toma por defecto las fechas del curso.</span>
                  </div>
                </div>
              )}

              {verActividadDe === a.id && (
                <div style={{ marginTop: 10, padding: 12, background: 'var(--gray-100)', borderRadius: 10, maxHeight: 300, overflowY: 'auto' }}>
                  {actividad.length === 0 ? (
                    <p className="muted" style={{ margin: 0, fontSize: 13 }}>Sin actividad registrada.</p>
                  ) : actividad.map((r, i) => (
                    <div key={i} style={{ fontSize: 12.5, padding: '3px 0', borderBottom: '1px solid var(--gray-200)' }}>
                      <span className="muted">{new Date(r.created_at).toLocaleString('es-ES')}</span>{' · '}
                      <strong>{r.action === 'AUDITOR_VIEW' ? 'Consultó' : r.action}</strong>{' '}
                      <code style={{ fontSize: 11.5 }}>{r.metadata?.ruta ?? ''}</code>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
