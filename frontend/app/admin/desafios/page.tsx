'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { api, ApiError, downloadFile } from '@/lib/api';

interface Challenge {
  id: string;
  title: string;
  area: string;
  num_questions: number;
  time_limit_seconds: number;
  kind: string;
  audience?: string;
  seconds_per_question?: number;
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
  const [secondsPerQuestion, setSecondsPerQuestion] = useState('20');
  const [audience, setAudience] = useState('todos');
  const [kind, setKind] = useState<'permanente' | 'temporal'>('temporal');
  const [banks, setBanks] = useState<Array<{ id: string; name: string; questions: string }>>([]);
  const [selBanks, setSelBanks] = useState<string[]>([]);
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
  useEffect(() => {
    if (!user) return;
    load();
    api<{ banks: Array<{ id: string; name: string; questions: string }> }>('/api/banks', { auth: true })
      .then((r) => setBanks(r.banks)).catch(() => {});
    // eslint-disable-next-line
  }, [user]);

  async function removeChallenge(c: Challenge) {
    if (!confirm(`¿Borrar el desafío «${c.title}» y todos sus intentos?`)) return;
    try { await api(`/api/admin/challenges/${c.id}`, { method: 'DELETE', auth: true }); load(); }
    catch (err) { setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Error' }); }
  }
  async function exportRanking(c: Challenge) {
    try { await downloadFile(`/api/admin/challenges/${c.id}/export`, `ranking-${c.title}.json`); } catch { /* ignore */ }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api('/api/admin/challenges', {
        method: 'POST', auth: true,
        body: JSON.stringify({
          title, area, audience, kind,
          numQuestions: Number(numQuestions),
          secondsPerQuestion: Number(secondsPerQuestion),
          bankIds: selBanks,
          startsAt: kind === 'temporal' ? (startsAt || undefined) : undefined,
          endsAt: kind === 'temporal' ? (endsAt || undefined) : undefined,
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
            <div className="card-title">Nuevo desafío</div>
            <div className="card-subtitle">Permanente o temporal, dirigido a un público concreto</div>
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
            {kind === 'temporal' && (
              <div className="grid grid-2" style={{ gap: 12 }}>
                <div className="form-group"><label className="form-label">Inicio</label><input className="form-input" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Fin</label><input className="form-input" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></div>
              </div>
            )}
            <div className="grid grid-2" style={{ gap: 10 }}>
              <div className="form-group">
                <label className="form-label">Público objetivo</label>
                <select className="form-select" value={audience} onChange={(e) => setAudience(e.target.value)}>
                  <option value="ninos">Niños (6-12)</option>
                  <option value="jovenes">Jóvenes (13-17)</option>
                  <option value="adultos">Adultos (+18)</option>
                  <option value="todos">Todos</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="form-select" value={kind} onChange={(e) => setKind(e.target.value as 'permanente' | 'temporal')}>
                  <option value="permanente">Permanente</option>
                  <option value="temporal">Temporal (con fechas)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Segundos por pregunta (ritmo)</label>
              <input className="form-input" type="number" min="5" max="120" value={secondsPerQuestion} onChange={(e) => setSecondsPerQuestion(e.target.value)} />
              <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Tiempo total: <strong>{Math.round((Number(numQuestions) || 0) * (Number(secondsPerQuestion) || 0))} s</strong>
                {' '}({Number(numQuestions) || 0} preguntas × {Number(secondsPerQuestion) || 0}s). Un desafío se juega rápido.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Bancos de preguntas</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {banks.map((b) => {
                  const on = selBanks.includes(b.id);
                  return (
                    <button key={b.id} type="button" className={`tab ${on ? 'active' : ''}`} style={{ flex: 'unset', padding: '6px 10px', fontSize: 12 }}
                      onClick={() => setSelBanks(on ? selBanks.filter((x) => x !== b.id) : [...selBanks, b.id])}>
                      {b.name} <span className="muted">({b.questions})</span>
                    </button>
                  );
                })}
              </div>
              <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Para población general: soporte vital básico, primeros auxilios y bancos generales (ética…). Si no eliges ninguno, se usa el área.
              </p>
            </div>

            <div className="info-box" style={{ fontSize: 12, marginBottom: 10 }}>
              Cada persona puede participar <strong>una sola vez</strong> en un desafío (el ranking mide conocimiento, no insistencia).
              Para entrenar sin límite está la <strong>práctica libre</strong> de su perfil.
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
                    <td>{c.title}<div className="muted" style={{ fontSize: 12 }}>
                      {c.area} · {c.num_questions}p × {c.seconds_per_question ?? '—'}s · {c.audience ?? 'todos'}
                    </div></td>
                    <td><span className={`badge ${c.kind === 'permanente' ? 'badge-primary' : 'badge-warning'}`}>{c.kind}</span></td>
                    <td>{c.participants}</td>
                    <td>
                      <div className="row-actions">
                        <Link className="link-action" href={`/desafios/${c.id}`}>Ver</Link>
                        <button className="link-action" onClick={() => exportRanking(c)} title="Descargar el ranking en JSON">Exportar</button>
                        <button className="link-action danger" onClick={() => removeChallenge(c)}>Borrar</button>
                      </div>
                    </td>
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
