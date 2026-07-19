'use client';

import Link from 'next/link';
import { AppVersion } from '@/components/AppVersion';
import { Reveal } from '@/components/Reveal';
import { Faq, type ItemFaq } from '@/components/Faq';
import { PageNav } from '@/components/PageNav';

/**
 * Captación de docentes.
 *
 * La acción protagonista es CONTACTAR, no registrarse: el alta de profesor
 * requiere validación manual y el acuerdo económico se cierra hablando. Por eso
 * crear cuenta e iniciar sesión quedan en segundo plano.
 */

const EMAIL = 'grancanariarcp@gmail.com';
const TELEFONO = '34624707295';
const MAILTO = `mailto:${EMAIL}?subject=${encodeURIComponent('Quiero publicar mis cursos como docente')}`;
const WHATSAPP = `https://wa.me/${TELEFONO}?text=${encodeURIComponent('Hola, soy docente y quiero publicar mis cursos en el campus')}`;

/** Verde de monitor, usado con cuentagotas sobre el azul de marca. */
const VITAL = '#28e0a0';

const PILARES = [
  {
    titulo: 'Certificados verificables',
    texto: 'Cada alumno recibe un certificado con código y QR que cualquiera puede comprobar al instante.',
  },
  {
    titulo: 'Acreditación CFC opcional',
    texto: 'Puedes solicitar la acreditación y los créditos CFC si lo deseas; la plataforma incluye una herramienta que te guía en los requisitos.',
  },
  {
    titulo: 'Tu perfil docente, visible',
    texto: 'Tu currículum sanitario queda publicado y verificable ante tus alumnos.',
  },
];

const PASOS = [
  {
    n: 1,
    titulo: 'Crea tu perfil',
    texto: 'Registras tu cuenta docente y publicas tu currículum, que queda verificable.',
  },
  {
    n: 2,
    titulo: 'Crea tu curso',
    texto: 'Lo montas a tu manera —presencial, online o híbrido—, defines la evaluación y fijas el precio de la matrícula.',
  },
  {
    n: 3,
    titulo: 'Gestiona y cobra',
    texto: 'Registras alumnos, se cobran las matrículas, evalúas y generas los certificados desde un único panel.',
  },
];

const TRAMOS = [
  { nivel: 'Ocasional', detalle: 'Cursos puntuales a lo largo del año', comision: 'Comisión estándar' },
  { nivel: 'Regular', detalle: 'Varias ediciones al año', comision: 'Comisión reducida' },
  { nivel: 'Alto volumen', detalle: 'Programa formativo continuado', comision: 'Comisión mínima' },
];

const VENTAJAS = [
  {
    titulo: 'Tu prestigio, en primer plano',
    texto: 'Tu currículum es público y verificable: los alumnos eligen tu curso sabiendo quién lo firma.',
  },
  {
    titulo: 'Acreditación recomendada, pero tú decides',
    texto: 'Solicitar los créditos CFC da más valor a tus alumnos, pero es opcional y depende de cada docente. Tienes una herramienta guía si decides pedirla.',
  },
  {
    titulo: 'Cero tecnología por tu parte',
    texto: 'Alojamiento, pagos, evaluación, certificados y verificación los ponemos nosotros.',
  },
  {
    titulo: 'Llega a más alumnos',
    texto: 'Sumas tu propia audiencia y el alumnado del campus.',
  },
];

const FAQ_DOCENTES: ItemFaq[] = [
  {
    pregunta: '¿Cuánto cuesta empezar?',
    respuesta: (
      <p>
        No hay cuota fija obligatoria. Compartes comisión solo cuando tienes matrículas, y los detalles se
        acuerdan contigo según tu volumen.
      </p>
    ),
  },
  {
    pregunta: '¿Puedo dar cursos presenciales o híbridos?',
    respuesta: (
      <p>
        Sí: presenciales, 100 % online o híbridos. En los presenciales la asistencia se registra en el aula con
        un código QR, y también puedes pasar lista a mano.
      </p>
    ),
  },
  {
    pregunta: '¿Quién fija el precio?',
    respuesta: (
      <p>
        Tú. El precio de cada matrícula lo decides tú, y puedes establecer un precio reducido de matrícula
        anticipada con fecha límite.
      </p>
    ),
  },
  {
    pregunta: '¿La acreditación CFC es obligatoria?',
    respuesta: (
      <p>
        No, es opcional y recomendable. Puedes solicitarla por tu cuenta y la plataforma te acompaña con una
        herramienta que revisa si tu curso cumple los requisitos habituales.
      </p>
    ),
  },
  {
    pregunta: '¿Necesito saber de tecnología?',
    respuesta: (
      <p>
        No. La plataforma se ocupa de todo lo técnico: alojamiento, cobros, evaluación y emisión de
        certificados.
      </p>
    ),
  },
];

