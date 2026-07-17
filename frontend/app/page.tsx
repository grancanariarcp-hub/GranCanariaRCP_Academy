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
          <p className="muted" style={{ marginTop: 4 }}>Campus de formación en reanimación cardiopulmonar</p>
        </div>

        {/* Accesos */}
        <div className="grid grid-2" style={{ maxWidth: 720, margin: '0 auto 12px' }}>
          <Link href="/login/menor" className="card" style={{ textAlign: 'center', textDecoration: 'none' }}>
            <div style={{ fontSize: 30 }}>🧒</div>
            <div className="card-title" style={{ marginTop: 6 }}>Alumno menor de 18</div>
            <div className="card-subtitle">Entra con el código de tu profesor</div>
          </Link>
          <Link href="/login" className="card" style={{ textAlign: 'center', textDecoration: 'none' }}>
            <div style={{ fontSize: 30 }}>📧</div>
            <div className="card-title" style={{ marginTop: 6 }}>Acceso</div>
            <div className="card-subtitle">Email y contraseña</div>
          </Link>
        </div>
        <div style={{ maxWidth: 720, margin: '0 auto 32px', textAlign: 'center' }}>
          <Link href="/registro" className="btn btn-outline">✍️ Registrarse (nuevo alumno)</Link>
        </div>

        {/* Cursos con matrícula abierta */}
        <h2 style={{ textAlign: 'center', marginBottom: 16 }}>Cursos disponibles</h2>
        {courses.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center' }}>Pronto habrá cursos con matrícula abierta.</p>
        ) : (
          <div className="grid grid-4">
            {courses.map((c) => (
              <Link key={c.id} href={`/curso/${c.id}`} className="card" style={{ textDecoration: 'none' }}>
                <div style={{ fontWeight: 600 }}>{c.title}</div>
                <div className="muted" style={{ fontSize: 13, margin: '6px 0' }}>
                  {[c.tema, c.subtema, c.modality].filter(Boolean).join(' · ')}
                  {c.duration_hours ? ` · ${c.duration_hours} h` : ''}
                </div>
                {c.price_cents > 0 ? (
                  <span className="badge badge-primary">{(c.price_cents / 100).toFixed(2)} €</span>
                ) : (
                  <span className="badge badge-success">Gratis</span>
                )}
              </Link>
            ))}
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: 32 }}>
          <Link href="/login" className="muted" style={{ fontSize: 13 }}>Soy profesor o administrador</Link>
          {' · '}
          <AppVersion />
        </p>
      </div>
    </div>
  );
}
