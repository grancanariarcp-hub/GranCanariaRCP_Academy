'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { api, ApiError } from '@/lib/api';

interface Clase { id: string; name: string; expected_students: number | null; codes: string; activos: string; created_at: string }

export default function MaestroPage() {
  const user = useSession(['institution_teacher'], '/login');
  const [classes, setClasses] = useState<Clase[]>([]);
  const [name, setName] = useState('');
  const [expected, setExpected] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    try { setClasses((await api<{ classes: Clase[] }>('/api/maestro/classes', { auth: true })).classes); } catch { /* ignore */ }
  }
  useEffect(() => { if (user) load(); /* eslint-disable-next-line */ }, [user]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api('/api/maestro/classes', { method: 'POST', auth: true, body: JSON.stringify({ name, expectedStudents: expected ? Number(expected) : undefined }) });
      setName(''); setExpected(''); setMsg({ ok: true, text: 'Clase creada ✅' });
      load();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Error' });
    }
  }

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  return (
    <AppShell user={user} title="Mis clases" nav={[{ label: 'Mis clases', href: '/maestro', active: true }]}>
      <div className="grid grid-2">
        <div className="card animate-in">
          <div className="card-header"><div className="card-title">Nueva clase</div><div className="card-subtitle">Genera códigos para tus alumnos menores</div></div>
          {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}
          <form onSubmit={create}>
            <div className="form-group"><label className="form-label">Nombre de la clase</label><input className="form-input" placeholder="Ej.: 5º B" value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <div className="form-group"><label className="form-label">Nº de alumnos (opcional)</label><input className="form-input" type="number" min="1" value={expected} onChange={(e) => setExpected(e.target.value)} /></div>
            <button className="btn btn-primary btn-full">Crear clase</button>
          </form>
        </div>

        <div className="card animate-in">
          <div className="card-header"><div className="card-title">Clases</div><div className="card-subtitle">{classes.length}</div></div>
          {classes.length === 0 ? (
            <div className="muted">Aún no tienes clases. Crea la primera.</div>
          ) : (
            <div className="table-responsive">
              <table>
                <thead><tr><th>Clase</th><th>Códigos</th><th>Activos</th><th></th></tr></thead>
                <tbody>
                  {classes.map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.name}</strong>{c.expected_students ? <div className="muted" style={{ fontSize: 12 }}>previstos: {c.expected_students}</div> : null}</td>
                      <td>{c.codes}</td>
                      <td>{c.activos}</td>
                      <td><Link className="btn btn-outline btn-small" href={`/maestro/clase/${c.id}`}>Abrir</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
