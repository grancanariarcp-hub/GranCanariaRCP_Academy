'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { api, ApiError } from '@/lib/api';
import { PageNav } from '@/components/PageNav';
import { AvisarPregunta } from '@/components/AvisarPregunta';

type Format = 'test' | 'vf' | 'abierta';
interface Q { id: string; format: Format; text: string; options: string[]; correct_index?: number | null }
interface Attempt { id: string; score: number | null; passed: boolean | null; time_spent_seconds: number | null; submitted_at: string }
type Answers = Record<string, number | string>;

function mmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function TakeExamPage() {
  const params = useParams();
  const courseId = params.id as string;
  const examId = params.examId as string;
  const user = useSession(['student'], '/login/menor');

  const [phase, setPhase] = useState<'intro' | 'taking' | 'result' | 'review'>('intro');
  const [cfg, setCfg] = useState<{ title: string; attemptsAllowed: number; passPct: number; timeLimitMin: number | null } | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [attemptId, setAttemptId] = useState('');
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Answers>({});
  const answersRef = useRef<Answers>({});
  answersRef.current = answers;

  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(0);
  const [result, setResult] = useState<{ score: number | null; passed: boolean | null; autoCorrect: number; autoTotal: number; hasOpen: boolean } | null>(null);
  const [review, setReview] = useState<{ questions: Q[]; answers: Answers } | null>(null);
  const submittingRef = useRef(false);

  async function loadIntro() {
    try {
      const r = await api<{ exam: typeof cfg; attempts: Attempt[]; used: number }>(`/api/student/exams/${examId}/attempts`, { auth: true });
      setCfg(r.exam);
      setAttempts(r.attempts);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    }
  }
  useEffect(() => {
    if (user) loadIntro();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Timer: always running while taking. Countdown if there's a limit; else count up.
  useEffect(() => {
    if (phase !== 'taking') return;
    const iv = setInterval(() => {
      const secs = (Date.now() - startRef.current) / 1000;
      setElapsed(secs);
      if (cfg?.timeLimitMin && secs >= cfg.timeLimitMin * 60) submit();
    }, 500);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cfg]);

  async function start() {
    setError(null);
    try {
      const r = await api<{ attemptId: string; questions: Q[] }>(`/api/student/exams/${examId}/start`, { method: 'POST', auth: true });
      setAttemptId(r.attemptId);
      setQuestions(r.questions);
      setAnswers({});
      startRef.current = Date.now();
      setElapsed(0);
      setPhase('taking');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al comenzar');
    }
  }

  async function submit() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      const r = await api<typeof result>(`/api/student/exams/${examId}/attempts/${attemptId}/submit`, {
        method: 'POST', auth: true, body: JSON.stringify({ answers: answersRef.current }),
      });
      setResult(r);
      setPhase('result');
      loadIntro();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al enviar');
    } finally {
      submittingRef.current = false;
    }
  }

  async function openReview(id: string) {
    try {
      const r = await api<{ attempt: { answers: Answers }; questions: Q[] }>(`/api/student/exams/${examId}/attempts/${id}`, { auth: true });
      setReview({ questions: r.questions, answers: r.attempt.answers || {} });
      setPhase('review');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error');
    }
  }

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;
  const remaining = cfg?.timeLimitMin ? cfg.timeLimitMin * 60 - elapsed : null;

  return (
    <AppShell user={user} title={cfg?.title ?? 'Examen'} nav={[{ label: 'Inicio', href: '/student', active: true }]}>
      <PageNav backHref={`/student/curso/${courseId}`} backLabel="Volver al curso" />
      {error && <div className="alert alert-error">{error}</div>}

      {/* INTRO */}
      {phase === 'intro' && cfg && (
        <div className="card">
          <div className="card-header"><div className="card-title">{cfg.title}</div></div>
          <div className="grid grid-4" style={{ marginBottom: 16 }}>
            <div className="info-box">Intentos: <strong>{attempts.length}/{cfg.attemptsAllowed}</strong></div>
            <div className="info-box">Aprobar: <strong>{cfg.passPct}%</strong></div>
            <div className="info-box">Tiempo: <strong>{cfg.timeLimitMin ? `${cfg.timeLimitMin} min` : 'libre'}</strong></div>
          </div>
          {attempts.length < cfg.attemptsAllowed ? (
            <button className="btn btn-primary btn-full" onClick={start}>Comenzar examen</button>
          ) : (
            <div className="info-box">Has agotado los intentos.</div>
          )}
          {attempts.length > 0 && (
            <div className="table-responsive" style={{ marginTop: 16 }}>
              <table>
                <thead><tr><th>Intento</th><th>Nota</th><th>Resultado</th><th>Tiempo</th><th></th></tr></thead>
                <tbody>
                  {attempts.map((a, i) => (
                    <tr key={a.id}>
                      <td>{attempts.length - i}</td>
                      <td>{a.score ?? '—'}%</td>
                      <td>{a.passed == null ? '—' : a.passed ? <span className="badge badge-success">Aprobado</span> : <span className="badge badge-danger">No superado</span>}</td>
                      <td>{a.time_spent_seconds != null ? mmss(a.time_spent_seconds) : '—'}</td>
                      <td><button className="btn btn-outline btn-small" onClick={() => openReview(a.id)}>Revisar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAKING */}
      {phase === 'taking' && (
        <>
          <div className="card" style={{ position: 'sticky', top: 8, zIndex: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>⏱️ {remaining != null ? `Restante: ${mmss(remaining)}` : `Tiempo: ${mmss(elapsed)}`}</strong>
            <button className="btn btn-primary btn-small" onClick={submit}>Enviar examen</button>
          </div>
          {questions.map((q, i) => (
            <div className="card" key={q.id} style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>{i + 1}. {q.text}</div>
              {q.format === 'abierta' ? (
                <textarea className="form-input" style={{ height: 80, padding: 10 }} value={(answers[q.id] as string) || ''} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
              ) : (
                q.options.map((opt, idx) => (
                  <label key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0', cursor: 'pointer' }}>
                    <input type="radio" name={q.id} checked={answers[q.id] === idx} onChange={() => setAnswers({ ...answers, [q.id]: idx })} />
                    {opt}
                  </label>
                ))
              )}
            </div>
          ))}
          <button className="btn btn-primary btn-full" style={{ marginTop: 16 }} onClick={submit}>Enviar examen</button>
        </>
      )}

      {/* RESULT */}
      {phase === 'result' && result && (
        <div className="card">
          <div className={`alert ${result.passed ? 'alert-success' : 'alert-error'}`} style={{ fontSize: 16 }}>
            {result.passed ? '✅ ¡Aprobado!' : result.passed === false ? '❌ No superado' : 'Enviado'} — Nota: <strong>{result.score ?? '—'}%</strong>{' '}
            ({result.autoCorrect}/{result.autoTotal} correctas)
          </div>
          {result.hasOpen && <div className="info-box" style={{ marginBottom: 12 }}>Tiene preguntas abiertas que revisará el profesor.</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => openReview(attemptId)}>Revisar respuestas</button>
            <button className="btn btn-outline" onClick={() => setPhase('intro')}>Volver</button>
          </div>
        </div>
      )}

      {/* REVIEW (feedback libre) */}
      {phase === 'review' && review && (
        <>
          <div className="card"><div className="card-title">Revisión — puedes repasar con el feedback</div></div>
          {review.questions.map((q, i) => {
            const mine = review.answers[q.id];
            return (
              <div className="card" key={q.id} style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>{i + 1}. {q.text}</div>
                {q.format === 'abierta' ? (
                  <div><em>Tu respuesta:</em> {(mine as string) || '—'}<div className="info-box" style={{ marginTop: 6, fontSize: 12 }}>La corrige el profesor.</div></div>
                ) : (
                  q.options.map((opt, idx) => {
                    const isCorrect = idx === q.correct_index;
                    const isMine = mine === idx;
                    return (
                      <div key={idx} style={{ padding: '3px 0', color: isCorrect ? 'var(--success)' : isMine ? 'var(--danger)' : undefined, fontWeight: isCorrect || isMine ? 700 : 400 }}>
                        {isCorrect ? '✓ ' : isMine ? '✗ ' : '• '}{opt}{isMine && !isCorrect ? ' (tu respuesta)' : ''}
                      </div>
                    );
                  })
                )}
                <AvisarPregunta examId={examId} questionId={q.id} />
              </div>
            );
          })}
          <button className="btn btn-outline btn-full" style={{ marginTop: 16 }} onClick={() => setPhase('intro')}>Volver</button>
        </>
      )}
    </AppShell>
  );
}
