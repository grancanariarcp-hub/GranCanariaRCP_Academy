'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { PageNav } from '@/components/PageNav';
import { useSession } from '@/hooks/useSession';
import { api, ApiError } from '@/lib/api';
import { TestBuilder, type BancoConv, type ConfigTest } from '@/components/TestBuilder';

/**
 * Generar y realizar un test de oposición.
 *
 * Tres fases: configurar, responder y revisar. En corrección inmediata la
 * justificación aparece bajo cada pregunta según se responde; en corrección
 * final, todo queda para el repaso del terminado.
 */

interface Convocatoria { id: string; name: string; comunidad: string | null; anio: number | null; bancos: BancoConv[] }
interface Pregunta { id: string; text: string; options: string[]; tema: string | null; orden: number | null; banco: string | null }
interface TestPrevio {
  id: string; criterio: string; rango_desde: number | null; rango_hasta: number | null;
  temas: string[] | null; minutos: number | null; correccion: string; preguntas: number;
  correct: number | null; total: number | null; started_at: string; submitted_at: string | null;
  bancos: string | null; repite_de: string | null;
}
interface Correccion { correcta: number; explicacion: string | null; fuente: { documento: string; pagina: number | null } | null }
interface FilaRevision {
  n: number; id: string; numeroEnBanco: number | null; tema: string | null; text: string; options: string[];
  marcada: number | null; correcta: number; acierto: boolean; explicacion: string | null;
  fuente: { documento: string; pagina: number | null } | null;
}

