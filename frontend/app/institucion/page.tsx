'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { api, ApiError } from '@/lib/api';

interface Institution { id: string; name: string; code: string; status: string; contact_email: string | null; contact_name: string | null; contact_phone: string | null; address: string | null }
interface Teacher { id: string; name: string; email: string; is_active: boolean }

export default function InstitucionPage() {
  const user = useSession(['institution_admin'], '/login');
  const [inst, setInst] = useState<Institution | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    try {
      const r = await api<{ institution: Institution; teachers: Teacher[] }>('/api/institution/me', { auth: true });
      setInst(r.institution); setTeachers(r.teachers);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    }
  }
  useEffect(() => { if (user) load(); /* eslint-disable-next-line */ }, [user]);

  async function addTeacher(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api('/api/institution/teachers', { method: 'POST', auth: true, body: JSON.stringify({ name, email, password }) });
      setMsg({ ok: true, text: 'Maestro dado de alta ✅' });
      setName(''); setEmail(''); setPassword('');
      load();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Error' });
    }
  }
  async function removeTeacher(id: string) {
    if (!confirm('¿Quitar este maestro?')) return;
    try { await api(`/api/institution/teachers/${id}`, { method: 'DELETE', auth: true }); load(); } catch { /* ignore */ }
  }

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  const active = inst?.status === 'active';

  return (
    <AppShell user={user} title={inst?.name ?? 'Mi institución'} nav={[{ label: 'Institución', href: '/institucion', active: true }]}>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card animate-in" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">{inst?.name}</div>
          <div className="card-subtitle">
            {inst && <span className={`badge ${active ? 'badge-success' : inst.status === 'pending' ? 'badge-warning' : 'badge-danger'}`}>{active ? 'activa' : inst.status === 'pending' ? 'pendiente de validación' : 'rechazada'}</span>}
          </div>
        </div>
        {inst && (
          <div className="muted" style={{ fontSize: 13 }}>
            Código: <strong>{inst.code}</strong>
            {inst.contact_name ? ` · Contacto: ${inst.contact_name}` : ''}
            {inst.contact_phone ? ` · ${inst.contact_phone}` : ''}
          </div>
        )}
        {!active && inst?.status === 'pending' && (
          <div className="info-box" style={{ marginTop: 12 }}>Tu institución está <strong>pendiente de validación</strong>. En cuanto la aprobemos podrás dar de alta maestros y crear clases.</div>
        )}
      </div>

      {active && (
        <div className="grid grid-2">
          {/* Maestros */}
          <div className="card animate-in">
            <div className="card-header">
              <div className="card-title">Maestros</div>
              <div className="card-subtitle">{teachers.length} · crean clases de menores</div>
            </div>
            <div className="table-responsive">
              <table>
                <thead><tr><th>Nombre</th><th>Email</th><th></th></tr></thead>
                <tbody>
                  {teachers.map((t) => (
                    <tr key={t.id}>
                      <td>{t.name}</td>
                      <td style={{ fontSize: 13 }}>{t.email}</td>
                      <td><button className="btn btn-outline btn-small" onClick={() => removeTeacher(t.id)}>Quitar</button></td>
                    </tr>
                  ))}
                  {teachers.length === 0 && <tr><td colSpan={3} className="muted">Aún no hay maestros</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Alta de maestro */}
          <div className="card animate-in">
            <div className="card-header">
              <div className="card-title">Dar de alta un maestro</div>
              <div className="card-subtitle">No necesita ser sanitario</div>
            </div>
            {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}
            <form onSubmit={addTeacher}>
              <div className="form-group"><label className="form-label">Nombre</label><input className="form-input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
              <div className="form-group"><label className="form-label">Email (su acceso)</label><input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              <div className="form-group"><label className="form-label">Contraseña (mín. 8)</label><input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
              <button className="btn btn-primary btn-full">Dar de alta maestro</button>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
