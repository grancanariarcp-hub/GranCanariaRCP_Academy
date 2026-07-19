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
      await api(`/api/admin/professors/${id}/${action}`, { method: 'POST', auth: true });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al actualizar');
    }
  }

  async function resetPassword(id: string, name: string) {
    if (!confirm(`¿Restablecer la contraseña de ${name}? Se generará una clave temporal de un solo uso.`)) return;
    try {
      const r = await api<{ tempPassword: string }>(`/api/admin/reset-password/user/${id}`, { method: 'POST', auth: true });
      setTempPw({ name, pw: r.tempPassword });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al restablecer');
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

  return (
    <AppShell
      user={user}
      title="Profesores"
      nav={adminNav(user.role, '/admin/profesores')}
    >
      {error && <div className="alert alert-error">{error}</div>}
      {pending > 0 && (
        <div className="info-box" style={{ marginBottom: 16 }}>
          Tienes <strong>{pending}</strong> profesor(es) pendiente(s) de validar.
        </div>
      )}

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Profesores</div>
            <div className="card-subtitle">{list.length} en total</div>
          </div>
          {tempPw && (
            <div className="alert alert-success">
              Clave temporal para <strong>{tempPw.name}</strong>: <code style={{ fontSize: 16, fontWeight: 700 }}>{tempPw.pw}</code>
              <div style={{ fontSize: 12, marginTop: 4 }}>Comunícasela; al entrar deberá definir su propia contraseña. No volverá a mostrarse.</div>
            </div>
          )}
          <div className="table-responsive">
            <table>
              <thead>
                <tr><th>Nombre</th><th>Estado</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.name}
                      <div className="muted" style={{ fontSize: 12 }}>
                        {p.headline || p.email}
                      </div>
                    </td>
                    <td><span className={`badge ${STATUS_BADGE[p.status]}`}>{STATUS_LABEL[p.status]}</span></td>
                    <td>
                      <div className="row-actions">
                        {p.status !== 'active' && (
                          <button className="link-action" onClick={() => setStatus(p.id, 'approve')}>Aprobar</button>
                        )}
                        {p.status !== 'rejected' && (
                          <button className="link-action" onClick={() => setStatus(p.id, 'reject')}>Rechazar</button>
                        )}
                        <button className="link-action" onClick={() => resetPassword(p.id, p.name)} title="Genera una clave temporal de un solo uso">Restablecer</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && <tr><td colSpan={3} className="muted">Aún no hay profesores</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Crear profesor directamente</div>
            <div className="card-subtitle">Queda activo sin validación</div>
          </div>
          {formMsg && <div className={`alert ${formMsg.ok ? 'alert-success' : 'alert-error'}`}>{formMsg.text}</div>}
          <form onSubmit={createProfessor}>
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
            <button className="btn btn-primary btn-full" disabled={creating}>
              {creating ? 'Creando…' : 'Crear profesor'}
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
