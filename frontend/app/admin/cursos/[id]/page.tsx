'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { CourseForum } from '@/components/CourseForum';
import { api, ApiError, uploadFile, downloadFile } from '@/lib/api';

interface Activity {
  id: string;
  type: 'documento' | 'video' | 'enlace' | 'test' | 'examen' | 'texto' | 'imagen';
  title: string;
  url: string | null;
  body: string | null;
  image_url?: string;
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
  resumen: string | null;
  acreditacion: string | null;
  cfc: string | null;
  thumbnail_url?: string;
  certifica: string | null;
  firmante1_nombre: string | null;
  firmante1_cargo: string | null;
  firmante2_nombre: string | null;
  firmante2_cargo: string | null;
  cert_bg_url?: string;
  cfc_image_url?: string;
}

const TYPE_ICON: Record<string, string> = { documento: '📄', video: '🎬', enlace: '🔗', test: '📝', examen: '🎓', texto: '📝', imagen: '🖼️' };

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

  // Ficha del curso (editable)
  const [fResumen, setFResumen] = useState('');
  const [fAcred, setFAcred] = useState('');
  const [fCfc, setFCfc] = useState('');
  const [fichaMsg, setFichaMsg] = useState<string | null>(null);

  // Certificado
  const [certifica, setCertifica] = useState('');
  const [f1n, setF1n] = useState('');
  const [f1c, setF1c] = useState('');
  const [f2n, setF2n] = useState('');
  const [f2c, setF2c] = useState('');
  const [certMsg, setCertMsg] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null); // moduleId
  const [actType, setActType] = useState<'documento' | 'video' | 'enlace' | 'texto' | 'imagen' | 'test' | 'examen'>('documento');
  const [actTitle, setActTitle] = useState('');
  const [actUrl, setActUrl] = useState('');
  const [actDoc, setActDoc] = useState('');
  const [actBody, setActBody] = useState('');
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
      setFResumen(c.course.resumen ?? '');
      setFAcred(c.course.acreditacion ?? '');
      setFCfc(c.course.cfc ?? '');
      setCertifica(c.course.certifica ?? '');
      setF1n(c.course.firmante1_nombre ?? '');
      setF1c(c.course.firmante1_cargo ?? '');
      setF2n(c.course.firmante2_nombre ?? '');
      setF2c(c.course.firmante2_cargo ?? '');
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

  async function saveFicha() {
    setFichaMsg(null);
    try {
      await api(`/api/courses/${courseId}`, { method: 'PATCH', auth: true, body: JSON.stringify({ resumen: fResumen, acreditacion: fAcred, cfc: fCfc }) });
      setFichaMsg('Ficha guardada ✅');
      load();
    } catch (err) {
      setFichaMsg(err instanceof ApiError ? err.message : 'Error al guardar');
    }
  }
  async function uploadThumb(file: File | undefined) {
    if (!file) return;
    try {
      await uploadFile(`/api/courses/${courseId}/thumbnail`, file);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al subir la miniatura');
    }
  }

  async function saveCert() {
    setCertMsg(null);
    try {
      await api(`/api/courses/${courseId}`, {
        method: 'PATCH', auth: true,
        body: JSON.stringify({ certifica, firmante1Nombre: f1n, firmante1Cargo: f1c, firmante2Nombre: f2n, firmante2Cargo: f2c }),
      });
      setCertMsg('Datos del certificado guardados ✅');
      load();
    } catch (err) {
      setCertMsg(err instanceof ApiError ? err.message : 'Error');
    }
  }
  async function uploadCertImg(kind: 'background' | 'cfc-image', file: File | undefined) {
    if (!file) return;
    try {
      await uploadFile(`/api/courses/${courseId}/certificate/${kind}`, file);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al subir la imagen');
    }
  }
  async function previewCert() {
    try {
      await downloadFile(`/api/courses/${courseId}/certificate/preview`, 'previsualizacion-certificado.pdf');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al previsualizar');
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
            url: actType === 'video' || actType === 'enlace' ? actUrl : undefined,
            documentId: actType === 'documento' ? actDoc : undefined,
            body: actType === 'texto' ? actBody : undefined,
          }),
        });
      }
      setAddingTo(null); setActTitle(''); setActUrl(''); setActDoc(''); setActBody('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al añadir actividad');
    }
  }

  async function uploadImageActivity(moduleId: string, file: File | undefined) {
    if (!file) return;
    try {
      await uploadFile(`/api/courses/${courseId}/modules/${moduleId}/activities/image`, file, { title: actTitle || file.name });
      setAddingTo(null); setActTitle('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al subir la imagen');
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
                {course.enrollment_open && course.status === 'publicado' && <span className="badge badge-primary">visible al público</span>}
                {course.status === 'publicado' ? (
                  <button className="btn btn-outline btn-small" onClick={() => patchCourse({ status: 'borrador' })}>Pasar a borrador</button>
                ) : (
                  // Publicar abre también la matrícula, si no el curso quedaría publicado pero invisible.
                  <button className="btn btn-primary btn-small" onClick={() => patchCourse({ status: 'publicado', enrollmentOpen: true })}>Publicar y abrir matrícula</button>
                )}
                <button className="btn btn-outline btn-small" onClick={() => patchCourse({ enrollmentOpen: !course.enrollment_open })}>
                  {course.enrollment_open ? 'Cerrar matrícula' : 'Abrir matrícula'}
                </button>
              </div>
            </div>
            {course.status === 'publicado' && !course.enrollment_open && (
              <div className="alert alert-warning" style={{ marginTop: 12, marginBottom: 0 }}>
                Este curso está <strong>publicado pero con la matrícula cerrada</strong>, por eso no aparece en la página pública. Pulsa <strong>«Abrir matrícula»</strong> para que se vea y los alumnos puedan inscribirse.
              </div>
            )}
            {course.status === 'publicado' && course.enrollment_open && (
              <div className="info-box" style={{ marginTop: 12, fontSize: 13 }}>
                Visible en la página de inicio pública. <Link href={`/curso/${course.id}`} target="_blank">Ver ficha pública ↗</Link>
              </div>
            )}
          </div>

          {/* Ficha del curso */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <div className="card-title">Ficha del curso</div>
              <div className="card-subtitle">Se muestra a los alumnos antes de matricularse</div>
            </div>
            {fichaMsg && <div className={`alert ${fichaMsg.includes('✅') ? 'alert-success' : 'alert-error'}`}>{fichaMsg}</div>}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ width: 140, flexShrink: 0 }}>
                <div style={{ width: 140, height: 90, background: 'var(--gray-200)', borderRadius: 8, overflow: 'hidden', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {course.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={course.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 26 }}>🖼️</span>
                  )}
                </div>
                <label className="btn btn-outline btn-small btn-full" style={{ cursor: 'pointer' }}>
                  Miniatura
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { uploadThumb(e.target.files?.[0]); e.target.value = ''; }} />
                </label>
              </div>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div className="form-group">
                  <label className="form-label">Resumen</label>
                  <textarea className="form-input" style={{ height: 70, padding: 10 }} value={fResumen} onChange={(e) => setFResumen(e.target.value)} />
                </div>
                <div className="grid grid-2" style={{ gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Acreditación</label>
                    <input className="form-input" value={fAcred} onChange={(e) => setFAcred(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">CFC</label>
                    <input className="form-input" value={fCfc} onChange={(e) => setFCfc(e.target.value)} />
                  </div>
                </div>
                <button className="btn btn-primary btn-small" onClick={saveFicha}>Guardar ficha</button>
              </div>
            </div>
          </div>

          {/* Certificado */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <div className="card-title">Certificado</div>
              <div className="card-subtitle">Se genera al aprobar el curso. Si no subes fondo, será blanco.</div>
            </div>
            {certMsg && <div className={`alert ${certMsg.includes('✅') ? 'alert-success' : 'alert-error'}`}>{certMsg}</div>}
            <div className="form-group">
              <label className="form-label">Quién certifica</label>
              <input className="form-input" placeholder="Ej.: GranCanaria RCP Academy" value={certifica} onChange={(e) => setCertifica(e.target.value)} />
            </div>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div>
                <div className="form-group"><label className="form-label">Firmante 1 · nombre</label><input className="form-input" value={f1n} onChange={(e) => setF1n(e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Firmante 1 · cargo</label><input className="form-input" value={f1c} onChange={(e) => setF1c(e.target.value)} /></div>
              </div>
              <div>
                <div className="form-group"><label className="form-label">Firmante 2 · nombre</label><input className="form-input" value={f2n} onChange={(e) => setF2n(e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Firmante 2 · cargo</label><input className="form-input" value={f2c} onChange={(e) => setF2c(e.target.value)} /></div>
              </div>
            </div>
            <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>Si un firmante queda vacío, no aparece en el certificado. Los CFC y las fechas se toman de la ficha del curso.</p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
              <label className="btn btn-outline btn-small" style={{ cursor: 'pointer' }}>
                {course.cert_bg_url ? 'Cambiar fondo' : 'Subir fondo'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { uploadCertImg('background', e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              <label className="btn btn-outline btn-small" style={{ cursor: 'pointer' }}>
                {course.cfc_image_url ? 'Cambiar imagen CFC' : 'Subir imagen CFC'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { uploadCertImg('cfc-image', e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              {course.cert_bg_url && <span className="badge badge-success">Fondo ✓</span>}
              {course.cfc_image_url && <span className="badge badge-success">CFC ✓</span>}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-small" onClick={saveCert}>Guardar datos</button>
              <button className="btn btn-outline btn-small" onClick={previewCert}>👁️ Ver previsualización</button>
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
                        <span>
                          {TYPE_ICON[a.type]} {a.title}{a.document_title ? ` — ${a.document_title}` : ''}
                          {a.type === 'imagen' && a.image_url && <img src={a.image_url} alt="" style={{ height: 24, marginLeft: 8, borderRadius: 4, verticalAlign: 'middle' }} />}
                        </span>
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
                        {(['documento', 'texto', 'imagen', 'video', 'enlace', 'test', 'examen'] as const).map((t) => (
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
                      {actType === 'texto' && (
                        <textarea className="form-input" style={{ height: 90, padding: 10, marginBottom: 8 }} placeholder="Escribe el contenido…" value={actBody} onChange={(e) => setActBody(e.target.value)} />
                      )}
                      {actType === 'imagen' && (
                        <label className="btn btn-primary btn-small btn-full" style={{ cursor: 'pointer', marginBottom: 8 }}>
                          🖼️ Elegir imagen y subir
                          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { uploadImageActivity(m.id, e.target.files?.[0]); e.target.value = ''; }} />
                        </label>
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
                            <label className="form-label">Minutos</label>
                            <input className="form-input" type="number" min="1" placeholder="libre" value={examTime} onChange={(e) => setExamTime(e.target.value)} title="Vacío = tiempo libre" />
                          </div>
                        </div>
                      )}
                      {actType !== 'imagen' && (
                        <button className="btn btn-primary btn-small btn-full" onClick={() => addActivity(m.id)} disabled={!actTitle.trim()}>
                          {actType === 'test' || actType === 'examen' ? 'Crear examen' : 'Añadir'}
                        </button>
                      )}
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

      <div className="card" style={{ marginTop: 24 }}>
        <CourseForum courseId={courseId} />
      </div>
    </AppShell>
  );
}
