'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { AppVersion } from '@/components/AppVersion';
import { Reveal } from '@/components/Reveal';
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

/** Campus: la oferta formativa completa, con certificado. */
export default function CampusPage() {
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
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <p style={{ marginBottom: 16 }}><Link href="/">← Inicio</Link></p>

        <div className="animate-fade" style={{ textAlign: 'center', marginBottom: 26 }}>
          <img src="/logo-horizontal.png" alt="Gran Canaria RCP" style={{ maxWidth: 260, width: '100%' }} />
          <h1 style={{ marginTop: 10, fontSize: 30 }}>
            <span className="heading-underline"><span className="shine-text">Campus de formación</span></span>
          </h1>
          <p className="muted" style={{ maxWidth: 640, margin: '14px auto 0' }}>
            Formación acreditada en reanimación y emergencias, con evaluación y <strong>certificado verificable</strong>.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
            <Link href="/login" className="btn press" style={{ background: 'linear-gradient(135deg,var(--primary-dark),var(--secondary-dark))', color: '#fff', fontWeight: 700, padding: '12px 22px' }}>Acceder</Link>
            <Link href="/registro" className="btn press" style={{ background: 'linear-gradient(135deg,#276749,#10b981)', color: '#fff', fontWeight: 700, padding: '12px 22px' }}>Registrarse</Link>
          </div>
        </div>

        <Reveal>
          <h2 style={{ textAlign: 'center', marginBottom: 18 }}>Oferta formativa</h2>

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
        </Reveal>

        {courses.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center' }}>Pronto habrá cursos disponibles.</p>
        ) : filtered.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center' }}>Ningún curso coincide con los filtros.</p>
        ) : (
          <div className="grid grid-4">
            {filtered.map((c, i) => {
              const pal = temaPalette(c.tema);
              return (
                <Reveal key={c.id} delay={Math.min(i, 8) * 60}>
                  <Link href={`/curso/${c.id}`} className="card press" style={{ display: 'block', textDecoration: 'none', position: 'relative', padding: 0, overflow: 'hidden', borderTop: `4px solid ${pal.main}` }}>
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
                </Reveal>
              );
            })}
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: 32, fontSize: 13 }}>
          <Link href="/privacidad">Política de privacidad</Link> · <Link href="/terminos">Condiciones de uso</Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: 8 }}><AppVersion /></p>
      </div>
    </div>
  );
}
