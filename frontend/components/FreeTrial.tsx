'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';

/**
 * Test gratuito sin registro y muro posterior.
 *
 * Se deja probar UNA ronda antes de pedir nada: quien llega al resultado ya
 * está interesado, y ese registro convierte mucho más que un muro por delante.
 * El muro aparece con la nota delante, que es el gancho.
 *
 * El testigo lo genera el navegador y no identifica a nadie: solo evita que la
 * misma sesión repita la ronda gratuita.
 */

const CLAVE = 'rcp_visitor';

function testigo(): string {
  let v = localStorage.getItem(CLAVE);
  if (!v) {
    v = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/[^a-zA-Z0-9-]/g, '');
    localStorage.setItem(CLAVE, v);
  }
  return v;
}

interface Pregunta { id: string; text: string; options: string[]; tema: string | null; category: string | null }
interface Revision { id: string; correcta: number; marcada: number | null; acierto: boolean; explicacion: string | null }

export function FreeTrial() {
  const [fase, setFase] = useState<'intro' | 'test' | 'resultado' | 'agotado'>('intro');
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [idx, setIdx] = useState(0);
  const [respuestas, setRespuestas] = useState<Record<string, number | null>>({});
  const [resultado, setResultado] = useState<{ total: number; correct: number; revision: Revision[] } | null>(null);
  const [inicio, setInicio] = useState(0);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const comprobar = useCallback(async () => {
    try {
      const r = await api<{ requiereRegistro: boolean }>(`/api/public/practice/status?visitor=${testigo()}`);
      if (r.requiereRegistro) setFase('agotado');
    } catch { /* si falla, se deja intentar */ }
  }, []);

  useEffect(() => { comprobar(); }, [comprobar]);

  async function empezar() {
    setCargando(true);
    setError('');
    try {
      const r = await api<{ questions: Pregunta[] }>('/api/public/practice/start', {
        method: 'POST', body: JSON.stringify({ visitor: testigo() }),
      });
      setPreguntas(r.questions);
      setRespuestas({});
      setIdx(0);
      setInicio(Date.now());
      setFase('test');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'REGISTRO_REQUERIDO') setFase('agotado');
      else setError(e instanceof Error ? e.message : 'No se pudo empezar el test');
    } finally {
      setCargando(false);
    }
  }

  async function enviar() {
    setCargando(true);
    try {
      const r = await api<{ total: number; correct: number; revision: Revision[] }>('/api/public/practice/submit', {
        method: 'POST',
        body: JSON.stringify({
          visitor: testigo(),
          answers: respuestas,
          seconds: Math.round((Date.now() - inicio) / 1000),
          origen: 'practica',
        }),
      });
      setResultado(r);
      setFase('resultado');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo corregir el test');
    } finally {
      setCargando(false);
    }
  }

  // ------------------------------------------------------------------ intro
  if (fase === 'intro') {
    return (
      <div className="card animate-pop" style={{ textAlign: 'center', borderTop: '4px solid var(--success)' }}>
        <h2 style={{ fontSize: 22, marginBottom: 8 }}>Prueba gratis, sin registrarte</h2>
        <p className="muted" style={{ maxWidth: 520, margin: '0 auto 18px', fontSize: 15 }}>
          Haz un test de <strong>10 preguntas</strong> de soporte vital básico y descubre tu nivel.
          No necesitas cuenta ni dejar ningún dato.
        </p>
        {error && <p className="alert alert-error">{error}</p>}
        <button className="btn btn-primary press cta-blink" style={{ padding: '14px 30px', fontSize: 16, fontWeight: 700 }}
          onClick={empezar} disabled={cargando}>
          {cargando ? 'Preparando…' : 'Empezar mi test gratuito'}
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------- ya agotado
  if (fase === 'agotado') return <Muro titulo="Ya has hecho tu test gratuito" />;

  // ------------------------------------------------------------------- test
  if (fase === 'test') {
    const q = preguntas[idx];
    const marcada = respuestas[q.id];
    const ultima = idx === preguntas.length - 1;

    return (
      <div className="card animate-pop">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span className="muted" style={{ fontSize: 13 }}>Pregunta {idx + 1} de {preguntas.length}</span>
          {q.tema && <span className="badge">{q.tema}</span>}
        </div>
        <div style={{ height: 5, background: 'var(--gray-200)', borderRadius: 999, overflow: 'hidden', marginBottom: 18 }}>
          <div style={{ height: '100%', width: `${((idx + 1) / preguntas.length) * 100}%`, background: 'var(--success)', transition: 'width .3s ease' }} />
        </div>

        <p style={{ fontSize: 17, fontWeight: 600, marginBottom: 16 }}>{q.text}</p>

        <div style={{ display: 'grid', gap: 8, marginBottom: 18 }}>
          {q.options.map((op, i) => (
            <button key={i} type="button" onClick={() => setRespuestas({ ...respuestas, [q.id]: i })}
              style={{
                textAlign: 'left', padding: '12px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 15,
                border: marcada === i ? '2px solid var(--primary-dark)' : '1px solid var(--gray-300)',
                background: marcada === i ? 'var(--gray-100)' : '#fff',
              }}>
              <strong style={{ marginRight: 8 }}>{String.fromCharCode(65 + i)}.</strong>{op}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <button className="btn btn-outline btn-small" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Anterior</button>
          {ultima ? (
            <button className="btn btn-primary press" onClick={enviar} disabled={cargando}>
              {cargando ? 'Corrigiendo…' : 'Ver mi resultado'}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => setIdx(idx + 1)}>Siguiente</button>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------- resultado
  const pct = resultado ? Math.round((resultado.correct / resultado.total) * 100) : 0;
  const mensaje = pct >= 80 ? '¡Muy bien! Dominas lo esencial.'
    : pct >= 50 ? 'Vas por buen camino, pero hay margen de mejora.'
      : 'Hay bastante que repasar, y eso puede salvar una vida.';

  return (
    <>
      <div className="card animate-pop" style={{ textAlign: 'center', borderTop: '4px solid var(--primary-dark)', marginBottom: 16 }}>
        <div className="muted" style={{ fontSize: 13 }}>Tu resultado</div>
        <div style={{ fontSize: 46, fontWeight: 800, color: pct >= 50 ? 'var(--success)' : 'var(--danger)', lineHeight: 1.1 }}>
          {resultado?.correct}<span style={{ fontSize: 24, color: 'var(--gray-500)' }}> / {resultado?.total}</span>
        </div>
        <p style={{ fontSize: 16, marginTop: 6 }}>{mensaje}</p>
      </div>

      <Muro titulo="Regístrate gratis para seguir" resultado={pct} />

      {/* La revisión va DESPUÉS del muro: aporta valor y sostiene el interés. */}
      {resultado && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header"><div className="card-title">Revisión de tus respuestas</div></div>
          {resultado.revision.map((r, i) => {
            const q = preguntas.find((p) => p.id === r.id);
            if (!q) return null;
            return (
              <div key={r.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--gray-100)' }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                  <span style={{ color: r.acierto ? 'var(--success)' : 'var(--danger)' }}>{r.acierto ? '✓' : '✗'}</span>{' '}
                  {i + 1}. {q.text}
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  Respuesta correcta: <strong>{q.options[r.correcta]}</strong>
                </div>
                {r.explicacion && <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{r.explicacion}</div>}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/** Muro de registro, con el resultado recién obtenido como argumento. */
function Muro({ titulo, resultado }: { titulo: string; resultado?: number }) {
  return (
    <div className="card animate-pop" style={{ textAlign: 'center', borderTop: '4px solid var(--success)' }}>
      <h2 style={{ fontSize: 21, marginBottom: 8 }}>{titulo}</h2>
      <p className="muted" style={{ maxWidth: 520, margin: '0 auto 16px', fontSize: 15 }}>
        {resultado !== undefined && resultado < 80 && <>Puedes mejorar ese resultado. </>}
        Con una cuenta gratuita practicas <strong>sin límite</strong>, repasas solo tus fallos, sigues tu
        evolución y consigues <strong>diplomas por tus horas de práctica</strong>.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href="/registro" className="btn press cta-blink"
          style={{ background: 'linear-gradient(135deg,#276749,#10b981)', color: '#fff', fontWeight: 700, padding: '13px 26px' }}>
          Crear mi cuenta gratis
        </Link>
        <Link href="/login" className="btn btn-outline press">Ya tengo cuenta</Link>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
        Registrarse es gratis y no cuesta nada mantenerlo.
      </p>
    </div>
  );
}
