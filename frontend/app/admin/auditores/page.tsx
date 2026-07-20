'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { PageNav } from '@/components/PageNav';
import { useSession } from '@/hooks/useSession';
import { adminNav } from '@/lib/nav';
import { api, ApiError } from '@/lib/api';

/**
 * Cuentas de auditoría para la comisión de formación continuada.
 *
 * Ven toda la plataforma en modo consulta, no pueden descargar nada ni
 * modificar, no obtienen calificaciones y no figuran en las actas porque no
 * son alumnado. Cada consulta suya queda registrada.
 */

interface Auditor {
  id: string; name: string; email: string; status: string; notes: string | null;
  access_expires_at: string | null; last_login_at: string | null; created_at: string; consultas: number;
}
interface Registro { action: string; metadata: { ruta?: string } | null; ip: string | null; created_at: string }

const VACIO = { name: '', email: '', password: '', notes: '', expiresAt: '' };

export default function AuditoresPage() {
  const user = useSession(['super_admin'], '/login/admin');
  const [items, setItems] = useState<Auditor[]>([]);
  const [form, setForm] = useState({ ...VACIO });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [verActividadDe, setVerActividadDe] = useState<Auditor | null>(null);
  const [actividad, setActividad] = useState<Registro[]>([]);

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
    setVerActividadDe(a);
    const r = await api<{ actividad: Registro[] }>(`/api/admin/auditores/${a.id}/actividad`, { auth: true });
    setActividad(r.actividad);
  }

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  return (
    <AppShell user={user} title="Acceso de la comisión" nav={adminNav(user.role, '/admin/auditores')}>
      <PageNav backHref="/admin" backLabel="Volver al panel" />

      {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Nueva cuenta de auditoría</div>
            <div className="card-subtitle">Para la comisión de formación continuada</div>
          </div>

          <div className="info-box" style={{ marginBottom: 16, fontSize: 13 }}>
            Esta cuenta <strong>ve toda la plataforma</strong> pero no puede modificar nada ni descargar
            documentos, no obtiene calificaciones y no figura en las actas. Cada consulta queda registrada.
          </div>

          <form onSubmit={crear}>
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
            <div className="form-group">
              <label className="form-label" htmlFor="a-pass">Contraseña</label>
              <input id="a-pass" className="form-input" required minLength={8} value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                La eliges tú y se la entregas. Podrás cambiarla cuando quieras.
              </p>
            </div>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="a-exp">Caduca el (opcional)</label>
                <input id="a-exp" type="date" className="form-input" value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="a-notes">Expediente</label>
                <input id="a-notes" className="form-input" value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Expediente 2026/014" />
              </div>
            </div>
            <button className="btn btn-primary btn-full">Crear cuenta</button>
          </form>

          <p className="muted" style={{ fontSize: 12.5, marginTop: 14 }}>
            <strong>Recomendación:</strong> crea una cuenta por persona de la comisión en lugar de una
            compartida. Con cuentas separadas el registro dice quién consultó qué y puedes revocar a uno sin
            dejar fuera a los demás; con una sola, el registro solo dirá «la comisión».
          </p>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Cuentas activas</div>
            <div className="card-subtitle">{items.length} creadas</div>
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
                      {a.access_expires_at && ` · caduca ${new Date(a.access_expires_at).toLocaleDateString('es-ES')}`}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {a.consultas} consulta{a.consultas === 1 ? '' : 's'}
                      {a.last_login_at && ` · último acceso ${new Date(a.last_login_at).toLocaleDateString('es-ES')}`}
                    </div>
                  </div>
                  <div className="row-actions" style={{ whiteSpace: 'nowrap' }}>
                    <button className="link-action" onClick={() => verActividad(a)}>Actividad</button>{' · '}
                    <button className="link-action" onClick={() => renombrar(a)}>Renombrar</button>{' · '}
                    <button className="link-action" onClick={() => cambiarClave(a)}>Contraseña</button>{' · '}
                    <button className="link-action" onClick={() => alternarBloqueo(a)}>
                      {a.status === 'blocked' ? 'Desbloquear' : 'Bloquear'}
                    </button>{' · '}
                    <button className="link-action danger" onClick={() => borrar(a)}>Borrar</button>
                  </div>
                </div>

                {verActividadDe?.id === a.id && (
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
      </div>
    </AppShell>
  );
}
