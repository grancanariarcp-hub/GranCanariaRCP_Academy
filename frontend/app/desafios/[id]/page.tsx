'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { AppVersion } from '@/components/AppVersion';

interface Q { id: string; text: string; options: string[] }
interface RankRow { position: number; participant_name: string; correct: number; total: number; time_seconds: number; days_in_position: number }
interface Challenge { id: string; title: string; area: string; num_questions: number; time_limit_seconds: number; kind: string }

function mmss(s: number) {
  const x = Math.max(0, Math.floor(s));
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
}

export default function DesafioPage() {
  const { id } = useParams();
  const cid = id as string;
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [ranking, setRanking] = useState<RankRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'view' | 'taking' | 'result'>('view');

  const [attemptId, setAttemptId] = useState('');
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const answersRef = useRef(answers); answersRef.current = answers;
  const [limit, setLimit] = useState(300);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);
  const submittingRef = useRef(false);
  const [result, setResult] = useState<{ correct: number; total: number; timeSeconds: number; position: number; totalParticipants: number } | null>(null);

  const user = typeof window !== 'undefined' ? getUser() : null;

  async function loadRanking() {
    try {
      const r = await api<{ challenge: Challenge; ranking: RankRow[] }>(`/api/public/challenges/${cid}/ranking`);
      setChallenge(r.challenge);
      setRanking(r.ranking);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No disponible');
    }
  }
  useEffect(() => { loadRanking(); /* eslint-disable-next-line */ }, [cid]);

  useEffect(() => {
    if (phase !== 'taking') return;
    const iv = setInterval(() => {
      const s = (Date.now() - startRef.current) / 1000;
      setElapsed(s);
      if (s >= limit) submit();
    }, 500);
    return () => clearInterval(iv);
    // eslint-disable-next-line
  }, [phase, limit]);

  async function participate() {
    setError(null);
    try {
      const r = await api<{ attemptId: string; timeLimitSeconds: number; questions: Q[] }>(`/api/challenges/${cid}/start`, { method: 'POST', auth: true });
      setAttemptId(r.attemptId); setQuestions(r.questions); setLimit(r.timeLimitSeconds);
      setAnswers(Object.fromEntries(r.questions.map((q) => [q.id, null])));
      startRef.current = Date.now(); setElapsed(0); setPhase('taking');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al empezar');
    }
  }

  async function submit() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      const r = await api<typeof result>(`/api/challenges/${cid}/attempts/${attemptId}/submit`, { method: 'POST', auth: true, body: JSON.stringify({ answers: answersRef.current }) });
      setResult(r); setPhase('result'); loadRanking();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al enviar');
    } finally {
      submittingRef.current = false;
    }
  }

  const remaining = limit - elapsed;

  return (
    <div style={{ minHeight: '100vh', padding: '32px 16px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <p style={{ marginBottom: 16 }}><Link href="/desafios">← Desafíos</Link></p>
        {error && <div className="alert alert-error">{error}</div>}
        {challenge && <h1 style={{ color: 'var(--primary-dark)', marginBottom: 4 }}>{challenge.title}</h1>}
        {challenge && <p className="muted" style={{ marginBottom: 20 }}>{challenge.area} · {challenge.num_questions} preguntas · {Math.round(challenge.time_limit_seconds / 60)} min</p>}

        {/* VIEW: ranking + participar */}
        {phase === 'view' && (
          <>
            <div className="card" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {user ? (
                <><span>¿List@ para subir en el ranking?</span><button className="btn btn-primary" onClick={participate}>🚀 Participar</button></>
              ) : (
                <span>Para participar, <Link href="/login">accede</Link> o <Link href="/registro">regístrate</Link>.</span>
              )}
            </div>
            <div className="card">
              <div className="card-header"><div className="card-title">🏆 Ranking</div><div className="card-subtitle">{ranking.length} participantes</div></div>
              <div className="table-responsive">
                <table>
                  <thead><tr><th>#</th><th>Participante</th><th>Aciertos</th><th>Tiempo</th><th>Días</th></tr></thead>
                  <tbody>
                    {ranking.map((r) => (
                      <tr key={r.position}>
                        <td><strong>{r.position <= 3 ? ['🥇', '🥈', '🥉'][r.position - 1] : r.position}</strong></td>
                        <td>{r.participant_name}</td>
                        <td>{r.correct}/{r.total}</td>
                        <td>{mmss(r.time_seconds)}</td>
                        <td>{r.days_in_position}</td>
                      </tr>
                    ))}
                    {ranking.length === 0 && <tr><td colSpan={5} className="muted">Aún no hay participantes. ¡Sé el primero!</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* TAKING */}
        {phase === 'taking' && (
          <>
            <div className="card" style={{ position: 'sticky', top: 8, zIndex: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>⏱️ {mmss(remaining)}</strong>
              <button className="btn btn-primary btn-small" onClick={submit}>Enviar</button>
            </div>
            {questions.map((q, i) => (
              <div className="card" key={q.id} style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>{i + 1}. {q.text}</div>
                {q.options.map((opt, idx) => (
                  <label key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0', cursor: 'pointer' }}>
                    <input type="radio" name={q.id} checked={answers[q.id] === idx} onChange={() => setAnswers({ ...answers, [q.id]: idx })} />
                    {opt}
                  </label>
                ))}
              </div>
            ))}
            <button className="btn btn-primary btn-full" style={{ marginTop: 12 }} onClick={submit}>Enviar</button>
          </>
        )}

        {/* RESULT */}
        {phase === 'result' && result && (
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40 }}>🏅</div>
            <h2>Puesto #{result.position} de {result.totalParticipants}</h2>
            <p style={{ fontSize: 18 }}>{result.correct}/{result.total} aciertos · {mmss(result.timeSeconds)}</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
              <button className="btn btn-primary" onClick={() => setPhase('view')}>Ver ranking</button>
              <button className="btn btn-outline" onClick={participate}>Reintentar</button>
            </div>
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: 32 }}><AppVersion /></p>
      </div>
    </div>
  );
}
