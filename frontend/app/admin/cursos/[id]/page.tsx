'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { api, ApiError } from '@/lib/api';

interface Activity {
  id: string;
  type: 'documento' | 'video' | 'enlace' | 'test' | 'examen';
  title: string;
  url: string | null;
  is_mandatory: boolean;
  document_title: string | null;
  exam_id: string | null;
}
interface Module {
  id: string;
  title: string;
  is_mandatory: boolean;
  activities: Activity[];
}
interface Staff {
  id: string;
  name: string;
  email: string;
  role: 'director' | 'instructor';
}
interface Course {
  id: string;
  title: string;
  tema: string | null;
  subtema: string | null;
  modality: string;
  status: string;
  enrollment_open: boolean;
}

const TYPE_ICON: Record<string, string> = { documento: '📄', video: '🎬', enlace: '🔗', test: '📝', examen: '🎓' };

export default function CourseDetailPage() {
  const params = useParams();
  const courseId = params.id as string;
  const user = useSession(['super_admin', 'profesor'], '/login/admin');

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [docs, setDocs] = useState<Array<{ id: string; title: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  const [newModule, setNewModule] = useState('');
  const [addingTo, setAddingTo] = useState<string | null>(null); // moduleId
  const [actType, setActType] = useState<'documento' | 'video' | 'enlace' | 'test' | 'examen'>('documento');
  const [actTitle, setActTitle] = useState('');
  const [actUrl, setActUrl] = useState('');
  const [actDoc, setActDoc] = useState('');
  const [examAttempts, setExamAttempts] = useState('1');
  const [examPass, setExamPass] = useState('60');
  const [examTime, setExamTime] = useState('');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'director' | 'instructor'>('instructor');
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    try {
      const [c, d] = await Promise.all([
        api<{ course: Course; modules: Module[]; staff: Staff[] }>(`/api/courses/${courseId}`, { auth: true }),
        api<{ documents: Array<{ id: string; title: string }> }>('/api/admin/documents', { auth: true }).catch(() => ({ documents: [] })),
      ]);
      setCourse(c.course);
      setModules(c.modules);
      setStaff(c.staff);
      setDocs(d.documents);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error cargando el curso');
    }
  }
  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function patchCourse(body: object) {
    try {
      await api(`/api/courses/${courseId}`, { method: 'PATCH', auth: true, body: JSON.stringify(body) });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    }
  }

  async function addModule() {
    if (!newModule.trim()) return;
    await api(`/api/courses/${courseId}/modules`, { method: 'POST', auth: true, body: JSON.stringify({ title: newModule }) });
    setNewModule('');
    load();
  }
  async function deleteModule(moduleId: string) {
    await api(`/api/courses/${courseId}/modules/${moduleId}`, { method: 'DELETE', auth: true });
    load();
  }
  async function addActivity(moduleId: string) {
    try {
      if (actType === 'test' || actType === 'examen') {
        // Exams are created through their own endpoint (and get their own activity).
        await api(`/api/courses/${courseId}/modules/${moduleId}/exams`, {
          method: 'POST',
          auth: true,
          body: JSON.stringify({
            title: actTitle,
            kind: actType,
            attemptsAllowed: Number(examAttempts) || 1,
            passPct: Number(examPass) || 60,
            timeLimitMin: examTime ? Number(examTime) : null,
          }),
        });
      } else {
        await api(`/api/courses/${courseId}/modules/${moduleId}/activities`, {
          method: 'POST',
          auth: true,
          body: JSON.stringify({
            type: actType,
            title: actTitle,
            url: actType !== 'documento' ? actUrl : undefined,
            documentId: actType === 'documento' ? actDoc : undefined,
          }),
        });
      }
      setAddingTo(null); setActTitle(''); setActUrl(''); setActDoc('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al añadir actividad');
    }
  }
  async function deleteActivity(activityId: string) {
    await api(`/api/courses/${courseId}/activities/${activityId}`, { method: 'DELETE', auth: true });
    load();
  }
  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setInviteMsg(null);
    try {
      await api(`/api/courses/${courseId}/staff`, { method: 'POST', auth: true, body: JSON.stringify({ email: inviteEmail, role: inviteRole }) });
      setInviteMsg({ ok: true, text: 'Profesor añadido ✅' });
      setInviteEmail('');
      load();
    } catch (err) {
      setInviteMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Error' });
    }
  }

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  const nav =
    user.role === 'super_admin'
      ? [{ label: 'Cursos', href: '/admin/cursos', active: true }, { label: 'Profesores', href: '/admin/profesores' }]
      : [{ label: 'Mis cursos', href: '/admin/cursos', active: true }];

  return (
    <AppShell user={user} title={course?.title ?? 'Curso'} nav={nav}>
      <p style={{ marginBottom: 16 }}><Link href="/admin/cursos">← Volver a cursos</Link></p>
      {error && <div className="alert alert-error">{error}</div>}
      {!course ? (
        <div className="muted">Cargando…</div>
      ) : (
        <>
          {/* Cabecera / estado */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <div>
                <div className="card-title">{course.title}</div>
                <div className="card-subtitle">
                  {[course.tema, course.subtema, course.modality].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className={`badge ${course.status === 'publicado' ? 'badge-success' : 'badge-warning'}`}>{course.status}</span>
                {course.status === 'publicado' ? (
                  <button className="btn btn-outline btn-small" onClick={() => patchCourse({ status: 'borrador' })}>Pasar a borrador</button>
                ) : (
                  <button className="btn btn-primary btn-small" onClick={() => patchCourse({ status: 'publicado' })}>Publicar</button>
                )}
                <button className="btn btn-outline btn-small" onClick={() => patchCourse({ enrollmentOpen: !course.enrollment_open })}>
                  {course.enrollment_open ? 'Cerrar matrícula' : 'Abrir matrícula'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-2">
            {/* Módulos + actividades */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Contenido del curso</div>
                <div className="card-subtitle">{modules.length} módulos</div>
              </div>

              {modules.map((m) => (
                <div key={m.id} style={{ border: '1px solid var(--gray-200)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{m.title}</strong>
                    <div>
                      <button className="btn btn-outline btn-small" onClick={() => setAddingTo(addingTo === m.id ? null : m.id)}>+ Actividad</button>{' '}
                      {m.title !== 'Bienvenida' && (
                        <button className="btn btn-outline btn-small" onClick={() => deleteModule(m.id)} title="Eliminar módulo">🗑</button>
                      )}
                    </div>
                  </div>

                  {/* actividades */}
                  <div style={{ marginTop: 8 }}>
                    {m.activities.map((a) => (
                      <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 14 }}>
                        <span>{TYPE_ICON[a.type]} {a.title}{a.document_title ? ` — ${a.document_title}` : ''}</span>
                        <span style={{ display: 'flex', gap: 6 }}>
                          {a.exam_id && (
                            <Link className="btn btn-outline btn-small" href={`/admin/cursos/${courseId}/examen/${a.exam_id}`}>Editar</Link>
                          )}
                          <button className="btn btn-outline btn-small" onClick={() => deleteActivity(a.id)}>✕</button>
                        </span>
                      </div>
                    ))}
                    {m.activities.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Sin actividades</div>}
                  </div>

                  {/* form añadir actividad */}
                  {addingTo === m.id && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--gray-300)' }}>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                        {(['documento', 'video', 'enlace', 'test', 'examen'] as const).map((t) => (
                          <button key={t} type="button" className={`tab ${actType === t ? 'active' : ''}`} style={{ flex: 'unset', padding: '6px 10px' }} onClick={() => setActType(t)}>
                            {TYPE_ICON[t]} {t}
                          </button>
                        ))}
                      </div>
                      <input className="form-input" placeholder={actType === 'test' || actType === 'examen' ? 'Título del examen' : 'Título de la actividad'} value={actTitle} onChange={(e) => setActTitle(e.target.value)} style={{ marginBottom: 8 }} />
                      {actType === 'documento' && (
                        <select className="form-select" value={actDoc} onChange={(e) => setActDoc(e.target.value)} style={{ marginBottom: 8 }}>
                          <option value="">Elige un documento…</option>
                          {docs.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                        </select>
                      )}
                      {(actType === 'video' || actType === 'enlace') && (
                        <input className="form-input" placeholder="https://…" value={actUrl} onChange={(e) => setActUrl(e.target.value)} style={{ marginBottom: 8 }} />
                      )}
                      {(actType === 'test' || actType === 'examen') && (
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                          <div style={{ flex: 1 }}>
                            <label className="form-label">Intentos</label>
                            <input className="form-input" type="number" min="1" value={examAttempts} onChange={(e) => setExamAttempts(e.target.value)} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label className="form-label">% aprobado</label>
                            <input className="form-input" type="number" min="0" max="100" value={examPass} onChange={(e) => setExamPass(e.target.value)} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label className="form-label">Min (opc.)</label>
                            <input className="form-input" type="number" min="1" placeholder="—" value={examTime} onChange={(e) => setExamTime(e.target.value)} />
                          </div>
                        </div>
                      )}
                      <button className="btn btn-primary btn-small btn-full" onClick={() => addActivity(m.id)} disabled={!actTitle.trim()}>
                        {actType === 'test' || actType === 'examen' ? 'Crear examen' : 'Añadir'}
                      </button>
                    </div>
                  )}
                </div>
              ))}

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input className="form-input" placeholder="Nombre del nuevo módulo" value={newModule} onChange={(e) => setNewModule(e.target.value)} />
                <button className="btn btn-primary btn-small" onClick={addModule}>+ Módulo</button>
              </div>
            </div>

            {/* Staff */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Profesores del curso</div>
                <div className="card-subtitle">Directores e instructores</div>
              </div>
              <div className="table-responsive" style={{ marginBottom: 16 }}>
                <table>
                  <thead><tr><th>Nombre</th><th>Rol</th></tr></thead>
                  <tbody>
                    {staff.map((s) => (
                      <tr key={s.id}>
                        <td>{s.name}<div className="muted" style={{ fontSize: 12 }}>{s.email}</div></td>
                        <td><span className={`badge ${s.role === 'director' ? 'badge-primary' : 'badge-success'}`}>{s.role}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="info-box" style={{ marginBottom: 12, fontSize: 13 }}>
                Invita a un profesor <strong>ya registrado y aprobado</strong> por su email.
              </div>
              {inviteMsg && <div className={`alert ${inviteMsg.ok ? 'alert-success' : 'alert-error'}`}>{inviteMsg.text}</div>}
              <form onSubmit={invite}>
                <div className="form-group">
                  <label className="form-label">Email del profesor</label>
                  <input className="form-input" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Rol</label>
                  <select className="form-select" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as 'director' | 'instructor')}>
                    <option value="instructor">Instructor</option>
                    <option value="director">Director</option>
                  </select>
                </div>
                <button className="btn btn-primary btn-full">Añadir al curso</button>
              </form>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
