'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { api, ApiError } from '@/lib/api';

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
      nav={[
        { label: 'Resumen', href: '/admin' },
        { label: 'Cursos', href: '/admin/cursos' },
        { label: 'Preguntas', href: '/admin/preguntas' },
        { label: 'Documentos', href: '/admin/documentos' },
        { label: 'Profesores', href: '/admin/profesores', active: true },
      ]}
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
                      {p.status !== 'active' && (
                        <button className="btn btn-primary btn-small" onClick={() => setStatus(p.id, 'approve')}>
                          Aprobar
                        </button>
                      )}{' '}
                      {p.status !== 'rejected' && (
                        <button className="btn btn-outline btn-small" onClick={() => setStatus(p.id, 'reject')}>
                          Rechazar
                        </button>
                      )}
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
