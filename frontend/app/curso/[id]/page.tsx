'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { AppVersion } from '@/components/AppVersion';

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
}
interface Staff {
  name: string;
  headline: string | null;
  role: string;
}

export default function PublicCoursePage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;
  const [course, setCourse] = useState<Course | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api<{ course: Course; staff: Staff[] }>(`/api/public/courses/${courseId}`)
      .then((r) => { setCourse(r.course); setStaff(r.staff); })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Curso no disponible'));
  }, [courseId]);

  const user = typeof window !== 'undefined' ? getUser() : null;
  const isStudent = user?.role === 'student';

  async function enroll() {
    setMsg(null);
    try {
      await api(`/api/student/enroll/${courseId}`, { method: 'POST', auth: true });
      router.push('/student');
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Error al matricular');
    }
  }

  return (
    <div style={{ minHeight: '100vh', padding: '32px 16px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <p style={{ marginBottom: 16 }}><Link href="/">← Volver</Link></p>
        {error && <div className="alert alert-error">{error}</div>}
        {!course ? (
          !error && <div className="muted">Cargando…</div>
        ) : (
          <div className="card">
            {course.thumbnail_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={course.thumbnail_url} alt="" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 8, marginBottom: 16 }} />
            )}
            <h1 style={{ marginBottom: 6 }}>{course.title}</h1>
            <div className="muted" style={{ marginBottom: 16 }}>
              {[course.tema, course.subtema, course.modality].filter(Boolean).join(' · ')}
            </div>

            {course.resumen && <p style={{ marginBottom: 16 }}>{course.resumen}</p>}

            <div className="grid grid-2" style={{ marginBottom: 16 }}>
              <div className="info-box">⏱️ <strong>Duración:</strong> {course.duration_hours ? `${course.duration_hours} h` : '—'}</div>
              <div className="info-box">
                💶 <strong>Coste:</strong>{' '}
                {course.price_cents > 0 ? `${(course.price_cents / 100).toFixed(2)} €` : 'Gratis'}
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
            {staff.length > 0 && (
              <p style={{ marginBottom: 16 }}>
                <strong>Docentes:</strong>{' '}
                {staff.map((s) => `${s.name}${s.headline ? ` (${s.headline})` : ''}`).join(', ')}
              </p>
            )}

            {msg && <div className="alert alert-error">{msg}</div>}

            {/* Acción de matrícula */}
            {!course.enrollment_open ? (
              <div className="info-box">La matrícula de este curso aún no está abierta.</div>
            ) : isStudent ? (
              <button className="btn btn-primary btn-full" onClick={enroll}>
                {course.price_cents > 0 ? 'Matricularme (pago)' : 'Matricularme gratis'}
              </button>
            ) : (
              <div className="info-box" style={{ textAlign: 'center' }}>
                Para matricularte, <Link href="/login">accede</Link> o <Link href="/registro">regístrate</Link>.
              </div>
            )}
          </div>
        )}
        <p style={{ textAlign: 'center', marginTop: 24 }}><AppVersion /></p>
      </div>
    </div>
  );
}
