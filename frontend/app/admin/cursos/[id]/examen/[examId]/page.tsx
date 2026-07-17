'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { api, ApiError } from '@/lib/api';

type Format = 'test' | 'vf' | 'abierta';
interface ExamQuestion {
  id: string;
  format: Format;
  text: string;
  options: string[];
  correct_index: number | null;
}
interface Exam {
  id: string;
  title: string;
  kind: string;
  attempts_allowed: number;
  pass_pct: number;
  time_limit_min: number | null;
}

const FORMAT_LABEL: Record<Format, string> = { test: '📝 Test', vf: '✔️ Verdadero/Falso', abierta: '✍️ Abierta' };

export default function ExamEditorPage() {
  const params = useParams();
  const courseId = params.id as string;
  const examId = params.examId as string;
  const user = useSession(['super_admin', 'profesor'], '/login/admin');

  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cfgMsg, setCfgMsg] = useState<string | null>(null);

  // new question
  const [format, setFormat] = useState<Format>('test');
  const [qText, setQText] = useState('');
  const [options, setOptions] = useState<string[]>(['', '', '', '']);
  const [correct, setCorrect] = useState(0);

  async function load() {
    try {
      const r = await api<{ exam: Exam; questions: ExamQuestion[] }>(`/api/courses/${courseId}/exams/${examId}`, { auth: true });
      setExam(r.exam);
      setQuestions(r.questions);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error cargando el examen');
    }
  }
  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault();
    setCfgMsg(null);
    if (!exam) return;
    try {
      await api(`/api/courses/${courseId}/exams/${examId}`, {
        method: 'PATCH',
        auth: true,
        body: JSON.stringify({
          title: exam.title,
          attemptsAllowed: exam.attempts_allowed,
          passPct: exam.pass_pct,
          timeLimitMin: exam.time_limit_min,
        }),
      });
      setCfgMsg('Configuración guardada ✅');
    } catch (err) {
      setCfgMsg(err instanceof ApiError ? err.message : 'Error');
    }
  }

  async function addQuestion() {
    setError(null);
    try {
      const body: Record<string, unknown> = { format, text: qText };
      if (format === 'test') {
        body.options = options.map((o) => o.trim()).filter(Boolean);
        body.correctIndex = correct;
      } else if (format === 'vf') {
        body.correctIndex = correct; // 0 = Verdadero, 1 = Falso
      }
      await api(`/api/courses/${courseId}/exams/${examId}/questions`, { method: 'POST', auth: true, body: JSON.stringify(body) });
      setQText(''); setOptions(['', '', '', '']); setCorrect(0);
      load();
    } catch (err) {
      const detail = err instanceof ApiError && err.details ? ' — ' + (err.details as Array<{ message: string }>).map((d) => d.message).join('; ') : '';
      setError((err instanceof ApiError ? err.message : 'Error') + detail);
    }
  }

  async function deleteQuestion(id: string) {
    await api(`/api/courses/${courseId}/exams/${examId}/questions/${id}`, { method: 'DELETE', auth: true });
    load();
  }

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  const nav = [{ label: 'Cursos', href: '/admin/cursos', active: true }];

  return (
    <AppShell user={user} title={exam?.title ?? 'Examen'} nav={nav}>
      <p style={{ marginBottom: 16 }}><Link href={`/admin/cursos/${courseId}`}>← Volver al curso</Link></p>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="grid grid-2">
        {/* Config + añadir pregunta */}
        <div>
          {exam && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header"><div className="card-title">Configuración</div></div>
              {cfgMsg && <div className="alert alert-success">{cfgMsg}</div>}
              <form onSubmit={saveConfig}>
                <div className="form-group">
                  <label className="form-label">Título</label>
                  <input className="form-input" value={exam.title} onChange={(e) => setExam({ ...exam, title: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Intentos</label>
                    <input className="form-input" type="number" min="1" value={exam.attempts_allowed} onChange={(e) => setExam({ ...exam, attempts_allowed: Number(e.target.value) })} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">% aprobado</label>
                    <input className="form-input" type="number" min="0" max="100" value={exam.pass_pct} onChange={(e) => setExam({ ...exam, pass_pct: Number(e.target.value) })} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Min (opc.)</label>
                    <input className="form-input" type="number" min="1" value={exam.time_limit_min ?? ''} onChange={(e) => setExam({ ...exam, time_limit_min: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                </div>
                <button className="btn btn-primary btn-small">Guardar configuración</button>
              </form>
            </div>
          )}

          <div className="card">
            <div className="card-header"><div className="card-title">Añadir pregunta</div></div>
            <div className="tabs">
              {(['test', 'vf', 'abierta'] as Format[]).map((f) => (
                <button key={f} type="button" className={`tab ${format === f ? 'active' : ''}`} onClick={() => { setFormat(f); setCorrect(0); }}>
                  {FORMAT_LABEL[f]}
                </button>
              ))}
            </div>
            <div className="form-group">
              <label className="form-label">Enunciado</label>
              <textarea className="form-input" style={{ height: 64, padding: 10 }} value={qText} onChange={(e) => setQText(e.target.value)} />
            </div>

            {format === 'test' && (
              <div className="form-group">
                <label className="form-label">Opciones (marca la correcta)</label>
                {options.map((opt, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <input type="radio" name="correct" checked={correct === i} onChange={() => setCorrect(i)} />
                    <input className="form-input" placeholder={`Opción ${String.fromCharCode(65 + i)}`} value={opt} onChange={(e) => setOptions((p) => p.map((o, idx) => (idx === i ? e.target.value : o)))} />
                  </div>
                ))}
              </div>
            )}
            {format === 'vf' && (
              <div className="form-group">
                <label className="form-label">Respuesta correcta</label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="radio" name="vf" checked={correct === 0} onChange={() => setCorrect(0)} /> Verdadero
                  </label>
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="radio" name="vf" checked={correct === 1} onChange={() => setCorrect(1)} /> Falso
                  </label>
                </div>
              </div>
            )}
            {format === 'abierta' && (
              <div className="info-box" style={{ marginBottom: 12, fontSize: 13 }}>
                Pregunta de respuesta libre (se corrige manualmente).
              </div>
            )}

            <button className="btn btn-primary btn-full" onClick={addQuestion} disabled={qText.trim().length < 3}>Añadir pregunta</button>
          </div>
        </div>

        {/* Lista de preguntas */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Preguntas</div>
            <div className="card-subtitle">{questions.length} en el examen</div>
          </div>
          {questions.map((q, i) => (
            <div key={q.id} style={{ borderBottom: '1px solid var(--gray-200)', padding: '10px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <span className="badge badge-primary" style={{ marginRight: 6 }}>{FORMAT_LABEL[q.format]}</span>
                  <strong>{i + 1}.</strong> {q.text}
                  {q.options.length > 0 && (
                    <ul style={{ margin: '6px 0 0 20px', fontSize: 13 }}>
                      {q.options.map((o, idx) => (
                        <li key={idx} style={{ color: idx === q.correct_index ? 'var(--success)' : undefined, fontWeight: idx === q.correct_index ? 700 : 400 }}>
                          {o}{idx === q.correct_index ? ' ✓' : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button className="btn btn-outline btn-small" onClick={() => deleteQuestion(q.id)}>✕</button>
              </div>
            </div>
          ))}
          {questions.length === 0 && <div className="muted">Aún no hay preguntas</div>}
        </div>
      </div>
    </AppShell>
  );
}
