'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { AppVersion } from '@/components/AppVersion';
import { Reveal } from '@/components/Reveal';
import { StickyCampusBar } from '@/components/StickyCampusBar';
import { temaPalette } from '@/lib/temaColors';
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
}
interface Challenge { id: string; title: string; audience?: string; num_questions: number; seconds_per_question?: number; participants: string }

/**
 * Portada pública y GRATUITA: divulgación de soporte vital básico y primeros
 * auxilios para población general (desafíos, práctica libre y cursos gratuitos),
 * con un salto muy visible a la formación oficial con certificado (/campus).
 */
export default function Home() {
  const [courses, setCourses] = useState<OpenCourse[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);

  useEffect(() => {
    api<{ courses: OpenCourse[] }>('/api/public/courses').then((r) => setCourses(r.courses)).catch(() => {});
    api<{ challenges: Challenge[] }>('/api/public/challenges').then((r) => setChallenges(r.challenges)).catch(() => {});
  }, []);

  const gratuitos = courses.filter((c) => c.price_cents === 0 && c.enrollment_open);
  const conCertificado = courses.filter((c) => c.price_cents > 0 || c.cfc);

  return (
    <div style={{ minHeight: '100vh', padding: '32px 16px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* Portada */}
        <div className="animate-fade" style={{ textAlign: 'center', marginBottom: 30 }}>
          <img src="/logo-horizontal.png" alt="Gran Canaria RCP" style={{ maxWidth: 320, width: '100%' }} />
          <h1 style={{ marginTop: 12, fontSize: 32, lineHeight: 1.15 }}>
            <span className="shine-text">Saber reanimar salva vidas</span>
          </h1>
          <p className="muted" style={{ maxWidth: 620, margin: '12px auto 0', fontSize: 16 }}>
            Aprende <strong>soporte vital básico</strong> y <strong>primeros auxilios</strong> gratis, ponte a prueba
            en los desafíos y compite representando a tu institución.
          </p>
        </div>

        {/* Desafío destacado */}
        <div style={{ maxWidth: 560, margin: '0 auto 16px' }}>
          <Link href="/desafios" className="press cta-blink animate-in"
            style={{ display: 'block', textAlign: 'center', textDecoration: 'none', color: '#fff', borderRadius: 14, padding: 30,
              background: 'linear-gradient(135deg,#c41e3a,#f59e0b)', boxShadow: 'var(--shadow-md)' }}>
            <div style={{ fontWeight: 800, fontSize: 24 }}>¿Qué tanto sabes de RCP?</div>
            {/* Explicar el formato en una línea: "competir representando a tu
                institución" no dice nada a quien llega por primera vez. */}
            <div style={{ fontSize: 14.5, opacity: 0.97, marginTop: 8, maxWidth: 470, marginInline: 'auto', lineHeight: 1.45 }}>
              Responde <strong>10 preguntas rápidas</strong> sobre reanimación y primeros auxilios,
              con pocos segundos por pregunta. Al terminar ves tu resultado y tu puesto en el ranking.
            </div>
            <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 8 }}>
              {challenges.length > 0
                ? `${challenges.length} desafío(s) activos · gratis · también para menores`
                : 'Gratis · sin instalar nada · también para menores'}
            </div>
          </Link>
        </div>

        {/* Accesos */}
        <div className="grid grid-2" style={{ maxWidth: 560, margin: '0 auto 14px' }}>
          <Link href="/practica" className="press animate-in"
            style={{ textAlign: 'center', textDecoration: 'none', color: '#fff', borderRadius: 12, padding: 20,
              background: 'linear-gradient(135deg,#2c5282,#276749)', boxShadow: 'var(--shadow-md)' }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>Práctica libre</div>
            <div style={{ fontSize: 12.5, opacity: 0.95, marginTop: 4 }}>Entrena sin límite</div>
          </Link>
          <Link href="/login" className="press animate-in"
            style={{ textAlign: 'center', textDecoration: 'none', color: '#fff', borderRadius: 12, padding: 20,
              background: 'linear-gradient(135deg,var(--primary-dark),var(--secondary-dark))', boxShadow: 'var(--shadow-md)' }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>Acceso</div>
            <div style={{ fontSize: 12.5, opacity: 0.95, marginTop: 4 }}>Ya tengo cuenta</div>
          </Link>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Link href="/registro" className="btn" style={{ background: 'linear-gradient(135deg,#276749,#10b981)', color: '#fff', fontWeight: 700, padding: '12px 26px' }}>Regístrate</Link>
        </div>

        {/* Formación gratuita */}
        <Reveal>
          <h2 style={{ textAlign: 'center', marginBottom: 6 }}>
            <span className="heading-underline">Formación gratuita</span>
          </h2>
          <p className="muted" style={{ textAlign: 'center', marginBottom: 20, fontSize: 14 }}>
            Contenidos abiertos de soporte vital básico y primeros auxilios para toda la población.
          </p>
        </Reveal>

        {gratuitos.length > 0 ? (
          <div className="grid grid-3" style={{ marginBottom: 40 }}>
            {gratuitos.map((c, i) => {
              const pal = temaPalette(c.tema);
              return (
                <Reveal key={c.id} delay={i * 70}>
                  <Link href={`/curso/${c.id}`} className="card press" style={{ display: 'block', textDecoration: 'none', padding: 0, overflow: 'hidden', borderTop: `4px solid ${pal.main}` }}>
                    {c.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.thumbnail_url} alt="" style={{ width: '100%', height: 96, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ height: 80, background: pal.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', color: pal.text, fontWeight: 700, fontSize: 14, padding: '0 10px', textAlign: 'center' }}>{c.tema || 'Formación'}</div>
                    )}
                    <div style={{ padding: 14 }}>
                      <div style={{ fontWeight: 600 }}>{c.title}</div>
                      <div className="muted" style={{ fontSize: 12, margin: '4px 0 8px' }}>
                        {[c.subtema, c.modality].filter(Boolean).join(' · ')}{c.duration_hours ? ` · ${c.duration_hours} h` : ''}
                      </div>
                      <span className="badge badge-success">Gratis</span>
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        ) : (
          <Reveal>
            <div className="card" style={{ textAlign: 'center', marginBottom: 40 }}>
              <p className="muted" style={{ margin: 0 }}>
                Estamos preparando los contenidos gratuitos. Mientras tanto, entrena en la{' '}
                <Link href="/practica">práctica libre</Link> o ponte a prueba en los{' '}
                <Link href="/desafios">desafíos</Link>.
              </p>
            </div>
          </Reveal>
        )}

        {/* Para maestros y profesorado */}
        <Reveal>
          <div className="card" style={{ marginBottom: 40, borderLeft: '4px solid #0d9488' }}>
            <div className="card-header"><div className="card-title">¿Eres maestro o docente?</div></div>
            <p style={{ marginBottom: 12 }}>
              Registra tu centro, crea tus clases y reparte códigos para que tu alumnado participe en los desafíos
              <strong> representando a vuestra institución</strong>. Sin recoger datos personales de los menores:
              solo un apodo y su edad.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href="/registro" className="btn btn-primary btn-small">Registrar mi institución</Link>
              <Link href="/rankings" className="btn btn-outline btn-small">Ver el ranking de instituciones</Link>
            </div>
          </div>
        </Reveal>

        {/* Salto al campus de pago */}
        <Reveal>
          <Link href="/" id="bloque-campus" className="press cta-blink"
            style={{ display: 'block', textDecoration: 'none', color: '#fff', borderRadius: 16, padding: 34, textAlign: 'center',
              background: 'linear-gradient(135deg,var(--primary-dark) 0%,var(--secondary-dark) 55%,#0d9488 100%)',
              boxShadow: 'var(--shadow-md)', marginBottom: 40 }}>
            <div style={{ fontSize: 13, letterSpacing: 2, opacity: 0.9, textTransform: 'uppercase' }}>Formación oficial</div>
            <div style={{ fontWeight: 800, fontSize: 26, marginTop: 6 }}>Fórmate con certificado</div>
            <div style={{ fontSize: 14, opacity: 0.95, marginTop: 8, maxWidth: 520, marginInline: 'auto' }}>
              Cursos acreditados con evaluación y <strong>certificado verificable por QR</strong>
              {conCertificado.length > 0 && <> · {conCertificado.length} curso(s) en el campus</>}
            </div>
            <div className="btn" style={{ background: '#fff', color: 'var(--primary-dark)', fontWeight: 700, marginTop: 16, padding: '10px 22px' }}>
              Ver la oferta del campus
            </div>
          </Link>
        </Reveal>

        <p style={{ textAlign: 'center', marginTop: 32, fontSize: 13 }}>
          <Link href="/privacidad">Política de privacidad</Link> · <Link href="/terminos">Condiciones de uso</Link>
        </p>
        <div style={{ marginTop: 26 }}><Contacto /></div>
        <p style={{ textAlign: 'center', marginTop: 8 }}><AppVersion /></p>
      </div>

      {/* Llamada al campus siempre visible mientras se navega la zona gratuita */}
      <StickyCampusBar anchorId="bloque-campus" />
    </div>
  );
}
