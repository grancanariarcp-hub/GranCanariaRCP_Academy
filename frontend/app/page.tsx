'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { AppVersion } from '@/components/AppVersion';
import { temaPalette } from '@/lib/temaColors';

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
  publico_objetivo: string[];
  cfc: string | null;
}

export default function Home() {
  const [courses, setCourses] = useState<OpenCourse[]>([]);
  const [fMatricula, setFMatricula] = useState<'todas' | 'abierta' | 'proximamente'>('todas');
  const [fTema, setFTema] = useState('');
  const [fPublico, setFPublico] = useState('');
  const [fCfc, setFCfc] = useState(false);

  useEffect(() => {
    api<{ courses: OpenCourse[] }>('/api/public/courses').then((r) => setCourses(r.courses)).catch(() => {});
  }, []);

  const temas = useMemo(() => [...new Set(courses.map((c) => c.tema).filter(Boolean) as string[])].sort(), [courses]);
  const publicos = useMemo(() => [...new Set(courses.flatMap((c) => c.publico_objetivo || []))].sort(), [courses]);

  const filtered = courses.filter((c) => {
    if (fMatricula === 'abierta' && !c.enrollment_open) return false;
    if (fMatricula === 'proximamente' && c.enrollment_open) return false;
    if (fTema && c.tema !== fTema) return false;
    if (fPublico && !(c.publico_objetivo || []).includes(fPublico)) return false;
    if (fCfc && !c.cfc) return false;
    return true;
  });

  return (
    <div style={{ minHeight: '100vh', padding: '32px 16px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* Cabecera */}
        <div className="animate-fade" style={{ textAlign: 'center', marginBottom: 28 }}>
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
            className="press animate-in"
            style={{
              textAlign: 'center', textDecoration: 'none', color: '#fff', borderRadius: 12, padding: 26,
              background: 'linear-gradient(135deg,#f59e0b 0%,#ef4444 30%,#ec4899 55%,#8b5cf6 78%,#10b981 100%)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 19 }}>Alumno menor de 18</div>
            <div style={{ fontSize: 13, opacity: 0.95, marginTop: 4 }}>Entra con el código de tu profesor</div>
          </Link>

          {/* Acceso: destacado para registrados (alumnos, profesores, admin) */}
          <Link
            href="/login"
            className="press animate-in"
            style={{
              textAlign: 'center', textDecoration: 'none', color: '#fff', borderRadius: 12, padding: 26,
              background: 'linear-gradient(135deg,var(--primary-dark) 0%,var(--secondary-dark) 100%)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 19 }}>Acceso</div>
            <div style={{ fontSize: 13, opacity: 0.95, marginTop: 4 }}>Alumnos, profesores y administración ya registrados</div>
          </Link>
        </div>
        <div style={{ maxWidth: 720, margin: '0 auto 32px', textAlign: 'center' }}>
          <Link href="/registro" className="btn" style={{ background: 'linear-gradient(135deg,#276749,#10b981)', color: '#fff', boxShadow: 'var(--shadow-sm)' }}>Registrarse</Link>
        </div>

        {/* Desafíos + Práctica */}
        <div className="grid grid-2" style={{ maxWidth: 720, margin: '0 auto 32px' }}>
          <Link href="/desafios" className="press animate-in" style={{ textDecoration: 'none', color: '#fff', borderRadius: 12, padding: 22, textAlign: 'center', background: 'linear-gradient(135deg,#c41e3a,#f59e0b)', boxShadow: 'var(--shadow-md)' }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>¿Qué tanto sabes de RCP?</div>
            <div style={{ fontSize: 13, opacity: 0.95, marginTop: 4 }}>Desafíos activos, reto permanente y ranking</div>
          </Link>
          <Link href="/practica" className="press animate-in" style={{ textDecoration: 'none', color: '#fff', borderRadius: 12, padding: 22, textAlign: 'center', background: 'linear-gradient(135deg,#2c5282,#276749)', boxShadow: 'var(--shadow-md)' }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Práctica libre</div>
            <div style={{ fontSize: 13, opacity: 0.95, marginTop: 4 }}>Entrena y repasa tus fallos</div>
          </Link>
        </div>

        {/* Cursos */}
        <h2 style={{ textAlign: 'center', marginBottom: 20 }}>
          <span className="heading-underline animate-in"><span className="shine-text">Cursos disponibles</span></span>
        </h2>

        {courses.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 18 }}>
            <select className="form-select" style={{ width: 'auto' }} value={fMatricula} onChange={(e) => setFMatricula(e.target.value as typeof fMatricula)}>
              <option value="todas">Todas las matrículas</option>
              <option value="abierta">Matrícula abierta</option>
              <option value="proximamente">Próximamente</option>
            </select>
            {temas.length > 0 && (
              <select className="form-select" style={{ width: 'auto' }} value={fTema} onChange={(e) => setFTema(e.target.value)}>
                <option value="">Todos los temas</option>
                {temas.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            {publicos.length > 0 && (
              <select className="form-select" style={{ width: 'auto' }} value={fPublico} onChange={(e) => setFPublico(e.target.value)}>
                <option value="">Cualquier público</option>
                {publicos.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
            <label className="btn btn-outline btn-small" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={fCfc} onChange={(e) => setFCfc(e.target.checked)} /> Con CFC
            </label>
          </div>
        )}

        {courses.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center' }}>Pronto habrá cursos disponibles.</p>
        ) : filtered.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center' }}>Ningún curso coincide con los filtros.</p>
        ) : (
          <div className="grid grid-4">
            {filtered.map((c, i) => {
              const pal = temaPalette(c.tema);
              return (
                <Link key={c.id} href={`/curso/${c.id}`} className="card press animate-in" style={{ textDecoration: 'none', position: 'relative', padding: 0, overflow: 'hidden', borderTop: `4px solid ${pal.main}`, animationDelay: `${Math.min(i, 8) * 60}ms` }}>
                  {/* Cabecera de color por tema (o miniatura si la hay) */}
                  {c.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.thumbnail_url} alt="" style={{ width: '100%', height: 90, objectFit: 'cover' }} />
                  ) : (
                    <div style={{ height: 72, background: pal.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', color: pal.text, fontWeight: 700, letterSpacing: 1, padding: '0 10px', textAlign: 'center', fontSize: 14 }}>{c.tema || 'Curso'}</div>
                  )}
                  {!c.enrollment_open && (
                    <span className="badge" style={{ position: 'absolute', top: 8, right: 8, background: 'var(--secondary-dark)', color: '#fff' }}>Próximamente</span>
                  )}
                  <div style={{ padding: 12 }}>
                    {c.tema && <span className="badge" style={{ background: pal.main, color: pal.text, fontSize: 11 }}>{c.tema}</span>}
                    <div style={{ fontWeight: 600, marginTop: 6 }}>{c.title}</div>
                    <div className="muted" style={{ fontSize: 12, margin: '4px 0 8px' }}>
                      {[c.subtema, c.modality].filter(Boolean).join(' · ')}
                      {c.duration_hours ? ` · ${c.duration_hours} h` : ''}
                      {c.cfc ? ' · CFC' : ''}
                    </div>
                    {!c.enrollment_open ? (
                      <span className="badge badge-warning">Matrícula cerrada</span>
                    ) : c.price_cents > 0 ? (
                      <span className="badge badge-primary">{(c.price_cents / 100).toFixed(2)} €</span>
                    ) : (
                      <span className="badge badge-success">Gratis · abierta</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: 32 }}>
          <AppVersion />
        </p>
      </div>
    </div>
  );
}
