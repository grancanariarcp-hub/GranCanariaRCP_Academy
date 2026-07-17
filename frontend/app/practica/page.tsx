'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { AppVersion } from '@/components/AppVersion';

interface Q { id: string; category: string; text: string; options: string[] }
interface Feedback { id: string; correct_index: number; your: number | null; is_correct: boolean; explanation: string | null; document_title: string | null; ref_page: number | null }
interface Stats {
  failedByCategory: Array<{ category: string; count: number }>;
  totalAnswered: number;
  distinctAnswered: number;
  remaining: number;
  accuracyPct: number | null;
  daily: Array<{ day: string; answered: number; correct: number }>;
}

export default function PracticaPage() {
  const user = typeof window !== 'undefined' ? getUser() : null;
  const [stats, setStats] = useState<Stats | null>(null);
  const [phase, setPhase] = useState<'config' | 'taking' | 'result'>('config');
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<'aleatorio' | 'tema' | 'fallos'>('aleatorio');
  const [category, setCategory] = useState('SVB');
  const [count, setCount] = useState('10');

  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [feedback, setFeedback] = useState<Feedback[] | null>(null);
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);

  async function loadStats() {
    try {
      setStats(await api<Stats>('/api/practice/stats', { auth: true }));
    } catch {
      /* ignore */
    }
  }
  useEffect(() => { if (user) loadStats(); /* eslint-disable-next-line */ }, []);

  async function start() {
    setError(null);
    try {
      const r = await api<{ questions: Q[] }>('/api/practice/start', {
        method: 'POST', auth: true,
        body: JSON.stringify({ mode, category: mode === 'tema' ? category : undefined, count: Number(count) }),
      });
      setQuestions(r.questions);
      setAnswers(Object.fromEntries(r.questions.map((q) => [q.id, null])));
      setPhase('taking');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al empezar');
    }
  }

  async function submit() {
    try {
      const r = await api<{ correct: number; total: number; feedback: Feedback[] }>('/api/practice/submit', {
        method: 'POST', auth: true, body: JSON.stringify({ answers }),
      });
      setFeedback(r.feedback);
      setScore({ correct: r.correct, total: r.total });
      setPhase('result');
      loadStats();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al enviar');
    }
  }

  const maxDay = Math.max(1, ...(stats?.daily.map((d) => d.answered) ?? [1]));

  return (
    <div style={{ minHeight: '100vh', padding: '32px 16px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <p style={{ marginBottom: 16 }}><Link href="/">← Inicio</Link></p>
        <h1 style={{ color: 'var(--primary-dark)', marginBottom: 16 }}>📚 Práctica</h1>
        {error && <div className="alert alert-error">{error}</div>}

        {!user ? (
          <div className="card"><div className="info-box">Para practicar y ver tus estadísticas, <Link href="/login">accede</Link> o <Link href="/registro">regístrate</Link>.</div></div>
        ) : (
          <>
            {/* Estadísticas */}
            {stats && phase === 'config' && (
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header"><div className="card-title">Tu progreso</div></div>
                <div className="grid grid-4" style={{ marginBottom: 12 }}>
                  <div className="info-box">Respondidas: <strong>{stats.totalAnswered}</strong></div>
                  <div className="info-box">Distintas: <strong>{stats.distinctAnswered}</strong></div>
                  <div className="info-box">Por responder: <strong>{stats.remaining}</strong></div>
                  <div className="info-box">Aciertos: <strong>{stats.accuracyPct ?? '—'}%</strong></div>
                </div>
                {stats.failedByCategory.length > 0 && (
                  <p style={{ fontSize: 14 }}>
                    <strong>Dónde más fallas:</strong>{' '}
                    {stats.failedByCategory.map((f) => `${f.category} (${f.count})`).join(' · ')}
                  </p>
                )}
                {stats.daily.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Preguntas por día (30 días)</div>
                    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 60 }}>
                      {stats.daily.map((d) => (
                        <div key={d.day} title={`${d.day}: ${d.answered} (${d.correct} ✓)`} style={{ flex: 1, background: 'var(--secondary-dark)', height: `${(d.answered / maxDay) * 100}%`, minHeight: 3, borderRadius: 2 }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Config */}
            {phase === 'config' && (
              <div className="card">
                <div className="card-header"><div className="card-title">Generar test</div></div>
                <div className="tabs">
                  <button className={`tab ${mode === 'aleatorio' ? 'active' : ''}`} onClick={() => setMode('aleatorio')}>🎲 Aleatorio</button>
                  <button className={`tab ${mode === 'tema' ? 'active' : ''}`} onClick={() => setMode('tema')}>📂 Por tema</button>
                  <button className={`tab ${mode === 'fallos' ? 'active' : ''}`} onClick={() => setMode('fallos')}>❗ Solo mis fallos</button>
                </div>
                <div className="grid grid-2" style={{ gap: 12 }}>
                  {mode === 'tema' && (
                    <div className="form-group">
                      <label className="form-label">Tema</label>
                      <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                        <option value="SVB">SVB</option><option value="SVI">SVI</option><option value="SVA">SVA</option><option value="PA">Primeros auxilios</option>
                      </select>
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Nº de preguntas</label>
                    <input className="form-input" type="number" min="1" max="50" value={count} onChange={(e) => setCount(e.target.value)} />
                  </div>
                </div>
                <button className="btn btn-primary btn-full" onClick={start}>Empezar</button>
              </div>
            )}

            {/* Taking */}
            {phase === 'taking' && (
              <>
                {questions.map((q, i) => (
                  <div className="card" key={q.id} style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>{i + 1}. {q.text} <span className="badge badge-primary" style={{ fontSize: 11 }}>{q.category}</span></div>
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
                  <h2>{score.correct}/{score.total} aciertos</h2>
                  <button className="btn btn-primary" onClick={() => setPhase('config')}>Otra tanda</button>
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
    </div>
  );
}