export default function TestOpePage() {
  const user = useSession(['student'], '/login/student');
  const [convs, setConvs] = useState<Convocatoria[]>([]);
  const [convSel, setConvSel] = useState('');

  const [testId, setTestId] = useState('');
  const [cfg, setCfg] = useState<ConfigTest | null>(null);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [respuestas, setRespuestas] = useState<Record<string, number | null>>({});
  const [correcciones, setCorrecciones] = useState<Record<string, Correccion>>({});
  const [idx, setIdx] = useState(0);
  const [inicio, setInicio] = useState(0);
  const [restante, setRestante] = useState<number | null>(null);
  const [resultado, setResultado] = useState<{ correct: number; total: number; pct: number; revision: FilaRevision[] } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [previos, setPrevios] = useState<TestPrevio[]>([]);

  useEffect(() => {
    if (!user) return;
    api<{ convocatorias: Convocatoria[] }>('/api/practice/convocatorias', { auth: true })
      .then((r) => { setConvs(r.convocatorias); if (r.convocatorias[0]) setConvSel(r.convocatorias[0].id); })
      .catch(() => {});
    cargarPrevios();
  }, [user]);

  function cargarPrevios() {
    api<{ tests: TestPrevio[] }>('/api/practice/tests', { auth: true })
      .then((r) => setPrevios(r.tests))
      .catch(() => {});
  }

  // Cuenta atrás: al llegar a cero se corrige solo, como en el examen real.
  useEffect(() => {
    if (restante === null || resultado) return;
    if (restante <= 0) { enviar(); return; }
    const t = setTimeout(() => setRestante((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restante, resultado]);

  const conv = useMemo(() => convs.find((c) => c.id === convSel), [convs, convSel]);

  function alGenerar(r: any, config: ConfigTest) {
    setTestId(r.testId);
    setCfg(config);
    setPreguntas(r.questions);
    setAviso(r.aviso);
    setRespuestas({});
    setCorrecciones({});
    setIdx(0);
    setResultado(null);
    setInicio(Date.now());
    setRestante(config.minutos ? config.minutos * 60 : null);
  }

  async function responder(q: Pregunta, opcion: number) {
    setRespuestas((r) => ({ ...r, [q.id]: opcion }));
    if (cfg?.correccion === 'inmediata' && !correcciones[q.id]) {
      try {
        const c = await api<Correccion>(`/api/practice/tests/${testId}/answer/${q.id}`, { auth: true });
        setCorrecciones((cs) => ({ ...cs, [q.id]: c }));
      } catch { /* si falla, se verá al corregir el conjunto */ }
    }
  }

  // Un test corregido no puede perderse en silencio: si algo falla, el opositor
  // tiene que enterarse y poder reintentarlo, no quedarse pulsando un botón
  // muerto creyendo que la plataforma le ha tragado el examen.
  async function enviar() {
    if (enviando || resultado) return;
    setEnviando(true);
    setFallo(null);
    try {
      const r: any = await api(`/api/practice/tests/${testId}/submit`, {
        method: 'POST', auth: true,
        body: JSON.stringify({ answers: respuestas, seconds: Math.round((Date.now() - inicio) / 1000) }),
      });
      setResultado(r);
      setRestante(null);
      cargarPrevios();
    } catch (e) {
      setFallo(e instanceof ApiError
        ? `No se ha podido corregir: ${e.message}`
        : 'No se ha podido corregir. Comprueba tu conexión y vuelve a intentarlo; tus respuestas siguen aquí.');
    } finally {
      setEnviando(false);
    }
  }

  async function repetir(id: string) {
    setFallo(null);
    try {
      const r = await api<any>(`/api/practice/tests/${id}/repeat`, { method: 'POST', auth: true });
      alGenerar(r, {
        bankIds: [], criterio: r.config.criterio, count: r.config.servidas,
        minutos: r.config.minutos, correccion: r.config.correccion, barajarPreguntas: true,
      });
    } catch (e) {
      setFallo(e instanceof ApiError
        ? `No se ha podido repetir el test: ${e.message}`
        : 'No se ha podido repetir el test.');
    }
  }

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  const nav = [
    { label: 'Inicio', href: '/student' },
    { label: 'Oposiciones', href: '/student/ope' },
    { label: 'Generar test', href: '/student/ope/test', active: true },
        { label: 'Estadísticas', href: '/student/ope/estadisticas' },
  ];
  const reloj = restante !== null
    ? `${String(Math.floor(restante / 60)).padStart(2, '0')}:${String(restante % 60).padStart(2, '0')}`
    : null;

  return (
    <AppShell user={user} title="Generar test" nav={nav}>
      <PageNav backHref="/student/ope" backLabel="Volver a oposiciones" />

      {/* ------------------------------------------------------ configurar */}
      {!testId && (
        convs.length === 0 ? (
          <div className="card">
            <p className="muted" style={{ margin: 0 }}>
              Todavía no hay convocatorias publicadas. En cuanto se publique la tuya podrás generar
              tests con sus bancos. Mientras, entrena en la <Link href="/practica">práctica libre</Link>.
            </p>
          </div>
        ) : (
          <>
            {convs.length > 1 && (
              <div className="card" style={{ marginBottom: 18 }}>
                <label className="form-label" htmlFor="conv">Convocatoria</label>
                <select id="conv" className="form-select" value={convSel} onChange={(e) => setConvSel(e.target.value)}>
                  {convs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.comunidad ? ` · ${c.comunidad}` : ''}{c.anio ? ` · ${c.anio}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {conv && conv.bancos.length > 0
              ? <TestBuilder bancos={conv.bancos} onGenerado={alGenerar} />
              : <div className="card"><p className="muted" style={{ margin: 0 }}>Esta convocatoria aún no tiene bancos asignados.</p></div>}

            {/* Repetir un test anterior: mismas condiciones, preguntas barajadas */}
            {previos.length > 0 && (
              <div className="card" style={{ marginTop: 20 }}>
                <div className="card-header">
                  <div className="card-title">Tus tests anteriores</div>
                  <div className="card-subtitle">Repite cualquiera con sus mismas condiciones y las preguntas barajadas</div>
                </div>
                <div className="table-responsive">
                  <table className="table-plain">
                    <thead>
                      <tr><th>Test</th><th>Fecha</th><th>Resultado</th><th></th></tr>
                    </thead>
                    <tbody>
                      {previos.map((t) => (
                        <tr key={t.id}>
                          <td>
                            <strong>{t.preguntas} preguntas</strong>
                            {t.repite_de && <span className="badge" style={{ marginLeft: 6, fontSize: 11 }}>repetición</span>}
                            <div className="muted" style={{ fontSize: 12 }}>
                              {t.criterio === 'rango' ? `Nº ${t.rango_desde}–${t.rango_hasta}`
                                : t.criterio === 'tema' ? (t.temas || []).join(', ')
                                  : 'Aleatorias'}
                              {t.minutos ? ` · ${t.minutos} min` : ' · sin tiempo'}
                              {t.correccion === 'inmediata' ? ' · corrección inmediata' : ''}
                              {t.bancos && ` · ${t.bancos}`}
                            </div>
                          </td>
                          <td className="muted" style={{ fontSize: 13 }}>
                            {new Date(t.started_at).toLocaleDateString('es-ES')}
                          </td>
                          <td>
                            {t.submitted_at && t.total
                              ? <strong style={{ color: (t.correct ?? 0) / t.total >= 0.5 ? 'var(--success)' : 'var(--danger)' }}>
                                {t.correct}/{t.total}
                              </strong>
                              : <span className="muted">sin terminar</span>}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="link-action" onClick={() => repetir(t.id)}>Repetir</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )
      )}

      {/* --------------------------------------------------------- responder */}
      {testId && !resultado && preguntas.length > 0 && (() => {
        const q = preguntas[idx];
        const marcada = respuestas[q.id];
        const corr = correcciones[q.id];
        return (
          <div className="card">
            {aviso && <p className="alert alert-error">{aviso}</p>}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10, flexWrap: 'wrap' }}>
              <span className="muted" style={{ fontSize: 13 }}>
                Pregunta {idx + 1} de {preguntas.length}
                {q.orden && <> · nº {q.orden} del banco</>}
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {q.tema && <span className="badge">{q.tema}</span>}
                {reloj && (
                  <span className={`badge ${restante !== null && restante < 60 ? 'badge-warning' : ''}`}
                    style={{ fontVariantNumeric: 'tabular-nums', fontSize: 14 }}>⏱ {reloj}</span>
                )}
              </div>
            </div>

            <div style={{ height: 5, background: 'var(--gray-200)', borderRadius: 999, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ height: '100%', width: `${((idx + 1) / preguntas.length) * 100}%`, background: 'var(--primary-dark)', transition: 'width .3s ease' }} />
            </div>

            <p style={{ fontSize: 17, fontWeight: 600, marginBottom: 14 }}>{q.text}</p>

            <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
              {q.options.map((op, i) => {
                // Con corrección inmediata, se colorea en cuanto se responde.
                const resuelta = !!corr;
                const esCorrecta = resuelta && i === corr.correcta;
                const esFallo = resuelta && marcada === i && i !== corr.correcta;
                return (
                  <button key={i} type="button" disabled={resuelta}
                    onClick={() => responder(q, i)}
                    style={{
                      textAlign: 'left', padding: '12px 14px', borderRadius: 10, fontSize: 15,
                      cursor: resuelta ? 'default' : 'pointer',
                      border: esCorrecta ? '2px solid var(--success)'
                        : esFallo ? '2px solid var(--danger)'
                          : marcada === i ? '2px solid var(--primary-dark)' : '1px solid var(--gray-300)',
                      background: esCorrecta ? '#e9f7ef' : esFallo ? '#fdecec' : marcada === i ? 'var(--gray-100)' : '#fff',
                    }}>
                    <strong style={{ marginRight: 8 }}>{String.fromCharCode(65 + i)}.</strong>{op}
                    {esCorrecta && <span style={{ float: 'right', color: 'var(--success)' }}>✓</span>}
                    {esFallo && <span style={{ float: 'right', color: 'var(--danger)' }}>✗</span>}
                  </button>
                );
              })}
            </div>

            {corr && (
              <div className="info-box" style={{ marginBottom: 14, fontSize: 13.5 }}>
                {corr.explicacion || 'Sin justificación registrada para esta pregunta.'}
                {corr.fuente && (
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
                    Fuente: {corr.fuente.documento}{corr.fuente.pagina ? `, página ${corr.fuente.pagina}` : ''}
                  </div>
                )}
              </div>
            )}

            {fallo && <div className="alert alert-error" style={{ fontSize: 13.5 }}>{fallo}</div>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <button className="btn btn-outline btn-small" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Anterior</button>
              {idx === preguntas.length - 1 ? (
                <button className="btn btn-primary press" onClick={enviar} disabled={enviando}>
                  {enviando ? 'Corrigiendo…' : 'Terminar y corregir'}
                </button>
              ) : (
                <button className="btn btn-primary" onClick={() => setIdx(idx + 1)}>Siguiente</button>
              )}
            </div>
          </div>
        );
      })()}

      {/* --------------------------------------------------------- resultado */}
      {resultado && (
        <>
          <div className="card animate-pop" style={{ textAlign: 'center', marginBottom: 16, borderTop: '4px solid var(--primary-dark)' }}>
            <div className="muted" style={{ fontSize: 13 }}>Resultado</div>
            <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.1, color: resultado.pct >= 50 ? 'var(--success)' : 'var(--danger)' }}>
              {resultado.correct}<span style={{ fontSize: 22, color: 'var(--gray-500)' }}> / {resultado.total}</span>
            </div>
            <div style={{ fontSize: 17, marginTop: 4 }}>{resultado.pct} % de aciertos</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
              <button className="btn btn-primary press" onClick={() => repetir(testId)}>Repetir barajado</button>
              <button className="btn btn-outline press" onClick={() => { setTestId(''); setResultado(null); }}>
                Configurar otro test
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">Hoja de respuestas</div></div>
            {resultado.revision.map((r) => (
              <div key={r.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--gray-100)' }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 6 }}>
                  <span style={{ color: r.acierto ? 'var(--success)' : 'var(--danger)' }}>{r.acierto ? '✓' : '✗'}</span>{' '}
                  {r.n}. {r.text}
                  {r.numeroEnBanco && <span className="muted" style={{ fontWeight: 400 }}> (nº {r.numeroEnBanco})</span>}
                </div>
                {r.options.map((op, i) => (
                  <div key={i} style={{
                    fontSize: 13.5, padding: '2px 0 2px 10px',
                    color: i === r.correcta ? 'var(--success)' : r.marcada === i ? 'var(--danger)' : 'var(--gray-700)',
                    fontWeight: i === r.correcta ? 600 : 400,
                  }}>
                    {String.fromCharCode(65 + i)}. {op}
                    {i === r.correcta && ' ← correcta'}
                    {r.marcada === i && i !== r.correcta && ' ← tu respuesta'}
                  </div>
                ))}
                {r.marcada === null && <div className="muted" style={{ fontSize: 12.5, paddingLeft: 10 }}>Sin responder</div>}
                {r.explicacion && <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{r.explicacion}</div>}
                {r.fuente && (
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>
                    Fuente: {r.fuente.documento}{r.fuente.pagina ? `, página ${r.fuente.pagina}` : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