function BotonesContacto({ variante = 'claro' }: { variante?: 'claro' | 'oscuro' }) {
  const principal = variante === 'oscuro'
    ? { background: '#fff', color: 'var(--primary-dark)' }
    : { background: 'var(--primary-dark)', color: '#fff' };
  const secundario = variante === 'oscuro'
    ? { background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.5)' }
    : { background: 'transparent', color: 'var(--primary-dark)', border: '1px solid var(--gray-300)' };

  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
      <a href={MAILTO} className="btn press" style={{ ...principal, fontWeight: 700, padding: '14px 26px', fontSize: 16 }}>
        Contacta y solicita tu presupuesto
      </a>
      <a href={WHATSAPP} target="_blank" rel="noreferrer" className="btn press"
        style={{ ...secundario, fontWeight: 600, padding: '14px 24px', fontSize: 15 }}>
        WhatsApp
      </a>
    </div>
  );
}

export default function DocentesPage() {
  return (
    <div style={{ minHeight: '100vh' }}>
      {/* ---------------------------------------------------------- Portada */}
      <div style={{
        background: 'linear-gradient(135deg,var(--primary-dark) 0%,var(--secondary-dark) 60%,#0d9488 100%)',
        color: '#fff', padding: '30px 16px 52px',
      }}>
        <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ textAlign: 'left' }}>
            <PageNav backHref="/" backLabel="Campus" light />
          </div>

          <div className="animate-fade">
            <img src="/logo-horizontal-negativo.png" alt="Gran Canaria RCP"
              style={{ maxWidth: 230, width: '100%' }} />

            <h1 style={{ fontSize: 33, marginTop: 18, lineHeight: 1.18 }}>
              Ya enseñas. Ahora gestiónalos y llega a más alumnos.
            </h1>

            <p style={{ fontSize: 16.5, opacity: 0.95, maxWidth: 680, margin: '16px auto 0', lineHeight: 1.55 }}>
              Publica tus cursos de contenido sanitario en un campus online. Tú creas tus cursos de manera
              personalizada —presenciales, 100 % online o híbridos— y decides el precio de la matrícula;
              nosotros te damos las herramientas para registrar, cobrar, evaluar, generar certificados
              verificables y llegar a más alumnos potenciales.
            </p>
          </div>

          <div className="animate-in" style={{ marginTop: 26 }}>
            <BotonesContacto variante="oscuro" />
            <p style={{ fontSize: 13.5, opacity: 0.9, marginTop: 12 }}>
              Sin cuotas fijas obligatorias: solo compartes comisión cuando tienes matrículas.
            </p>
          </div>

          {/* Acceso en segundo plano: la acción protagonista es contactar. */}
          <p style={{ fontSize: 13, opacity: 0.72, marginTop: 22 }}>
            <Link href="/registro-profesor" style={{ color: 'rgba(255,255,255,0.85)' }}>Crear cuenta docente</Link>
            {' · '}
            <Link href="/login/admin" style={{ color: 'rgba(255,255,255,0.85)' }}>Iniciar sesión</Link>
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '34px 16px' }}>

        {/* ------------------------------------------------------- Confianza */}
        <div className="grid grid-3" style={{ marginBottom: 46 }}>
          {PILARES.map((p, i) => (
            <Reveal key={p.titulo} delay={i * 80}>
              <div className="card" style={{ height: '100%', textAlign: 'center', borderTop: `4px solid ${VITAL}` }}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--primary-dark)' }}>{p.titulo}</div>
                <div className="muted" style={{ fontSize: 13.5 }}>{p.texto}</div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* ---------------------------------------------------- Cómo funciona */}
        <Reveal>
          <h2 style={{ textAlign: 'center', marginBottom: 22 }}>
            <span className="heading-underline">Cómo funciona</span>
          </h2>
        </Reveal>
        <div className="grid grid-3" style={{ marginBottom: 46 }}>
          {PASOS.map((p, i) => (
            <Reveal key={p.n} delay={i * 90}>
              <div className="card" style={{ height: '100%' }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%', background: 'var(--primary-dark)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 17, marginBottom: 10,
                }}>{p.n}</div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{p.titulo}</div>
                <div className="muted" style={{ fontSize: 13.5 }}>{p.texto}</div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* --------------------------------------------------------- Comisión */}
        <Reveal>
          <div className="card" style={{ marginBottom: 46, borderLeft: `4px solid ${VITAL}` }}>
            <h2 style={{ fontSize: 22, marginBottom: 10 }}>Cuantos más cursos impartes, menos comisión pagas.</h2>
            <p style={{ fontSize: 15, marginBottom: 20, maxWidth: 720 }}>
              La comisión baja a medida que aumentan tus cursos y tus matriculaciones. Sabemos que la mayoría de
              docentes imparten de forma esporádica, por eso no aplicamos cuotas mensuales fijas por defecto:
              cada acuerdo se adapta a tu ritmo.
            </p>

            <div className="grid grid-3" style={{ gap: 12, marginBottom: 20 }}>
              {TRAMOS.map((t, i) => (
                <div key={t.nivel} style={{
                  padding: 16, borderRadius: 10, border: '1px solid var(--gray-200)',
                  background: i === TRAMOS.length - 1 ? 'var(--gray-100)' : '#fff',
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{t.nivel}</div>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{t.detalle}</div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--primary-dark)' }}>{t.comision}</div>
                </div>
              ))}
            </div>

            <p className="muted" style={{ fontSize: 12.5, marginBottom: 18 }}>
              Escala orientativa. El tramo y las condiciones concretas se acuerdan contigo.
            </p>

            <BotonesContacto />
          </div>
        </Reveal>

        {/* -------------------------------------------------------- Por qué aquí */}
        <Reveal>
          <h2 style={{ textAlign: 'center', marginBottom: 22 }}>
            <span className="heading-underline">Por qué aquí</span>
          </h2>
        </Reveal>
        <div className="grid grid-2" style={{ marginBottom: 46 }}>
          {VENTAJAS.map((v, i) => (
            <Reveal key={v.titulo} delay={i * 70}>
              <div className="card" style={{ height: '100%' }}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--primary-dark)' }}>{v.titulo}</div>
                <div className="muted" style={{ fontSize: 13.5 }}>{v.texto}</div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* ------------------------------------------------------------- FAQ */}
        <Reveal><Faq items={FAQ_DOCENTES} /></Reveal>

        {/* -------------------------------------------------------- Cierre */}
        <Reveal>
          <div style={{
            background: 'linear-gradient(135deg,var(--primary-dark) 0%,var(--secondary-dark) 70%,#0d9488 100%)',
            color: '#fff', borderRadius: 16, padding: '36px 24px', textAlign: 'center', marginBottom: 30,
          }}>
            <h2 style={{ fontSize: 25, marginBottom: 18 }}>¿Listo para publicar tu formación?</h2>
            <BotonesContacto variante="oscuro" />
            <p style={{ fontSize: 13, opacity: 0.9, marginTop: 16 }}>
              O escríbenos a <a href={MAILTO} style={{ color: '#fff' }}>{EMAIL}</a> · +34 624 707 295
            </p>
          </div>
        </Reveal>

        <p style={{ textAlign: 'center', fontSize: 13 }}>
          <Link href="/privacidad">Política de privacidad</Link> · <Link href="/terminos">Condiciones de uso</Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: 8 }}><AppVersion /></p>
      </div>
    </div>
  );
}
