'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { AppVersion } from '@/components/AppVersion';
import { Reveal } from '@/components/Reveal';
import { temaPalette } from '@/lib/temaColors';
import { PageNav } from '@/components/PageNav';

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
  resumen?: string | null;
}

const VENTAJAS = [
  { titulo: 'Certificado verificable', texto: 'Con código y QR: cualquiera puede comprobar su autenticidad al instante.', color: '#c41e3a' },
  { titulo: 'Formación acreditada', texto: 'Cursos con horas lectivas justificadas y créditos CFC cuando procede.', color: '#0d9488' },
  { titulo: 'Profesorado sanitario', texto: 'Docentes en activo, con su currículum publicado y verificable.', color: '#2563eb' },
  { titulo: 'A tu ritmo', texto: 'Estudias cuando puedes; la plataforma registra tu avance y tu dedicación.', color: '#7c3aed' },
];

/** Campus de formación: página de captación de la oferta acreditada. */
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

  const hayFiltros = fMatricula !== 'todas' || !!fTema || !!fPublico || fCfc;
  const limpiarFiltros = () => { setFMatricula('todas'); setFTema(''); setFPublico(''); setFCfc(false); };

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* ---------- Portada ---------- */}
      <div style={{
        background: 'linear-gradient(135deg,var(--primary-dark) 0%,var(--secondary-dark) 55%,#0d9488 100%)',
        color: '#fff', padding: '38px 16px 46px',
      }}>
        <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ textAlign: 'left' }}>
            <PageNav backHref="/desafioRCP" backLabel="Zona gratuita" light />
          </div>
          <div className="animate-fade">
            {/* Versión en negativo del logo: isla y rótulo en blanco, manos en
                el azul del encabezado (el filtro CSS las aplanaba en blanco). */}
            <img src="/logo-horizontal-negativo.png" alt="Gran Canaria RCP" style={{ maxWidth: 280, width: '100%' }} />
            <h1 style={{ fontSize: 34, marginTop: 14, lineHeight: 1.15 }}>Campus de formación</h1>
            <p style={{ fontSize: 17, opacity: 0.95, maxWidth: 640, margin: '12px auto 0' }}>
              Fórmate con <strong>cursos acreditados</strong>, evaluación real y
              <strong> certificados verificables</strong>.
            </p>
          </div>

          {/* Acceso y registro: lo primero y destacado */}
          <div className="animate-in" style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 26, flexWrap: 'wrap' }}>
            <Link href="/registro" className="press cta-blink"
              style={{ textDecoration: 'none', background: '#fff', color: 'var(--primary-dark)', borderRadius: 12,
                padding: '16px 30px', fontWeight: 800, fontSize: 17, boxShadow: '0 6px 20px rgba(0,0,0,.25)' }}>
              Crear mi cuenta y matricularme
            </Link>
            <Link href="/login" className="press"
              style={{ textDecoration: 'none', background: 'rgba(255,255,255,0.14)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.5)', borderRadius: 12, padding: '16px 30px', fontWeight: 700, fontSize: 17 }}>
              Ya tengo cuenta
            </Link>
          </div>

        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '34px 16px' }}>

        {/* ---------- Por qué formarte aquí ---------- */}
        <div className="grid grid-4" style={{ marginBottom: 44 }}>
          {VENTAJAS.map((v, i) => (
            <Reveal key={v.titulo} delay={i * 80}>
              <div className="card" style={{ height: '100%', borderTop: `4px solid ${v.color}`, textAlign: 'center' }}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: v.color }}>{v.titulo}</div>
                <div className="muted" style={{ fontSize: 13.5 }}>{v.texto}</div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* ---------- Oferta ---------- */}
        <Reveal>
          <h2 style={{ textAlign: 'center', marginBottom: 8 }}>
            <span className="heading-underline"><span className="shine-text">Oferta formativa</span></span>
          </h2>
          <p className="muted" style={{ textAlign: 'center', marginBottom: 20, fontSize: 14 }}>
            Filtra por tema, público o acreditación para encontrar tu curso.
          </p>

          {courses.length > 0 && (
            <div className="filter-bar">
              {/* Rejilla simétrica: cada filtro ocupa una celda idéntica, etiqueta arriba
                  y control de la misma altura, incluida la acreditación CFC. */}
              <div className="filter-grid">
                <div>
                  <label className="form-label" htmlFor="f-matricula">Matrícula</label>
                  <select id="f-matricula" className="form-select" value={fMatricula} onChange={(e) => setFMatricula(e.target.value as typeof fMatricula)}>
                    <option value="todas">Todas</option>
                    <option value="abierta">Abierta</option>
                    <option value="proximamente">Próximamente</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" htmlFor="f-tema">Tema</label>
                  <select id="f-tema" className="form-select" value={fTema} onChange={(e) => setFTema(e.target.value)} disabled={temas.length === 0}>
                    <option value="">Todos</option>
                    {temas.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="form-label" htmlFor="f-publico">Público</label>
                  <select id="f-publico" className="form-select" value={fPublico} onChange={(e) => setFPublico(e.target.value)} disabled={publicos.length === 0}>
                    <option value="">Cualquiera</option>
                    {publicos.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div>
                  <span className="form-label">Acreditación</span>
                  <button
                    type="button"
                    className={`filter-toggle press${fCfc ? ' is-on' : ''}`}
                    aria-pressed={fCfc}
                    onClick={() => setFCfc((v) => !v)}
                  >
                    Solo con créditos CFC
                  </button>
                </div>
              </div>

              <div className="filter-foot">
                <span className="muted">
                  {filtered.length === courses.length
                    ? `${courses.length} curso${courses.length === 1 ? '' : 's'}`
                    : `${filtered.length} de ${courses.length} cursos`}
                </span>
                {hayFiltros && (
                  <button type="button" className="link-action" onClick={limpiarFiltros}>Limpiar filtros</button>
                )}
              </div>
            </div>
          )}
        </Reveal>

        {courses.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', marginBottom: 44 }}>Pronto habrá cursos disponibles.</p>
        ) : filtered.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', marginBottom: 44 }}>Ningún curso coincide con los filtros.</p>
        ) : (
          <div className="grid grid-4" style={{ marginBottom: 44 }}>
            {filtered.map((c, i) => {
              const pal = temaPalette(c.tema);
              return (
                <Reveal key={c.id} delay={Math.min(i, 8) * 60}>
                  <Link href={`/curso/${c.id}`} className="card press" style={{ display: 'block', height: '100%', textDecoration: 'none', position: 'relative', padding: 0, overflow: 'hidden', borderTop: `4px solid ${pal.main}` }}>
                    {c.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.thumbnail_url} alt="" style={{ width: '100%', height: 96, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ height: 80, background: pal.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', color: pal.text, fontWeight: 700, letterSpacing: 1, padding: '0 10px', textAlign: 'center', fontSize: 14 }}>{c.tema || 'Curso'}</div>
                    )}
                    {!c.enrollment_open && (
                      <span className="badge" style={{ position: 'absolute', top: 8, right: 8, background: 'var(--secondary-dark)', color: '#fff' }}>Próximamente</span>
                    )}
                    <div style={{ padding: 14 }}>
                      {c.tema && <span className="badge" style={{ background: pal.main, color: pal.text, fontSize: 11 }}>{c.tema}</span>}
                      <div style={{ fontWeight: 600, marginTop: 6 }}>{c.title}</div>
                      <div className="muted" style={{ fontSize: 12, margin: '4px 0 8px' }}>
                        {[c.subtema, c.modality].filter(Boolean).join(' · ')}
                        {c.duration_hours ? ` · ${c.duration_hours} h` : ''}
                        {c.cfc ? ` · CFC ${c.cfc}` : ''}
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

        {/* ---------- Desafío ---------- */}
        <Reveal>
          <Link href="/desafios" className="press cta-blink"
            style={{ display: 'block', textDecoration: 'none', color: '#fff', borderRadius: 16, padding: 34, textAlign: 'center',
              background: 'linear-gradient(135deg,#c41e3a,#f59e0b)', boxShadow: 'var(--shadow-md)', marginBottom: 34 }}>
            <div style={{ fontWeight: 800, fontSize: 26 }}>¿Qué tanto sabes de RCP?</div>
            <div style={{ fontSize: 15, opacity: 0.96, marginTop: 8, maxWidth: 560, marginInline: 'auto' }}>
              Ponte a prueba con un desafío y <strong>representa a tu institución</strong> en el ranking. Es gratis.
            </div>
            <div className="btn" style={{ background: '#fff', color: '#c41e3a', fontWeight: 700, marginTop: 16, padding: '10px 22px' }}>
              Aceptar el desafío
            </div>
          </Link>
        </Reveal>

        {/* ---------- Cierre ---------- */}
        <Reveal>
          <div className="card" style={{ textAlign: 'center', marginBottom: 24 }}>
            <h3 style={{ marginBottom: 8 }}>¿Formas parte de un centro o institución?</h3>
            <p className="muted" style={{ maxWidth: 620, margin: '0 auto 14px', fontSize: 14 }}>
              Registra tu institución para formar a tu equipo y que tu alumnado compita en los rankings.
            </p>
            <Link href="/registro" className="btn btn-primary">Registrar mi institución</Link>
          </div>
        </Reveal>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13 }}>
          <Link href="/privacidad">Política de privacidad</Link> · <Link href="/terminos">Condiciones de uso</Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: 8 }}><AppVersion /></p>
      </div>
    </div>
  );
}
