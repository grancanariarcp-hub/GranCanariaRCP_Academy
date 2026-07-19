'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { CourseForum } from '@/components/CourseForum';
import { TimeTracker } from '@/components/TimeTracker';
import { CourseSurvey } from '@/components/CourseSurvey';
import { api, ApiError, downloadFile } from '@/lib/api';

interface Activity {
  id: string;
  completed?: boolean;
  type: 'documento' | 'video' | 'enlace' | 'test' | 'examen' | 'texto' | 'imagen';
  title: string;
  url: string | null;
  body: string | null;
  image_url?: string;
  document_title: string | null;
  exam_id: string | null;
}
interface Module {
  id: string;
  title: string;
  activities: Activity[];
}
interface Course {
  id: string;
  title: string;
  tema: string | null;
  subtema: string | null;
  objetivo_general: string | null;
}

const TYPE_ICON: Record<string, string> = { documento: '📄', video: '🎬', enlace: '🔗', test: '📝', examen: '🎓', texto: '📝', imagen: '🖼️' };

export default function StudentCoursePage() {
  const params = useParams();
  const courseId = params.id as string;
  const user = useSession(['student'], '/login/student');
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [certAvailable, setCertAvailable] = useState(false);
  const [progress, setProgress] = useState<{ total: number; completed: number; pct: number } | null>(null);
  const [time, setTime] = useState<{ activeHours: number; sessionHours: number; focusPct: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api<{ course: Course; modules: Module[]; certificateAvailable: boolean; progress: { total: number; completed: number; pct: number } }>(`/api/student/courses/${courseId}`, { auth: true })
      .then((r) => { setCourse(r.course); setModules(r.modules); setCertAvailable(r.certificateAvailable); setProgress(r.progress); })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error cargando el curso'));
    api<{ activeHours: number; sessionHours: number; focusPct: number | null }>(`/api/profile/time?courseId=${courseId}`, { auth: true })
      .then(setTime).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function reload() {
    const r = await api<{ course: Course; modules: Module[]; certificateAvailable: boolean; progress: { total: number; completed: number; pct: number } }>(`/api/student/courses/${courseId}`, { auth: true });
    setModules(r.modules); setCertAvailable(r.certificateAvailable); setProgress(r.progress);
  }

  async function toggleDone(a: Activity) {
    try {
      await api(`/api/student/courses/${courseId}/activities/${a.id}/complete`, {
        method: 'POST', auth: true, body: JSON.stringify({ completed: !a.completed }),
      });
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    }
  }

  async function downloadCertificate() {
    try {
      await downloadFile(`/api/student/courses/${courseId}/certificate`, 'certificado-grancanaria-rcp.pdf');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al generar el certificado');
    }
  }

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  return (
    <AppShell user={user} title={course?.title ?? 'Curso'} nav={[{ label: 'Inicio', href: '/student', active: true }]}>
      <TimeTracker courseId={courseId} />
      <p style={{ marginBottom: 16 }}><Link href="/student">← Volver a mis cursos</Link></p>
      {error && <div className="alert alert-error">{error}</div>}

      {certAvailable && (
        <div className="card" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span>🎉 <strong>¡Has aprobado!</strong> Ya puedes descargar tu certificado.</span>
          <button className="btn btn-primary" onClick={downloadCertificate}>📄 Descargar certificado</button>
        </div>
      )}

      {progress && progress.total > 0 && (
        <div className="card animate-in" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <strong>Tu avance en el curso</strong>
            <span className="muted">
              {progress.completed} de {progress.total} actividades · <strong>{progress.pct}%</strong>
              {time && time.activeHours > 0 && <> · <strong>{time.activeHours} h</strong> de estudio</>}
            </span>
          </div>
          <div style={{ height: 12, background: 'var(--gray-200)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${progress.pct}%`, height: '100%', background: 'linear-gradient(90deg,#2c5282,#22c55e)', transition: 'width .5s ease' }} />
          </div>
        </div>
      )}

      {course?.objetivo_general && (
        <div className="info-box" style={{ marginBottom: 24 }}>{course.objetivo_general}</div>
      )}

      {modules.map((m) => (
        <div className="card" key={m.id} style={{ marginBottom: 16 }}>
          <div className="card-header"><div className="card-title">{m.title}</div></div>
          {m.activities.length === 0 ? (
            <div className="muted">Este módulo aún no tiene contenido.</div>
          ) : (
            m.activities.map((a) => (
              <div key={a.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--gray-200)', opacity: a.completed ? 0.75 : 1 }}>
                {a.type === 'texto' ? (
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{TYPE_ICON.texto} {a.title}</div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{a.body}</div>
                  </div>
                ) : a.type === 'imagen' ? (
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>{TYPE_ICON.imagen} {a.title}</div>
                    {a.image_url && <img src={a.image_url} alt={a.title} style={{ maxWidth: '100%', borderRadius: 8 }} />}
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{TYPE_ICON[a.type]} {a.title}{a.document_title ? ` — ${a.document_title}` : ''}</span>
                    {(a.type === 'video' || a.type === 'enlace') && a.url ? (
                      <a className="btn btn-primary btn-small" href={a.url} target="_blank" rel="noreferrer">Abrir</a>
                    ) : a.type === 'documento' ? (
                      <span className="badge badge-primary">Documento</span>
                    ) : (a.type === 'test' || a.type === 'examen') && a.exam_id ? (
                      <Link className="btn btn-primary btn-small" href={`/student/curso/${courseId}/examen/${a.exam_id}`}>Realizar</Link>
                    ) : null}
                  </div>
                )}
                {a.type !== 'test' && a.type !== 'examen' && (
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginTop: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!a.completed} onChange={() => toggleDone(a)} />
                    {a.completed ? 'Completada' : 'Marcar como completada'}
                  </label>
                )}
                {(a.type === 'test' || a.type === 'examen') && a.completed && (
                  <div className="badge badge-success" style={{ marginTop: 8 }}>Superado</div>
                )}
              </div>
            ))
          )}
        </div>
      ))}
      {modules.length === 0 && !error && <div className="muted">Cargando contenido…</div>}

      <CourseSurvey courseId={courseId} />

      <div className="card" style={{ marginTop: 24 }}>
        <CourseForum courseId={courseId} />
      </div>
    </AppShell>
  );
}
