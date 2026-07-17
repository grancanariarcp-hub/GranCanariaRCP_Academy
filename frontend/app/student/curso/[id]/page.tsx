'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { api, ApiError } from '@/lib/api';

interface Activity {
  id: string;
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api<{ course: Course; modules: Module[] }>(`/api/student/courses/${courseId}`, { auth: true })
      .then((r) => { setCourse(r.course); setModules(r.modules); })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error cargando el curso'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  return (
    <AppShell user={user} title={course?.title ?? 'Curso'} nav={[{ label: 'Inicio', href: '/student', active: true }]}>
      <p style={{ marginBottom: 16 }}><Link href="/student">← Volver a mis cursos</Link></p>
      {error && <div className="alert alert-error">{error}</div>}

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
              <div key={a.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--gray-200)' }}>
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
              </div>
            ))
          )}
        </div>
      ))}
      {modules.length === 0 && !error && <div className="muted">Cargando contenido…</div>}
    </AppShell>
  );
}
