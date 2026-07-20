'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { AppVersion } from '@/components/AppVersion';
import { Reveal } from '@/components/Reveal';
import { temaPalette } from '@/lib/temaColors';
import { PageNav } from '@/components/PageNav';
import { LeadCapture } from '@/components/LeadCapture';
import { Faq, type ItemFaq } from '@/components/Faq';
import { Contacto } from '@/components/Contacto';

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

/**
 * Dudas que más frenan una matrícula. Además de reducir consultas, es texto
 * real indexable: es lo que busca la gente en Google antes de decidirse.
 */
const FAQ: ItemFaq[] = [
  {
    pregunta: '¿Los certificados tienen validez oficial?',
    respuesta: (
      <>
        <p>
          Cada curso indica en su ficha si está acreditado y con cuántos créditos por la Comisión de
          Formación Continuada. Los cursos acreditados llevan el logotipo y el número de expediente
          en el propio certificado.
        </p>
        <p>
          Los créditos de formación continuada del Sistema Nacional de Salud tienen validez en todo el
          territorio nacional. Los cursos no acreditados emiten certificado de aprovechamiento, igualmente
          verificable, pero sin créditos.
        </p>
      </>
    ),
  },
  {
    pregunta: '¿Cómo se comprueba que un certificado es auténtico?',
    respuesta: (
      <p>
        Cada certificado lleva un código único y un código QR. Al escanearlo se abre una página pública
        con los datos del curso, el programa completo y la versión digital del certificado. Cualquier
        empleador o comisión puede comprobarlo al instante, sin cuenta ni permisos.
      </p>
    ),
  },
  {
    pregunta: '¿Cuánto tiempo tengo para completar el curso?',
    respuesta: (
      <p>
        Cada curso tiene sus fechas de inicio y fin, indicadas en su ficha antes de matricularte. Dentro
        de ese plazo estudias a tu ritmo y desde donde quieras: la plataforma guarda tu avance y puedes
        retomarlo en cualquier momento.
      </p>
    ),
  },
  {
    pregunta: '¿Cómo descargo mi certificado?',
    respuesta: (
      <p>
        Se genera automáticamente al superar el curso. Lo encontrarás en la página del curso, dentro de
        tu área de alumno, con un botón de descarga en PDF. Si el curso tiene encuesta de satisfacción,
        hay que responderla antes.
      </p>
    ),
  },
  {
    pregunta: '¿Los cursos son presenciales u online?',
    respuesta: (
      <p>
        Depende del curso: los hay online, presenciales y mixtos, y siempre se indica en su ficha. En los
        presenciales la asistencia se registra en el aula, y hay un mínimo de asistencia exigido para
        obtener el certificado.
      </p>
    ),
  },
  {
    pregunta: '¿Quién imparte la formación?',
    respuesta: (
      <p>
        Profesionales sanitarios en activo. El currículum de cada docente está publicado y es consultable
        desde la ficha de su curso: puedes ver su formación y su experiencia antes de matricularte.
      </p>
    ),
  },
  {
    pregunta: '¿Cómo se paga la matrícula?',
    respuesta: (
      <p>
        Con tarjeta, a través de una pasarela de pago segura; la plataforma no almacena los datos de tu
        tarjeta. Recibirás un justificante de pago descargable. Algunos cursos tienen precio reducido de
        matrícula anticipada: la fecha límite aparece en la ficha.
      </p>
    ),
  },
];

/** Campus de formación: página de captación de la oferta acreditada. */
export default function CampusPage() {
  const [courses, setCourses] = useState<OpenCourse[]>([]);
  const [profes, setProfes] = useState<Array<{ id: string; name: string; headline: string | null; photo_url: string | null }>>([]);
  const [fMatricula, setFMatricula] = useState<'todas' | 'abierta' | 'proximamente'>('todas');
  const [fTema, setFTema] = useState('');
  const [fPublico, setFPublico] = useState('');
  const [fCfc, setFCfc] = useState(false);

  useEffect(() => {
    api<{ courses: OpenCourse[] }>('/api/public/courses').then((r) => setCourses(r.courses)).catch(() => {});
    api<{ profesores: typeof profes }>('/api/public/professors').then((r) => setProfes(r.profesores)).catch(() => {});
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
            {/* Secundario a propósito: el ojo debe ir primero al registro. */}
            <Link href="/login" className="press"
              style={{ textDecoration: 'none', background: 'transparent', color: 'rgba(255,255,255,0.92)',
                border: '1px solid rgba(255,255,255,0.35)', borderRadius: 12, padding: '16px 26px', fontWeight: 600, fontSize: 15 }}>
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
          {courses.length > 0 && (
            <p className="muted" style={{ textAlign: 'center', marginBottom: 20, fontSize: 14 }}>
              Filtra por tema, público o acreditación para encontrar tu curso.
            </p>
          )}

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
          <LeadCapture origen="campus" />
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

        {/* Quién enseña: en formación sanitaria, ver caras y credenciales
            convierte más que cualquier argumento de venta. */}
        {profes.length > 0 && (
          <Reveal>
            <h2 style={{ textAlign: 'center', marginBottom: 6 }}>
              <span className="heading-underline">Quién imparte la formación</span>
            </h2>
            <p className="muted" style={{ textAlign: 'center', marginBottom: 20, fontSize: 14 }}>
              Profesionales sanitarios en activo que imparten los cursos en marcha, con su currículum
              publicado y consultable.
            </p>
            <div className="grid grid-4" style={{ marginBottom: 44 }}>
              {profes.map((p, i) => (
                <Reveal key={p.id} delay={i * 70}>
                  <Link href={`/profesor/${p.id}`} className="card press" style={{ display: 'block', textDecoration: 'none', textAlign: 'center', height: '100%' }}>
                    <div style={{
                      width: 84, height: 84, borderRadius: '50%', margin: '0 auto 10px', overflow: 'hidden',
                      background: 'linear-gradient(135deg,var(--primary-dark),var(--secondary-dark))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 28, fontWeight: 700,
                    }}>
                      {p.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        p.name.split(' ').slice(0, 2).map((n) => n[0]).join('')
                      )}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                    <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{p.headline}</div>
                    <div style={{ fontSize: 12.5, marginTop: 8, color: 'var(--secondary-dark)', fontWeight: 600 }}>Ver currículum →</div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </Reveal>
        )}

        <Reveal><Faq items={FAQ} /></Reveal>

        {/* Captación de docentes: banda propia, para no competir con la
            llamada principal, que es la matrícula de alumnos. */}
        <Reveal>
          <Link href="/docentes" className="press" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
            textDecoration: 'none', marginBottom: 30, padding: '20px 24px', borderRadius: 14,
            border: '1px solid var(--gray-200)', borderLeft: '5px solid #28e0a0', background: '#fff',
          }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 19, color: 'var(--primary-dark)' }}>Eres docente, conócenos</div>
              <div className="muted" style={{ fontSize: 14, marginTop: 4, maxWidth: 620 }}>
                Publica tus cursos sanitarios en el campus: matrículas, cobros, evaluación y certificados
                verificables. Tú fijas el precio y la modalidad.
              </div>
            </div>
            <span className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>Ver condiciones</span>
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
        <div style={{ marginTop: 26 }}><Contacto /></div>
        <p style={{ textAlign: 'center', marginTop: 8 }}><AppVersion /></p>
      </div>
    </div>
  );
}
