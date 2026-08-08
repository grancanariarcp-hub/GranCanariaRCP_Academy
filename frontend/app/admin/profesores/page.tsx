'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { api, ApiError } from '@/lib/api';
import { adminNav } from '@/lib/nav';

interface Professor {
  id: string;
  email: string;
  name: string;
  headline: string | null;
  status: 'pending' | 'active' | 'rejected';
  last_login_at: string | null;
  created_at: string;
}

const STATUS_BADGE: Record<Professor['status'], string> = {
  pending: 'badge-warning',
  active: 'badge-success',
  rejected: 'badge-danger',
};
const STATUS_LABEL: Record<Professor['status'], string> = {
  pending: 'Pendiente',
  active: 'Activo',
  rejected: 'Rechazado',
};

export default function ProfesoresPage() {
  const user = useSession(['super_admin'], '/login/admin');
  const [list, setList] = useState<Professor[]>([]);
  const [tempPw, setTempPw] = useState<{ name: string; pw: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filtros del listado
  const [q, setQ] = useState('');
  const [fEstado, setFEstado] = useState<'' | Professor['status']>('');

  // Ficha (modal)
  const [ficha, setFicha] = useState<Professor | null>(null);
  const [fichaMsg, setFichaMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  // create form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [headline, setHeadline] = useState('');
  const [creating, setCreating] = useState(false);
  const [formMsg, setFormMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    try {
      const r = await api<{ professors: Professor[] }>('/api/admin/professors', { auth: true });
      setList(r.professors);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error cargando profesores');
    }
  }
  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function setStatus(id: string, action: 'approve' | 'reject') {
    try {
      const r = await api<{ professor: Professor }>(`/api/admin/professors/${id}/${action}`, { method: 'POST', auth: true });
      setFicha((f) => (f && f.id === id ? { ...f, status: r.professor.status } : f));
      load();
    } catch (err) {
      setFichaMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Error al actualizar' });
    }
  }

  async function resetPassword(id: string, nombre: string) {
    if (!confirm(`¿Restablecer la contraseña de ${nombre}? Se generará una clave temporal de un solo uso.`)) return;
    try {
      const r = await api<{ tempPassword: string }>(`/api/admin/reset-password/user/${id}`, { method: 'POST', auth: true });
      setTempPw({ name: nombre, pw: r.tempPassword });
    } catch (err) {
      setFichaMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Error al restablecer' });
    }
  }

  async function guardarFicha(e: React.FormEvent) {
    e.preventDefault();
    if (!ficha) return;
    setFichaMsg(null);
    setGuardando(true);
    try {
      await api(`/api/admin/professors/${ficha.id}`, {
        method: 'PATCH', auth: true,
        body: JSON.stringify({ name: ficha.name, headline: ficha.headline ?? '' }),
      });
      setFichaMsg({ ok: true, text: 'Ficha guardada ✅' });
      load();
    } catch (err) {
      setFichaMsg({ ok: false, text: err instanceof ApiError ? err.message : 'No se pudo guardar' });
    } finally {
      setGuardando(false);
    }
  }

  async function createProfessor(e: React.FormEvent) {
    e.preventDefault();
    setFormMsg(null);
    setCreating(true);
    try {
      await api('/api/admin/professors', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ name, email, password, headline: headline || undefined }),
      });
      setFormMsg({ ok: true, text: 'Profesor creado y activo ✅' });
      setName(''); setEmail(''); setPassword(''); setHeadline('');
      load();
    } catch (err) {
      setFormMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Error al crear' });
    } finally {
      setCreating(false);
    }
  }

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  const pending = list.filter((p) => p.status === 'pending').length;
  const filtrados = list.filter((p) => {
    const t = q.trim().toLowerCase();
    const coincide = !t || p.name.toLowerCase().includes(t) || p.email.toLowerCase().includes(t) || (p.headline ?? '').toLowerCase().includes(t);
    return coincide && (!fEstado || p.status === fEstado);
  });

  return (
    <AppShell user={user} title="Profesores" nav={adminNav(user.role, '/admin/profesores')}>
      {error && <div className="alert alert-error">{error}</div>}
      {pending > 0 && (
        <div className="info-box" style={{ marginBottom: 16 }}>
          Tienes <strong>{pending}</strong> profesor(es) pendiente(s) de validar.
        </div>
      )}
      {tempPw && (
        <div className="alert alert-success">
          Clave temporal para <strong>{tempPw.name}</strong>: <code style={{ fontSize: 16, fontWeight: 700 }}>{tempPw.pw}</code>
          <div style={{ fontSize: 12, marginTop: 4 }}>Comunícasela; al entrar deberá definir su propia contraseña. No volverá a mostrarse.</div>
        </div>
      )}

      {/* Alta de profesor: plegada para no robar ancho al listado. */}
      <details className="card" style={{ marginBottom: 16 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 16 }}>
          Crear profesor directamente <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>· queda activo sin validación</span>
        </summary>
        <div style={{ marginTop: 14 }}>
          {formMsg && <div className={`alert ${formMsg.ok ? 'alert-success' : 'alert-error'}`}>{formMsg.text}</div>}
          <form onSubmit={createProfessor}>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Nombre y apellidos</label>
                <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Titulación / especialidad</label>
                <input className="form-input" placeholder="Ej.: Médico intensivista" value={headline} onChange={(e) => setHeadline(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Contraseña (mín. 8)</label>
                <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>
            <button className="btn btn-primary" disabled={creating}>
              {creating ? 'Creando…' : 'Crear profesor'}
            </button>
          </form>
        </div>
      </details>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Profesores</div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <input className="form-input" style={{ flex: 1, minWidth: 220 }} placeholder="Buscar por nombre, correo o titulación…"
            value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="form-select" style={{ width: 'auto', minWidth: 150 }} value={fEstado} onChange={(e) => setFEstado(e.target.value as '' | Professor['status'])}>
            <option value="">Estado: todos</option>
            <option value="pending">Pendiente</option>
            <option value="active">Activo</option>
            <option value="rejected">Rechazado</option>
          </select>
          <span className="muted" style={{ fontSize: 13 }}>{filtrados.length} de {list.length}</span>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr><th>Nombre</th><th>Estado</th><th>Último acceso</th><th></th></tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.id}>
                  <td>
                    <button className="link-action" style={{ fontWeight: 600 }} onClick={() => { setFicha(p); setFichaMsg(null); }} title="Abrir ficha">
                      {p.name}
                    </button>
                    <div className="muted" style={{ fontSize: 12 }}>{p.headline || p.email}</div>
                  </td>
                  <td><span className={`badge ${STATUS_BADGE[p.status]}`}>{STATUS_LABEL[p.status]}</span></td>
                  <td className="muted" style={{ fontSize: 12.5 }}>{p.last_login_at ? new Date(p.last_login_at).toLocaleDateString('es-ES') : '—'}</td>
                  <td>
                    <button className="btn btn-outline btn-small" onClick={() => { setFicha(p); setFichaMsg(null); }}>Ficha</button>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && <tr><td colSpan={4} className="empty-state">{list.length === 0 ? 'Aún no hay profesores.' : 'Nadie coincide con el filtro.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ficha del profesor */}
      {ficha && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setFicha(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="card-header" style={{ marginBottom: 10 }}>
              <div className="card-title">Ficha de {ficha.name}</div>
            </div>

            <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              {ficha.email} · alta {new Date(ficha.created_at).toLocaleDateString('es-ES')} ·{' '}
              último acceso {ficha.last_login_at ? new Date(ficha.last_login_at).toLocaleDateString('es-ES') : 'nunca'}
              {' · '}<span className={`badge ${STATUS_BADGE[ficha.status]}`}>{STATUS_LABEL[ficha.status]}</span>
            </div>

            {fichaMsg && <div className={`alert ${fichaMsg.ok ? 'alert-success' : 'alert-error'}`}>{fichaMsg.text}</div>}

            <form onSubmit={guardarFicha}>
              <div className="form-group">
                <label className="form-label">Nombre y apellidos</label>
                <input className="form-input" value={ficha.name} onChange={(e) => setFicha({ ...ficha, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Titulación / especialidad</label>
                <input className="form-input" value={ficha.headline ?? ''} onChange={(e) => setFicha({ ...ficha, headline: e.target.value })} placeholder="Ej.: Médico intensivista" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary btn-small" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar datos'}</button>
              </div>
            </form>

            {/* Permisos de acceso + credenciales */}
            <div style={{ borderTop: '1px solid var(--gray-200)', marginTop: 14, paddingTop: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Permisos y acceso</div>
              <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>
                Un profesor <strong>activo</strong> puede entrar, crear cursos y ser invitado a impartir. Si lo
                rechazas, pierde el acceso pero su cuenta y su material se conservan.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ficha.status !== 'active' && (
                  <button className="btn btn-primary btn-small" onClick={() => setStatus(ficha.id, 'approve')}>Dar acceso (activar)</button>
                )}
                {ficha.status !== 'rejected' && (
                  <button className="btn btn-outline btn-small" onClick={() => setStatus(ficha.id, 'reject')}>Retirar acceso (rechazar)</button>
                )}
                <button className="btn btn-outline btn-small" onClick={() => resetPassword(ficha.id, ficha.name)} title="Genera una clave temporal de un solo uso">
                  Restablecer contraseña
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button type="button" className="btn btn-outline" onClick={() => setFicha(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
