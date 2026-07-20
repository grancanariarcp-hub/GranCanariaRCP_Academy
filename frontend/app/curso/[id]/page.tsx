'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { AppVersion } from '@/components/AppVersion';
import { Carousel } from '@/components/Carousel';
import { temaPalette } from '@/lib/temaColors';
import { PageNav } from '@/components/PageNav';
import { Contacto } from '@/components/Contacto';

interface Course {
  id: string;
  title: string;
  tema: string | null;
  subtema: string | null;
  modality: string;
  duration_hours: number | null;
  price_cents: number;
  publico_objetivo: string[];
  objetivo_general: string | null;
  objetivos_especificos: string | null;
  resumen: string | null;
  acreditacion: string | null;
  cfc: string | null;
  thumbnail_url?: string;
  enrollment_open: boolean;
  /** Precio vigente calculado en el servidor (tramo anticipado o recargado). */
  precio?: { cents: number; earlyCents: number; lateCents: number; esAnticipada: boolean; hasta: string | null };
}

const euros = (cents: number) => (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
interface Staff {
  id: string;
  name: string;
  headline: string | null;
  role: string;
  photo_url?: string | null;
}
interface Mod { title: string; activities: Array<{ type: string; title: string }> }

export default function PublicCoursePage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;
  const [course, setCourse] = useState<Course | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [enrolando, setEnrolando] = useState(false);
  const [program, setProgram] = useState<Mod[]>([]);
  const [gallery, setGallery] = useState<Array<{ id: string; url: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api<{ course: Course; staff: Staff[]; program: Mod[]; gallery: Array<{ id: string; url: string }> }>(`/api/public/courses/${courseId}`)
      .then((r) => { setCourse(r.course); setStaff(r.staff); setProgram(r.program ?? []); setGallery(r.gallery ?? []); })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Curso no disponible'));
  }, [courseId]);

  const user = typeof window !== 'undefined' ? getUser() : null;
  // El curso se puede editar en cualquier estado, también publicado: la ficha
  // se cierra al firmar el acta, no al publicarla.
  const puedeEditar = user?.role === 'super_admin' || user?.role === 'profesor';
  const isStudent = user?.role === 'student';

  /**
   * Matricularse. Si el curso es de pago, se va directo a la pasarela: el
   * acceso al contenido exige haber pagado, así que no tiene sentido dejar al
   * alumno dentro de la plataforma con una matrícula a medias.
   */
  async function enroll() {
    setMsg(null);
    setEnrolando(true);
    try {
      await api(`/api/student/enroll/${courseId}`, { method: 'POST', auth: true });
      const precioCents = course?.precio?.cents ?? course?.price_cents ?? 0;
      if (precioCents > 0) {
        const pago = await api<{ url: string }>(`/api/student/courses/${courseId}/checkout`, { method: 'POST', auth: true });
        window.location.href = pago.url;
        return;
      }
      router.push('/student');
    } catch (err) {
      // Si falla justo el cobro, la matrícula queda pendiente y se puede
      // reintentar desde "Mis cursos": no se pierde nada.
      setMsg(
        err instanceof ApiError && err.code === 'STRIPE_NOT_CONFIGURED'
          ? 'El pago con tarjeta aún no está disponible. Ponte en contacto con la organización.'
          : err instanceof ApiError ? err.message : 'Error al matricular',
      );
      setEnrolando(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', padding: '32px 16px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <PageNav />
        {/* Atajo a la edición para quien gestiona el curso: la ficha pública es
            un punto de entrada habitual y no tenía vuelta al panel. */}
        {puedeEditar && (
          <div className="card" style={{ marginBottom: 14, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderLeft: '4px solid var(--secondary-dark)' }}>
            <span className="muted" style={{ fontSize: 13 }}>Estás viendo la ficha pública de este curso.</span>
            <Link href={`/admin/cursos/${courseId}`} className="btn btn-primary btn-small press">Editar curso</Link>
          </div>
        )}
        {error && <div className="alert alert-error">{error}</div>}
        {!course ? (
          !error && <div className="muted">Cargando…</div>
        ) : (
          <div className="card animate-pop" style={{ padding: 0, overflow: 'hidden', borderTop: `6px solid ${temaPalette(course.tema).main}` }}>
            {gallery.length > 0 ? (
              <Carousel images={gallery.map((g) => g.url)} height={260} />
            ) : course.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={course.thumbnail_url} alt="" style={{ width: '100%', maxHeight: 240, objectFit: 'cover' }} />
            ) : (
              <div style={{ height: 120, background: temaPalette(course.tema).grad }} />
            )}
            <div style={{ padding: 24 }}>
            {course.tema && <span className="badge" style={{ background: temaPalette(course.tema).main, color: temaPalette(course.tema).text, marginBottom: 8 }}>{course.tema}</span>}
            <h1 style={{ marginBottom: 6 }}>{course.title}</h1>
            <div className="muted" style={{ marginBottom: 16 }}>
              {[course.subtema, course.modality].filter(Boolean).join(' · ')}
            </div>

            {course.resumen && <p style={{ marginBottom: 16 }}>{course.resumen}</p>}

            <div className="grid grid-2" style={{ marginBottom: 16 }}>
              <div className="info-box">⏱️ <strong>Duración:</strong> {course.duration_hours ? `${course.duration_hours} h` : '—'}</div>
              <div className="info-box">
                💶 <strong>Coste:</strong>{' '}
                {(course.precio?.cents ?? course.price_cents) > 0 ? euros(course.precio?.cents ?? course.price_cents) : 'Gratis'}
                {/* Con matrícula anticipada vigente, mostrar el precio posterior
                    da urgencia real sin necesidad de inventar una promoción. */}
                {course.precio?.esAnticipada && course.precio.lateCents > course.precio.cents && (
                  <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
                    Después: {euros(course.precio.lateCents)}
                  </div>
                )}
              </div>
              {course.acreditacion && <div className="info-box">🏛️ <strong>Acredita:</strong> {course.acreditacion}</div>}
              {course.cfc && <div className="info-box">🎖️ <strong>CFC:</strong> {course.cfc}</div>}
            </div>

            {course.publico_objetivo.length > 0 && (
              <p style={{ marginBottom: 12 }}>
                <strong>Dirigido a:</strong> {course.publico_objetivo.join(', ')}
              </p>
            )}
            {course.objetivo_general && (
              <p style={{ marginBottom: 12 }}><strong>Objetivo:</strong> {course.objetivo_general}</p>
            )}
            {course.objetivos_especificos && (
              <p style={{ marginBottom: 12 }}><strong>Aprenderás:</strong> {course.objetivos_especificos}</p>
            )}
            {program.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <strong>Programa:</strong>
                {program.map((m, i) => (
                  <div key={i} style={{ marginTop: 6 }}>
                    <span style={{ fontWeight: 600 }}>{m.title}</span>
                    {m.activities.length > 0 && (
                      <ul style={{ margin: '2px 0 0 18px', fontSize: 14 }}>
                        {m.activities.map((a, j) => <li key={j}>{a.title}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* Profesorado del curso: quién lo dirige y quién lo imparte, con
                acceso a su currículum. Es lo que más pesa al decidir una
                formación sanitaria. */}
            {staff.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, marginBottom: 10 }}>Profesorado</h3>
                <div className="grid grid-2" style={{ gap: 10 }}>
                  {staff.map((s) => (
                    <Link key={s.id} href={`/profesor/${s.id}`} className="press"
                      style={{
                        display: 'flex', gap: 11, alignItems: 'center', textDecoration: 'none',
                        padding: 11, borderRadius: 10, border: '1px solid var(--gray-200)',
                        background: s.role === 'director' ? 'var(--gray-100)' : '#fff',
                      }}>
                      <div style={{
                        width: 46, height: 46, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
                        background: 'linear-gradient(135deg,var(--primary-dark),var(--secondary-dark))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 700, fontSize: 15,
                      }}>
                        {s.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          s.name.split(' ').slice(0, 2).map((n) => n[0]).join('')
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--gray-900)' }}>{s.name}</div>
                        {s.headline && <div className="muted" style={{ fontSize: 12.5 }}>{s.headline}</div>}
                        <div style={{ marginTop: 4 }}>
                          <span className={`badge ${s.role === 'director' ? 'badge-primary' : ''}`} style={{ fontSize: 11 }}>
                            {s.role === 'director' ? 'Director del curso' : 'Docente'}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
                <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                  Pulsa sobre cada docente para consultar su currículum.
                </p>
              </div>
            )}

            {msg && <div className="alert alert-error">{msg}</div>}

            {/* Acción de matrícula */}
            {!course.enrollment_open ? (
              <div className="info-box" style={{ textAlign: 'center' }}>
                🔜 <strong>Próximamente.</strong> La matrícula de este curso aún no está abierta.{' '}
                {!isStudent && <><Link href="/registro">Regístrate</Link> para no perdértela.</>}
              </div>
            ) : isStudent ? (
              <>
                <button className="btn btn-primary btn-full press" onClick={enroll} disabled={enrolando}>
                  {enrolando
                    ? 'Preparando…'
                    : (course.precio?.cents ?? course.price_cents) > 0
                      ? `Matricularme y pagar ${euros(course.precio?.cents ?? course.price_cents)}`
                      : 'Matricularme gratis'}
                </button>
                {(course.precio?.cents ?? course.price_cents) > 0 && (
                  <p className="muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 8 }}>
                    Pago seguro con tarjeta. El acceso al curso se activa al confirmarse el pago.
                    {course.precio?.esAnticipada && course.precio.hasta && (
                      <> Precio de matrícula anticipada hasta el {new Date(course.precio.hasta).toLocaleDateString('es-ES')}.</>
                    )}
                  </p>
                )}
              </>
            ) : (
              <div className="info-box" style={{ textAlign: 'center' }}>
                Para matricularte, <Link href="/login">accede</Link> o <Link href="/registro">regístrate</Link>.
              </div>
            )}
            </div>
          </div>
        )}
        <div style={{ marginTop: 26 }}><Contacto /></div>
        <p style={{ textAlign: 'center', marginTop: 24 }}><AppVersion /></p>
      </div>
    </div>
  );
}
