'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { AppVersion } from '@/components/AppVersion';
import { PageNav } from '@/components/PageNav';
import { StickyCampusBar } from '@/components/StickyCampusBar';

interface Q { id: string; category: string | null; text: string; options: string[] }
interface Feedback { id: string; correct_index: number; your: number | null; is_correct: boolean; explanation: string | null; document_title: string | null; ref_page: number | null }
interface Stats {
  failedByCategory: Array<{ category: string; count: number }>;
  totalAnswered: number;
  distinctAnswered: number;
  remaining: number;
  accuracyPct: number | null;
  daily: Array<{ day: string; answered: number; correct: number }>;
  totalHours: number;
  hoursDaily: Array<{ day: string; hours: number }>;
  porTema: Array<{ tema: string; total: number; vistas: number; falladas: number; coberturaPct: number }>;
}
interface FailedGeneral { id: string; tema: string | null; category: string | null; text: string; fallos: string; respuestas: string; pct_fallo: string }

export default function PracticaPage() {
  const user = typeof window !== 'undefined' ? getUser() : null;
  const [stats, setStats] = useState<Stats | null>(null);
  const [phase, setPhase] = useState<'config' | 'taking' | 'result'>('config');
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<'aleatorio' | 'tema' | 'fallos'>('aleatorio');
  const [category, setCategory] = useState('SVB');
  const [count, setCount] = useState('10');

  // Banco (RCP por defecto; OPE/MIR cuando el super admin los sube)
  type Bank = { id: string; name: string; kind: string; sim_questions: number | null; sim_minutes: number | null; sim_pass_pct: number | null };
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankId, setBankId] = useState('');
  const [bankTemas, setBankTemas] = useState<Array<{ tema: string; questions: string }>>([]);
  const [tema, setTema] = useState('');

  // Simulacro cronometrado (config del banco)
  const [simActive, setSimActive] = useState(false);
  const [simTimed, setSimTimed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [passPct, setPassPct] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [failedGeneral, setFailedGeneral] = useState<FailedGeneral[]>([]);
  const [showFailed, setShowFailed] = useState(false);
  const selectedBank = banks.find((b) => b.id === bankId) || null;

  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [feedback, setFeedback] = useState<Feedback[] | null>(null);
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);

  async function loadStats(bank?: string) {
    try {
      const qs = bank ? `?bankId=${bank}` : '';
      setStats(await api<Stats>(`/api/practice/stats${qs}`, { auth: true }));
    } catch {
      /* ignore */
    }
  }
  async function loadBanks() {
    try {
      setBanks((await api<{ banks: Bank[] }>('/api/public/banks')).banks);
    } catch { /* ignore */ }
  }
  async function loadFailedGeneral() {
    try {
      const qs = bankId ? `?bankId=${bankId}` : '';
      setFailedGeneral((await api<{ questions: FailedGeneral[] }>(`/api/practice/failed-general${qs}`, { auth: true })).questions);
      setShowFailed(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    }
  }
  useEffect(() => { if (user) { loadStats(); loadBanks(); } /* eslint-disable-next-line */ }, []);

  // Al elegir un banco concreto, cargar sus temas para el selector.
  useEffect(() => {
    setTema('');
    if (user) loadStats(bankId || undefined);
    if (!bankId) { setBankTemas([]); return; }
    api<{ temas: Array<{ tema: string; questions: string }> }>(`/api/public/banks/${bankId}/temas`)
      .then((r) => setBankTemas(r.temas))
      .catch(() => setBankTemas([]));
  }, [bankId]);

  // Cuenta atrás del simulacro: al llegar a 0 se corrige automáticamente.
  useEffect(() => {
    if (!simActive || !simTimed || phase !== 'taking') return;
    if (timeLeft <= 0) { submit(); return; }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simActive, simTimed, phase, timeLeft]);

  async function start() {
    setError(null);
    setSimActive(false); setSimTimed(false); setPassPct(null);
    try {
      const r = await api<{ questions: Q[] }>('/api/practice/start', {
        method: 'POST', auth: true,
        body: JSON.stringify({
          mode,
          bankId: bankId || undefined,
          category: mode === 'tema' && !bankId ? category : undefined,
          tema: mode === 'tema' && bankId ? tema || undefined : undefined,
          count: Number(count),
        }),
      });
      setQuestions(r.questions);
      setAnswers(Object.fromEntries(r.questions.map((q) => [q.id, null])));
      setStartedAt(Date.now());
      setPhase('taking');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al empezar');
    }
  }

  async function startSimulacro() {
    if (!selectedBank?.sim_questions) return;
    setError(null);
    try {
      const r = await api<{ questions: Q[] }>('/api/practice/start', {
        method: 'POST', auth: true,
        body: JSON.stringify({ mode: 'aleatorio', bankId, count: selectedBank.sim_questions }),
      });
      setQuestions(r.questions);
      setAnswers(Object.fromEntries(r.questions.map((q) => [q.id, null])));
      setPassPct(selectedBank.sim_pass_pct ?? null);
      const timed = !!selectedBank.sim_minutes;
      setSimTimed(timed);
      setTimeLeft(timed ? selectedBank.sim_minutes! * 60 : 0);
      setSimActive(true);
      setStartedAt(Date.now());
      setPhase('taking');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al empezar');
    }
  }

  async function submit() {
    try {
      const r = await api<{ correct: number; total: number; feedback: Feedback[] }>('/api/practice/submit', {
        method: 'POST', auth: true,
        body: JSON.stringify({
          answers,
          seconds: startedAt ? Math.round((Date.now() - startedAt) / 1000) : undefined,
          bankId: bankId || undefined,
          isSimulacro: simActive,
        }),
      });
      setFeedback(r.feedback);
      setScore({ correct: r.correct, total: r.total });
      setPhase('result');
      loadStats(bankId || undefined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al enviar');
    }
  }

  const maxDay = Math.max(1, ...(stats?.daily.map((d) => d.answered) ?? [1]));

  return (
    <div style={{ minHeight: '100vh', padding: '32px 16px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <PageNav />
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ color: 'var(--primary-dark)', fontSize: 30 }}>📚 Práctica libre</h1>
          <p className="muted" style={{ maxWidth: 560, margin: '6px auto 0' }}>Entrena a tu ritmo, repasa tus fallos y prepara simulacros. Cada respuesta mejora tus estadísticas.</p>
        </div>
        {error && <div className="alert alert-error">{error}</div>}

        {!user ? (
          <>
            <div className="grid grid-3 animate-in" style={{ gap: 14, marginBottom: 20 }}>
              {[
                { t: 'Tests a tu medida', d: 'Aleatorio, por tema o solo tus fallos', bg: 'linear-gradient(135deg,#2c5282,#4299e1)' },
                { t: 'Simulacros cronometrados', d: 'Con nota de corte, como el examen real', bg: 'linear-gradient(135deg,#6b46c1,#9f7aea)' },
                { t: 'Estadísticas y progreso', d: 'Aciertos, horas y evolución', bg: 'linear-gradient(135deg,#276749,#10b981)' },
              ].map((f) => (
                <div key={f.t} className="press" style={{ color: '#fff', borderRadius: 14, padding: 22, background: f.bg, boxShadow: 'var(--shadow-md)', textAlign: 'center', minHeight: 120, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: 17 }}>{f.t}</div>
                  <div style={{ fontSize: 13, opacity: 0.95, marginTop: 4 }}>{f.d}</div>
                </div>
              ))}
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <p style={{ marginBottom: 12 }}>Para practicar y guardar tus estadísticas, entra o crea tu cuenta gratis:</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link href="/login" className="btn btn-primary">Acceder</Link>
                <Link href="/registro" className="btn cta-blink" style={{ background: 'linear-gradient(135deg,#276749,#10b981)', color: '#fff', fontWeight: 700 }}>Regístrate gratis</Link>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Estadísticas */}
            {stats && phase === 'config' && (
              <div className="card animate-in" style={{ marginBottom: 20 }}>
                <div className="card-header">
                  <div className="card-title">{selectedBank ? `Tu progreso en ${selectedBank.name}` : 'Tu progreso'}</div>
                  {selectedBank && <div className="card-subtitle">Solo de esta oposición</div>}
                </div>
                <div className="grid grid-4" style={{ marginBottom: 12 }}>
                  <div className="info-box">Respondidas: <strong>{stats.totalAnswered}</strong></div>
                  <div className="info-box">Distintas: <strong>{stats.distinctAnswered}</strong></div>
                  <div className="info-box">Por responder: <strong>{stats.remaining}</strong></div>
                  <div className="info-box">Aciertos: <strong>{stats.accuracyPct ?? '—'}%</strong></div>
                </div>
                {stats.failedByCategory.length > 0 && (
                  <p style={{ fontSize: 14 }}>
                    <strong>Dónde más fallas{selectedBank ? ' (por tema)' : ''}:</strong>{' '}
                    {stats.failedByCategory.map((f) => `${f.category} (${f.count})`).join(' · ')}
                  </p>
                )}

                {stats.porTema.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Cobertura del temario</div>
                    <div className="table-responsive">
                      <table>
                        <thead><tr><th>Tema</th><th>Avance</th><th>Falladas</th></tr></thead>
                        <tbody>
                          {stats.porTema.map((t) => (
                            <tr key={t.tema}>
                              <td><strong>{t.tema}</strong><div className="muted" style={{ fontSize: 11 }}>{t.vistas}/{t.total} preguntas</div></td>
                              <td style={{ minWidth: 130 }}>
                                <div style={{ height: 8, background: 'var(--gray-200)', borderRadius: 999, overflow: 'hidden' }}>
                                  <div style={{ width: `${t.coberturaPct}%`, height: '100%', background: t.coberturaPct === 100 ? 'var(--success)' : 'linear-gradient(90deg,#2c5282,#22c55e)' }} />
                                </div>
                                <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{t.coberturaPct}%</div>
                              </td>
                              <td>{t.falladas > 0 ? <span className="badge" style={{ background: 'var(--danger)', color: '#fff' }}>{t.falladas}</span> : <span className="muted">—</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                <div className="grid grid-2" style={{ gap: 8, marginBottom: 8 }}>
                  <div className="info-box" style={{ fontSize: 13 }}>
                    Repeticiones medias por pregunta: <strong>{stats.distinctAnswered > 0 ? (stats.totalAnswered / stats.distinctAnswered).toFixed(1) : '—'}</strong>
                  </div>
                  <div className="info-box" style={{ fontSize: 13 }}>
                    Horas de estudio (total): <strong>{stats.totalHours} h</strong>
                  </div>
                </div>
                {stats.daily.length > 0 && (
                  <div className="grid grid-2" style={{ marginTop: 10, gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Preguntas por día (30 días)</div>
                      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 60 }}>
                        {stats.daily.map((d) => (
                          <div key={d.day} title={`${d.day}: ${d.answered} (${d.correct} ✓)`} style={{ flex: 1, background: 'var(--secondary-dark)', height: `${(d.answered / maxDay) * 100}%`, minHeight: 3, borderRadius: 2 }} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Aciertos por día (%)</div>
                      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 60 }}>
                        {stats.daily.map((d) => {
                          const pct = d.answered > 0 ? Math.round((d.correct / d.answered) * 100) : 0;
                          return <div key={d.day} title={`${d.day}: ${pct}%`} style={{ flex: 1, background: pct >= 50 ? 'var(--success)' : 'var(--danger)', height: `${Math.max(pct, 2)}%`, minHeight: 3, borderRadius: 2 }} />;
                        })}
                      </div>
                    </div>
                  </div>
                )}
                {stats.hoursDaily.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Horas por día (30 días)</div>
                    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 60 }}>
                      {(() => { const maxH = Math.max(0.1, ...stats.hoursDaily.map((d) => d.hours)); return stats.hoursDaily.map((d) => (
                        <div key={d.day} title={`${d.day}: ${d.hours} h`} style={{ flex: 1, background: 'var(--primary-medium)', height: `${(d.hours / maxH) * 100}%`, minHeight: 3, borderRadius: 2 }} />
                      )); })()}
                    </div>
                  </div>
                )}
                <div style={{ marginTop: 12 }}>
                  <button className="btn btn-outline btn-small" onClick={loadFailedGeneral}>
                    {showFailed ? '↻ Actualizar' : '📊'} Preguntas más falladas por todos{selectedBank ? ` (${selectedBank.name})` : ''}
                  </button>
                  {showFailed && (
                    failedGeneral.length === 0
                      ? <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>Aún no hay datos suficientes.</p>
                      : <div className="table-responsive" style={{ marginTop: 8 }}>
                          <table>
                            <thead><tr><th>Tema</th><th>Pregunta</th><th>% fallo</th></tr></thead>
                            <tbody>
                              {failedGeneral.slice(0, 15).map((q) => (
                                <tr key={q.id}>
                                  <td style={{ fontSize: 12 }}>{q.tema || q.category || '—'}</td>
                                  <td style={{ fontSize: 12 }}>{q.text}…</td>
                                  <td><span className="badge" style={{ background: 'var(--danger)', color: '#fff' }}>{q.pct_fallo}%</span></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                  )}
                </div>
              </div>
            )}

            {/* Config */}
            {phase === 'config' && (
              <div className="card animate-in">
                <div className="card-header"><div className="card-title">Generar test</div></div>
                <div className="tabs">
                  <button className={`tab ${mode === 'aleatorio' ? 'active' : ''}`} onClick={() => setMode('aleatorio')}>🎲 Aleatorio</button>
                  <button className={`tab ${mode === 'tema' ? 'active' : ''}`} onClick={() => setMode('tema')}>📂 Por tema</button>
                  <button className={`tab ${mode === 'fallos' ? 'active' : ''}`} onClick={() => setMode('fallos')}>❗ Solo mis fallos</button>
                </div>
                <div className="form-group">
                  <label className="form-label">Banco de preguntas</label>
                  <select className="form-select" value={bankId} onChange={(e) => setBankId(e.target.value)}>
                    <option value="">RCP y primeros auxilios (general)</option>
                    {banks.filter((b) => b.kind !== 'rcp').map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-2" style={{ gap: 12 }}>
                  {mode === 'tema' && !bankId && (
                    <div className="form-group">
                      <label className="form-label">Tema</label>
                      <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                        <option value="SVB">SVB</option><option value="SVI">SVI</option><option value="SVA">SVA</option><option value="PA">Primeros auxilios</option>
                      </select>
                    </div>
                  )}
                  {mode === 'tema' && bankId && (
                    <div className="form-group">
                      <label className="form-label">Tema {bankTemas.length === 0 && '(sin temas)'}</label>
                      <select className="form-select" value={tema} onChange={(e) => setTema(e.target.value)}>
                        <option value="">Todos los temas</option>
                        {bankTemas.map((t) => (
                          <option key={t.tema} value={t.tema}>{t.tema} ({t.questions})</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Nº de preguntas</label>
                    <input className="form-input" type="number" min="1" max="100" value={count} onChange={(e) => setCount(e.target.value)} />
                  </div>
                </div>
                <button className="btn btn-primary btn-full" onClick={start}>Empezar</button>
              </div>
            )}

            {/* Simulacro (si el banco elegido tiene simulacro configurado) */}
            {phase === 'config' && selectedBank?.sim_questions && (
              <div className="card" style={{ marginTop: 16, borderLeft: '4px solid var(--secondary-dark)' }}>
                <div className="card-header"><div className="card-title">⏱️ Simulacro oficial — {selectedBank.name}</div></div>
                <p style={{ fontSize: 14, marginBottom: 12 }}>
                  <strong>{selectedBank.sim_questions}</strong> preguntas ·{' '}
                  {selectedBank.sim_minutes ? <><strong>{selectedBank.sim_minutes}</strong> min</> : 'tiempo libre'}
                  {selectedBank.sim_pass_pct != null && <> · aprobado ≥ <strong>{selectedBank.sim_pass_pct}%</strong></>}
                </p>
                <button className="btn btn-primary btn-full" onClick={startSimulacro}>Empezar simulacro</button>
              </div>
            )}

            {/* Taking */}
            {phase === 'taking' && (
              <>
                {simActive && simTimed && (
                  <div className="card" style={{ position: 'sticky', top: 8, zIndex: 10, textAlign: 'center', padding: 12, marginBottom: 12, background: timeLeft <= 60 ? '#fde8e8' : undefined }}>
                    <span style={{ fontSize: 22, fontWeight: 700, color: timeLeft <= 60 ? 'var(--danger)' : 'var(--primary-dark)' }}>
                      ⏱️ {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
                    </span>
                  </div>
                )}
                {questions.map((q, i) => (
                  <div className="card" key={q.id} style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>{i + 1}. {q.text} {q.category && <span className="badge badge-primary" style={{ fontSize: 11 }}>{q.category}</span>}</div>
                    {q.options.map((opt, idx) => (
                      <label key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0', cursor: 'pointer' }}>
                        <input type="radio" name={q.id} checked={answers[q.id] === idx} onChange={() => setAnswers({ ...answers, [q.id]: idx })} />
                        {opt}
                      </label>
                    ))}
                  </div>
                ))}
                <button className="btn btn-primary btn-full" onClick={submit}>Corregir</button>
              </>
            )}

            {/* Result + feedback */}
            {phase === 'result' && feedback && score && (
              <>
                <div className="card" style={{ textAlign: 'center', marginBottom: 16 }}>
                  <h2>{score.correct}/{score.total} aciertos ({Math.round((score.correct / score.total) * 100)}%)</h2>
                  {simActive && passPct != null && (
                    (score.correct / score.total) * 100 >= passPct
                      ? <div className="badge badge-success" style={{ fontSize: 16, padding: '6px 14px', margin: '8px 0' }}>✅ APROBADO (corte {passPct}%)</div>
                      : <div className="badge" style={{ fontSize: 16, padding: '6px 14px', margin: '8px 0', background: 'var(--danger)', color: '#fff' }}>❌ NO APTO (corte {passPct}%)</div>
                  )}
                  <div><button className="btn btn-primary" onClick={() => setPhase('config')}>Otra tanda</button></div>
                </div>
                {questions.map((q, i) => {
                  const fb = feedback.find((f) => f.id === q.id)!;
                  return (
                    <div className="card" key={q.id} style={{ marginBottom: 12 }}>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>{fb.is_correct ? '✅' : '❌'} {i + 1}. {q.text}</div>
                      {q.options.map((opt, idx) => (
                        <div key={idx} style={{ padding: '2px 0', color: idx === fb.correct_index ? 'var(--success)' : idx === fb.your ? 'var(--danger)' : undefined, fontWeight: idx === fb.correct_index ? 700 : 400 }}>
                          {idx === fb.correct_index ? '✓ ' : idx === fb.your ? '✗ ' : '• '}{opt}
                        </div>
                      ))}
                      {fb.explanation && <div className="info-box" style={{ marginTop: 8, fontSize: 13 }}>{fb.explanation}</div>}
                      {fb.document_title && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>📖 {fb.document_title}{fb.ref_page ? `, pág. ${fb.ref_page}` : ''}</div>}
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}
        <p style={{ textAlign: 'center', marginTop: 32 }}><AppVersion /></p>
      </div>
      <StickyCampusBar />
    </div>
  );
}
