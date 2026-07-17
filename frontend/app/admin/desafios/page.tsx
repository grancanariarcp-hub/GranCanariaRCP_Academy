'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { api, ApiError } from '@/lib/api';

interface Challenge {
  id: string;
  title: string;
  area: string;
  num_questions: number;
  time_limit_seconds: number;
  kind: string;
  starts_at: string | null;
  ends_at: string | null;
  participants: string;
}

export default function AdminDesafiosPage() {
  const user = useSession(['super_admin'], '/login');
  const [list, setList] = useState<Challenge[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [title, setTitle] = useState('');
  const [area, setArea] = useState('SVB');
  const [numQuestions, setNumQuestions] = useState('10');
  const [minutes, setMinutes] = useState('5');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  async function load() {
    try {
      const r = await api<{ challenges: Challenge[] }>('/api/admin/challenges', { auth: true });
      setList(r.challenges);
    } catch {
      /* ignore */
    }
  }
  useEffect(() => { if (user) load(); /* eslint-disable-next-line */ }, [user]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api('/api/admin/challenges', {
        method: 'POST', auth: true,
        body: JSON.stringify({
          title, area, numQuestions: Number(numQuestions),
          timeLimitSeconds: Math.round(Number(minutes) * 60),
          startsAt: startsAt || undefined, endsAt: endsAt || undefined,
        }),
      });
      setMsg({ ok: true, text: 'Desafío creado ✅' });
      setTitle(''); setStartsAt(''); setEndsAt('');
      load();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Error' });
    }
  }

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  return (
    <AppShell
      user={user}
      title="Desafíos"
      nav={[
        { label: 'Resumen', href: '/admin' },
        { label: 'Cursos', href: '/admin/cursos' },
        { label: 'Preguntas', href: '/admin/preguntas' },
        { label: 'Bancos', href: '/admin/bancos' },
        { label: 'Desafíos', href: '/admin/desafios', active: true },
        { label: 'Profesores', href: '/admin/profesores' },
      ]}
    >
      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Nuevo desafío (temporal)</div>
            <div className="card-subtitle">El permanente ya existe (10 preguntas / 5 min)</div>
          </div>
          {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}
          <form onSubmit={create}>
            <div className="form-group"><label className="form-label">Título</label><input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Área</label>
                <select className="form-select" value={area} onChange={(e) => setArea(e.target.value)}>
                  <option value="SVB">SVB</option>
                  <option value="PA">Primeros auxilios</option>
                  <option value="mixto">Mixto</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">Nº preguntas</label><input className="form-input" type="number" min="1" value={numQuestions} onChange={(e) => setNumQuestions(e.target.value)} /></div>
            </div>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="form-group"><label className="form-label">Minutos</label><input className="form-input" type="number" min="1" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></div>
              <div />
            </div>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="form-group"><label className="form-label">Inicio</label><input className="form-input" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Fin</label><input className="form-input" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></div>
            </div>
            <button className="btn btn-primary btn-full">Crear desafío</button>
          </form>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Desafíos</div><div className="card-subtitle">{list.length}</div></div>
          <div className="table-responsive">
            <table>
              <thead><tr><th>Título</th><th>Tipo</th><th>Participantes</th><th></th></tr></thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id}>
                    <td>{c.title}<div className="muted" style={{ fontSize: 12 }}>{c.area} · {c.num_questions}p · {Math.round(c.time_limit_seconds / 60)}min</div></td>
                    <td><span className={`badge ${c.kind === 'permanente' ? 'badge-primary' : 'badge-warning'}`}>{c.kind}</span></td>
                    <td>{c.participants}</td>
                    <td><Link className="btn btn-outline btn-small" href={`/desafios/${c.id}`}>Ver</Link></td>
                  </tr>
                ))}
                {list.length === 0 && <tr><td colSpan={4} className="muted">Sin desafíos</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
