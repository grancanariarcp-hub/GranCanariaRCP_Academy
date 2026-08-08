'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { api, ApiError, downloadFile, uploadFile } from '@/lib/api';
import { adminNav } from '@/lib/nav';

interface Challenge {
  id: string;
  title: string;
  area: string;
  num_questions: number;
  time_limit_seconds: number;
  kind: string;
  audience?: string;
  seconds_per_question?: number;
  thumbnail_url?: string;
  starts_at: string | null;
  ends_at: string | null;
  /** Bancos de los que salen sus preguntas; necesario para poder editarlo. */
  bank_ids?: string[];
  participants: string;
}

export default function AdminDesafiosPage() {
  const user = useSession(['super_admin'], '/login');
  const [list, setList] = useState<Challenge[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  // Filtros del listado
  const [fArea, setFArea] = useState('');
  const [fKind, setFKind] = useState('');
  const [fAud, setFAud] = useState('');

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
  async function uploadThumb(c: Challenge, file: File | undefined) {
    if (!file) return;
    try { await uploadFile(`/api/admin/challenges/${c.id}/thumbnail`, file); load(); }
    catch (err) { setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Error al subir' }); }
  }
  async function exportRanking(c: Challenge) {
    try { await downloadFile(`/api/admin/challenges/${c.id}/export`, `ranking-${c.title}.json`); } catch { /* ignore */ }
  }

  /** Carga un desafío en el formulario para editarlo. */
  function startEdit(c: Challenge) {
    setEditandoId(c.id);
    setTitle(c.title);
    setArea(c.area ?? 'SVB');
    setAudience(c.audience ?? 'todos');
    setKind((c.kind as 'permanente' | 'temporal') ?? 'temporal');
    setNumQuestions(String(c.num_questions ?? 10));
    setSecondsPerQuestion(String(c.seconds_per_question ?? 20));
    setSelBanks(c.bank_ids ?? []);
    setStartsAt(c.starts_at ? String(c.starts_at).slice(0, 10) : '');
    setEndsAt(c.ends_at ? String(c.ends_at).slice(0, 10) : '');
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setEditandoId(null);
    setTitle(''); setArea('SVB'); setAudience('todos'); setKind('temporal');
    setNumQuestions('10'); setSecondsPerQuestion('20'); setSelBanks([]);
    setStartsAt(''); setEndsAt('');
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const cuerpo = {
      title, area, audience, kind,
      numQuestions: Number(numQuestions),
      secondsPerQuestion: Number(secondsPerQuestion),
      bankIds: selBanks,
      startsAt: kind === 'temporal' ? (startsAt || null) : null,
      endsAt: kind === 'temporal' ? (endsAt || null) : null,
    };
    try {
      if (editandoId) {
        await api(`/api/admin/challenges/${editandoId}`, { method: 'PATCH', auth: true, body: JSON.stringify(cuerpo) });
        setMsg({ ok: true, text: 'Desafío actualizado ✅' });
      } else {
        await api('/api/admin/challenges', { method: 'POST', auth: true, body: JSON.stringify(cuerpo) });
        setMsg({ ok: true, text: 'Desafío creado ✅' });
      }
      resetForm();
      load();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Error' });
    }
  }

  const listaFiltrada = list.filter((c) =>
    (!fArea || c.area === fArea) &&
    (!fKind || c.kind === fKind) &&
    (!fAud || (c.audience ?? 'todos') === fAud),
  );

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  return (
    <AppShell
      user={user}
      title="Desafíos"
      nav={adminNav(user.role, '/admin/desafios')}
    >
      <details className="card" style={{ marginBottom: 16 }} open={formOpen}
        onToggle={(e) => setFormOpen((e.target as HTMLDetailsElement).open)}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 16 }}>
          {editandoId ? '✏️ Editar desafío' : 'Nuevo desafío'}
          <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}> · permanente o temporal, para un público concreto</span>
        </summary>
        <div style={{ marginTop: 14 }}>
          {editandoId && <button type="button" className="btn btn-outline btn-small" style={{ marginBottom: 10 }} onClick={resetForm}>Cancelar edición</button>}
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

            <button className="btn btn-primary btn-full">{editandoId ? 'Guardar cambios' : 'Crear desafío'}</button>
          </form>
        </div>
      </details>

      <div className="card">
          <div className="card-header"><div className="card-title">Desafíos</div></div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <select className="form-select" style={{ width: 'auto', minWidth: 120 }} value={fArea} onChange={(e) => setFArea(e.target.value)}>
              <option value="">Área: todas</option>
              <option value="SVB">SVB</option>
              <option value="PA">Primeros auxilios</option>
              <option value="mixto">Mixto</option>
            </select>
            <select className="form-select" style={{ width: 'auto', minWidth: 120 }} value={fKind} onChange={(e) => setFKind(e.target.value)}>
              <option value="">Tipo: todos</option>
              <option value="permanente">Permanente</option>
              <option value="temporal">Temporal</option>
            </select>
            <select className="form-select" style={{ width: 'auto', minWidth: 130 }} value={fAud} onChange={(e) => setFAud(e.target.value)}>
              <option value="">Público: todos</option>
              <option value="ninos">Niños</option>
              <option value="jovenes">Jóvenes</option>
              <option value="adultos">Adultos</option>
              <option value="todos">Todos</option>
            </select>
            {(fArea || fKind || fAud) && <button type="button" className="link-action" onClick={() => { setFArea(''); setFKind(''); setFAud(''); }}>Limpiar</button>}
            <span className="muted" style={{ fontSize: 13, marginLeft: 'auto' }}>{listaFiltrada.length} de {list.length}</span>
          </div>
          <div className="table-responsive">
            <table>
              <thead><tr><th>Título</th><th>Preguntas</th><th>Tipo</th><th>Público</th><th>Participantes</th><th></th></tr></thead>
              <tbody>
                {listaFiltrada.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {c.thumbnail_url
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={c.thumbnail_url} alt="" style={{ width: 48, height: 32, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                          : <div style={{ width: 48, height: 32, borderRadius: 4, background: 'var(--gray-200)', flexShrink: 0 }} />}
                        <span>{c.title}</span>
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>
                      {c.area} · {c.seconds_per_question ?? '—'}s/pregunta
                    </div></td>
                    <td><strong>{c.num_questions}</strong> <span className="muted" style={{ fontSize: 12 }}>preg.</span></td>
                    <td><span className={`badge ${c.kind === 'permanente' ? 'badge-primary' : 'badge-warning'}`}>{c.kind}</span></td>
                    <td style={{ fontSize: 12 }}>{c.audience ?? 'todos'}</td>
                    <td>{c.participants}</td>
                    <td>
                      <div className="row-actions">
                        <Link className="link-action" href={`/desafios/${c.id}`}>Ver</Link>
                        <button className="link-action" onClick={() => startEdit(c)} title="Editar el desafío">Editar</button>
                        <label className="link-action" style={{ cursor: 'pointer' }} title="Subir o cambiar la miniatura">
                          Miniatura
                          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { uploadThumb(c, e.target.files?.[0]); e.target.value = ''; }} />
                        </label>
                        <button className="link-action" onClick={() => exportRanking(c)} title="Descargar el ranking en JSON">Exportar</button>
                        <button className="link-action danger" onClick={() => removeChallenge(c)}>Borrar</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {listaFiltrada.length === 0 && <tr><td colSpan={6} className="muted">{list.length === 0 ? 'Sin desafíos' : 'Ninguno coincide con el filtro'}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
    </AppShell>
  );
}
