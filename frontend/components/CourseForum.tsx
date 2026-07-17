'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

interface Thread { id: string; title: string; author_name: string; closed: boolean; created_at: string; updated_at: string; posts: string }
interface Post { id: string; author_id: string; author_type: string; author_name: string; body: string; created_at: string }

const fmt = (s: string) => new Date(s).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Foro por curso, reutilizable para alumnos y profesorado (mismos endpoints). */
export function CourseForum({ courseId }: { courseId: string }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [canModerate, setCanModerate] = useState(false);
  const [open, setOpen] = useState<{ thread: { id: string; title: string; closed: boolean }; posts: Post[]; me: { id: string; type: string } } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [reply, setReply] = useState('');

  async function loadThreads() {
    setError(null);
    try {
      const r = await api<{ threads: Thread[]; canModerate: boolean }>(`/api/forum/${courseId}/threads`, { auth: true });
      setThreads(r.threads); setCanModerate(r.canModerate);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Error al cargar el foro'); }
  }
  useEffect(() => { loadThreads(); /* eslint-disable-next-line */ }, [courseId]);

  async function openThread(id: string) {
    setError(null);
    try {
      setOpen(await api(`/api/forum/${courseId}/threads/${id}`, { auth: true }));
      setReply('');
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Error'); }
  }

  async function createThread() {
    if (title.trim().length < 3 || !body.trim()) return;
    try {
      await api(`/api/forum/${courseId}/threads`, { method: 'POST', auth: true, body: JSON.stringify({ title, body }) });
      setTitle(''); setBody(''); setShowNew(false); loadThreads();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Error'); }
  }

  async function sendReply() {
    if (!open || !reply.trim()) return;
    try {
      await api(`/api/forum/${courseId}/threads/${open.thread.id}/posts`, { method: 'POST', auth: true, body: JSON.stringify({ body: reply }) });
      openThread(open.thread.id);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Error'); }
  }

  async function toggleClose() {
    if (!open) return;
    try {
      await api(`/api/forum/${courseId}/threads/${open.thread.id}/close`, { method: 'PATCH', auth: true, body: JSON.stringify({ closed: !open.thread.closed }) });
      openThread(open.thread.id); loadThreads();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Error'); }
  }

  async function delPost(p: Post) {
    if (!open || !confirm('¿Borrar este mensaje?')) return;
    try {
      const r = await api<{ threadDeleted?: boolean }>(`/api/forum/${courseId}/posts/${p.id}`, { method: 'DELETE', auth: true });
      if (r.threadDeleted) { setOpen(null); loadThreads(); } else openThread(open.thread.id);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Error'); }
  }

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}

      {!open ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="card-title">💬 Foro del curso</div>
            <button className="btn btn-primary btn-small" onClick={() => setShowNew((v) => !v)}>{showNew ? 'Cancelar' : 'Nuevo hilo'}</button>
          </div>

          {showNew && (
            <div className="card" style={{ marginBottom: 12, background: 'var(--gray-50, #f7fafc)' }}>
              <div className="form-group"><label className="form-label">Título</label><input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} /></div>
              <div className="form-group"><label className="form-label">Mensaje</label><textarea className="form-input" style={{ height: 90, padding: 10 }} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} /></div>
              <button className="btn btn-primary btn-small" onClick={createThread} disabled={title.trim().length < 3 || !body.trim()}>Publicar</button>
            </div>
          )}

          {threads.length === 0 ? (
            <p className="muted" style={{ fontSize: 14 }}>Aún no hay hilos. ¡Abre el primero!</p>
          ) : (
            <div className="table-responsive">
              <table>
                <thead><tr><th>Hilo</th><th>Mensajes</th><th>Última actividad</th></tr></thead>
                <tbody>
                  {threads.map((t) => (
                    <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => openThread(t.id)}>
                      <td>{t.closed && '🔒 '}<strong>{t.title}</strong><div className="muted" style={{ fontSize: 12 }}>por {t.author_name}</div></td>
                      <td>{t.posts}</td>
                      <td style={{ fontSize: 12 }}>{fmt(t.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <button className="btn btn-outline btn-small" onClick={() => setOpen(null)}>← Volver</button>
            {canModerate && <button className="btn btn-outline btn-small" onClick={toggleClose}>{open.thread.closed ? 'Reabrir' : 'Cerrar'} hilo</button>}
          </div>
          <h3 style={{ marginBottom: 12 }}>{open.thread.closed && '🔒 '}{open.thread.title}</h3>

          {open.posts.map((p) => {
            const mine = p.author_id === open.me.id && p.author_type === open.me.type;
            return (
              <div className="card" key={p.id} style={{ marginBottom: 10, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <strong>{p.author_name}{p.author_type === 'user' && <span className="badge badge-primary" style={{ marginLeft: 6, fontSize: 10 }}>profesorado</span>}</strong>
                  <span className="muted">{fmt(p.created_at)}</span>
                </div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{p.body}</div>
                {(mine || canModerate) && <button className="btn btn-outline btn-small" style={{ marginTop: 8 }} onClick={() => delPost(p)}>Borrar</button>}
              </div>
            );
          })}

          {open.thread.closed && !canModerate ? (
            <p className="muted" style={{ fontSize: 13 }}>Este hilo está cerrado.</p>
          ) : (
            <div className="card" style={{ padding: 12 }}>
              <textarea className="form-input" style={{ height: 70, padding: 10 }} placeholder="Escribe una respuesta…" value={reply} onChange={(e) => setReply(e.target.value)} maxLength={5000} />
              <button className="btn btn-primary btn-small" style={{ marginTop: 8 }} onClick={sendReply} disabled={!reply.trim()}>Responder</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
