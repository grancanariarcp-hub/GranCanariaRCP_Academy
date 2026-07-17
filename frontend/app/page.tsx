'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { AppVersion } from '@/components/AppVersion';

interface OpenCourse {
  id: string;
  title: string;
  tema: string | null;
  subtema: string | null;
  modality: string;
  duration_hours: number | null;
  price_cents: number;
  thumbnail_url?: string;
  enrollment_open: boolean;
}

export default function Home() {
  const [courses, setCourses] = useState<OpenCourse[]>([]);

  useEffect(() => {
    api<{ courses: OpenCourse[] }>('/api/public/courses').then((r) => setCourses(r.courses)).catch(() => {});
  }, []);

  return (
    <div style={{ minHeight: '100vh', padding: '32px 16px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* Cabecera */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="/logo-horizontal.png" alt="Gran Canaria RCP" style={{ maxWidth: 320, width: '100%' }} />
          <p style={{ marginTop: 10, fontSize: 22, fontWeight: 700, color: 'var(--primary-dark)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Campus de formación
          </p>
        </div>

        {/* Accesos */}
        <div className="grid grid-2" style={{ maxWidth: 720, margin: '0 auto 14px' }}>
          {/* Menor: colorido / parcheado */}
          <Link
            href="/login/menor"
            style={{
              textAlign: 'center', textDecoration: 'none', color: '#fff', borderRadius: 12, padding: 22,
              background: 'linear-gradient(135deg,#f59e0b 0%,#ef4444 30%,#ec4899 55%,#8b5cf6 78%,#10b981 100%)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div style={{ fontSize: 34 }}>🧒</div>
            <div style={{ fontWeight: 700, fontSize: 18, marginTop: 6 }}>Alumno menor de 18</div>
            <div style={{ fontSize: 13, opacity: 0.95 }}>Entra con el código de tu profesor</div>
          </Link>

          {/* Acceso: destacado para registrados (alumnos, profesores, admin) */}
          <Link
            href="/login"
            style={{
              textAlign: 'center', textDecoration: 'none', color: '#fff', borderRadius: 12, padding: 22,
              background: 'linear-gradient(135deg,var(--primary-dark) 0%,var(--secondary-dark) 100%)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div style={{ fontSize: 34 }}>🔑</div>
            <div style={{ fontWeight: 700, fontSize: 18, marginTop: 6 }}>Acceso</div>
            <div style={{ fontSize: 13, opacity: 0.95 }}>Alumnos, profesores y administración ya registrados</div>
          </Link>
        </div>
        <div style={{ maxWidth: 720, margin: '0 auto 32px', textAlign: 'center' }}>
          <Link href="/registro" className="btn" style={{ background: 'linear-gradient(135deg,#276749,#10b981)', color: '#fff', boxShadow: 'var(--shadow-sm)' }}>✍️ Registrarse</Link>
        </div>

        {/* Desafíos + Práctica */}
        <div className="grid grid-2" style={{ maxWidth: 720, margin: '0 auto 32px' }}>
          <Link href="/desafios" style={{ textDecoration: 'none', color: '#fff', borderRadius: 12, padding: 18, textAlign: 'center', background: 'linear-gradient(135deg,#c41e3a,#f59e0b)', boxShadow: 'var(--shadow-md)' }}>
            <div style={{ fontSize: 26 }}>🏆</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Desafíos y ranking</div>
            <div style={{ fontSize: 13, opacity: 0.95 }}>Compite y sube en el ranking</div>
          </Link>
          <Link href="/practica" style={{ textDecoration: 'none', color: '#fff', borderRadius: 12, padding: 18, textAlign: 'center', background: 'linear-gradient(135deg,#2c5282,#276749)', boxShadow: 'var(--shadow-md)' }}>
            <div style={{ fontSize: 26 }}>📚</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Práctica libre</div>
            <div style={{ fontSize: 13, opacity: 0.95 }}>Entrena y repasa tus fallos</div>
          </Link>
        </div>

        {/* Cursos con matrícula abierta */}
        <h2 style={{ textAlign: 'center', marginBottom: 16 }}>Cursos disponibles</h2>
        {courses.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center' }}>Pronto habrá cursos con matrícula abierta.</p>
        ) : (
          <div className="grid grid-4">
            {courses.map((c) => (
              <Link key={c.id} href={`/curso/${c.id}`} className="card" style={{ textDecoration: 'none', position: 'relative' }}>
                {!c.enrollment_open && (
                  <span className="badge" style={{ position: 'absolute', top: 8, right: 8, background: 'var(--secondary-dark)', color: '#fff' }}>Próximamente</span>
                )}
                {c.thumbnail_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.thumbnail_url} alt="" style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 6, marginBottom: 8 }} />
                )}
                <div style={{ fontWeight: 600 }}>{c.title}</div>
                <div className="muted" style={{ fontSize: 13, margin: '6px 0' }}>
                  {[c.tema, c.subtema, c.modality].filter(Boolean).join(' · ')}
                  {c.duration_hours ? ` · ${c.duration_hours} h` : ''}
                </div>
                {!c.enrollment_open ? (
                  <span className="badge badge-warning">Matrícula cerrada</span>
                ) : c.price_cents > 0 ? (
                  <span className="badge badge-primary">{(c.price_cents / 100).toFixed(2)} €</span>
                ) : (
                  <span className="badge badge-success">Gratis · matrícula abierta</span>
                )}
              </Link>
            ))}
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: 32 }}>
          <AppVersion />
        </p>
      </div>
    </div>
  );
}
