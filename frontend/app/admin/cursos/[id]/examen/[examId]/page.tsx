'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { api, ApiError, uploadFile } from '@/lib/api';
import { PageNav } from '@/components/PageNav';
import { adminNav } from '@/lib/nav';
import { CalidadPreguntas } from '@/components/CalidadPreguntas';

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
  const user = useSession(['super_admin', 'profesor', 'auditor'], '/login/admin');

  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cfgMsg, setCfgMsg] = useState<string | null>(null);

  // new question
  const [format, setFormat] = useState<Format>('test');
  const [qText, setQText] = useState('');
  const [options, setOptions] = useState<string[]>(['', '', '', '']);
  const [correct, setCorrect] = useState(0);
  // Tipo elegido en la pestaña: los de media generan una pregunta test o V/F
  // que además lleva imagen o vídeo.
  const [tipo, setTipo] = useState<'test' | 'vf' | 'abierta' | 'imagen' | 'video'>('test');
  const [mediaFormat, setMediaFormat] = useState<'test' | 'vf'>('test');
  const [videoUrl, setVideoUrl] = useState('');
  const [imgFile, setImgFile] = useState<File | null>(null);

  // JSON import
  const [jsonText, setJsonText] = useState('');
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Calificaciones
  const [attempts, setAttempts] = useState<Array<{ id: string; student: string; email: string; score: number | null; passed: boolean | null; attempts: string; time_spent_seconds: number | null }>>([]);

  async function load() {
    try {
      const r = await api<{ exam: Exam; questions: ExamQuestion[] }>(`/api/courses/${courseId}/exams/${examId}`, { auth: true });
      setExam(r.exam);
      setQuestions(r.questions);
      try {
        const a = await api<{ attempts: typeof attempts }>(`/api/courses/${courseId}/exams/${examId}/attempts`, { auth: true });
        setAttempts(a.attempts);
      } catch {
        /* ignore */
      }
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

  /** Formato real que se guarda (los tipos de media son test o V/F). */
  function realFormat(): 'test' | 'vf' | 'abierta' {
    return tipo === 'imagen' || tipo === 'video' ? mediaFormat : tipo;
  }

  async function addQuestionWithImage() {
    if (!imgFile) return;
    setError(null);
    try {
      const f = realFormat();
      await uploadFile(`/api/courses/${courseId}/exams/${examId}/questions/image`, imgFile, {
        format: f,
        text: qText,
        correctIndex: String(correct),
        options: JSON.stringify(f === 'test' ? options.map((o) => o.trim()).filter(Boolean) : []),
      });
      setQText(''); setOptions(['', '', '', '']); setCorrect(0); setImgFile(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al añadir la pregunta');
    }
  }

  async function addQuestion() {
    setError(null);
    try {
      const f = realFormat();
      const body: Record<string, unknown> = { format: f, text: qText };
      if (tipo === 'video' && videoUrl) body.videoUrl = videoUrl;
      if (f === 'test') {
        body.options = options.map((o) => o.trim()).filter(Boolean);
        body.correctIndex = correct;
      } else if (f === 'vf') {
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

  async function importJson() {
    setImportMsg(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setImportMsg({ ok: false, text: 'El JSON no es válido (revisa comas y corchetes).' });
      return;
    }
    if (!Array.isArray(parsed)) {
      setImportMsg({ ok: false, text: 'El JSON debe ser una lista [ ... ] de preguntas.' });
      return;
    }
    try {
      const res = await api<{ created: number; total: number; errors: Array<{ fila: number; errores: string[] }> }>(
        `/api/courses/${courseId}/exams/${examId}/questions/import`,
        { method: 'POST', auth: true, body: JSON.stringify({ questions: parsed }) },
      );
      setImportMsg({
        ok: res.errors.length === 0,
        text: `Creadas ${res.created} de ${res.total}.` + (res.errors.length ? ` Errores en filas: ${res.errors.map((e) => e.fila).join(', ')}` : ''),
      });
      setJsonText('');
      load();
    } catch (err) {
      setImportMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Error al importar' });
    }
  }

  function loadJsonFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setJsonText(String(reader.result ?? ''));
    reader.readAsText(file);
  }

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  const nav = adminNav(user.role, '/admin/cursos');

  return (
    <AppShell user={user} title={exam?.title ?? 'Examen'} nav={nav}>
      <PageNav backHref={`/admin/cursos/${courseId}`} backLabel="Volver al curso" />
      {error && <div className="alert alert-error">{error}</div>}

      <CalidadPreguntas courseId={courseId} examId={examId} />

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
                    <label className="form-label">Minutos (vacío = libre)</label>
                    <input className="form-input" type="number" min="1" placeholder="libre" value={exam.time_limit_min ?? ''} onChange={(e) => setExam({ ...exam, time_limit_min: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                </div>
                <button className="btn btn-primary btn-small">Guardar configuración</button>
              </form>
            </div>
          )}

          <div className="card">
            <div className="card-header"><div className="card-title">Añadir pregunta</div></div>
            <div className="tabs">
              {([
                ['test', 'Test'], ['vf', 'Verdadero / Falso'], ['abierta', 'Abierta'],
                ['imagen', 'Con imagen'], ['video', 'Con vídeo'],
              ] as Array<[typeof tipo, string]>).map(([t, label]) => (
                <button key={t} type="button" className={`tab ${tipo === t ? 'active' : ''}`}
                  onClick={() => { setTipo(t); setCorrect(0); }}>
                  {label}
                </button>
              ))}
            </div>

            {(tipo === 'imagen' || tipo === 'video') && (
              <>
                <div className="info-box" style={{ fontSize: 13, marginBottom: 10 }}>
                  El alumno responderá a partir de {tipo === 'imagen' ? 'la imagen' : 'el vídeo'}. Elige si la pregunta será tipo test o Verdadero/Falso.
                </div>
                <div className="form-group">
                  <label className="form-label">Formato de la respuesta</label>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="radio" name="mf" checked={mediaFormat === 'test'} onChange={() => { setMediaFormat('test'); setCorrect(0); }} /> Test
                    </label>
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="radio" name="mf" checked={mediaFormat === 'vf'} onChange={() => { setMediaFormat('vf'); setCorrect(0); }} /> Verdadero / Falso
                    </label>
                  </div>
                </div>
                {tipo === 'video' ? (
                  <div className="form-group">
                    <label className="form-label">URL del vídeo</label>
                    <input className="form-input" placeholder="https://…" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label">Imagen</label>
                    <input type="file" accept="image/*" onChange={(e) => setImgFile(e.target.files?.[0] ?? null)} />
                    {imgFile && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{imgFile.name}</div>}
                  </div>
                )}
              </>
            )}
            <div className="form-group">
              <label className="form-label">Enunciado</label>
              <textarea className="form-input" style={{ height: 64, padding: 10 }} value={qText} onChange={(e) => setQText(e.target.value)} />
            </div>

            {realFormat() === 'test' && tipo !== 'abierta' && (
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
            {realFormat() === 'vf' && (
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
            {tipo === 'abierta' && (
              <div className="info-box" style={{ marginBottom: 12, fontSize: 13 }}>
                Pregunta de respuesta libre (se corrige manualmente).
              </div>
            )}

            <button className="btn btn-primary btn-full"
              onClick={tipo === 'imagen' ? addQuestionWithImage : addQuestion}
              disabled={qText.trim().length < 3 || (tipo === 'imagen' && !imgFile) || (tipo === 'video' && !videoUrl.trim())}>
              Añadir pregunta
            </button>
          </div>

          {/* Importar por JSON */}
          <div className="card" style={{ marginTop: 24 }}>
            <div className="card-header">
              <div className="card-title">Importar preguntas (JSON)</div>
              <div className="card-subtitle">Pega el JSON o carga un archivo (ideal para IA)</div>
            </div>
            {importMsg && <div className={`alert ${importMsg.ok ? 'alert-success' : 'alert-error'}`}>{importMsg.text}</div>}
            <div className="info-box" style={{ fontSize: 12, marginBottom: 10 }}>
              Lista JSON. Cada pregunta: <code>format</code> (test/vf/abierta), <code>text</code>,
              <code> options</code> y <code>correcta</code> (A/B/C/D) para test, <code>correcta</code> (V/F) para vf.
            </div>
            <textarea
              className="form-input"
              style={{ height: 120, padding: 10, fontFamily: 'monospace', fontSize: 12 }}
              placeholder='[{"format":"test","text":"...","options":["a","b"],"correcta":"B"}]'
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
              <label className="btn btn-outline btn-small" style={{ cursor: 'pointer' }}>
                Cargar .json
                <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={(e) => { loadJsonFile(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              <button className="btn btn-primary btn-small" style={{ marginLeft: 'auto' }} onClick={importJson} disabled={!jsonText.trim()}>
                Importar
              </button>
            </div>
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

      {/* Calificaciones */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <div className="card-title">Calificaciones</div>
          <div className="card-subtitle">Notas, intentos y tiempo por alumno</div>
        </div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr><th>Alumno</th><th>Nota</th><th>Resultado</th><th>Intentos</th><th>Tiempo</th></tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id}>
                  <td>{a.student}<div className="muted" style={{ fontSize: 12 }}>{a.email}</div></td>
                  <td>{a.score ?? '—'}%</td>
                  <td>{a.passed == null ? '—' : a.passed ? <span className="badge badge-success">Aprobado</span> : <span className="badge badge-danger">No superado</span>}</td>
                  <td>{a.attempts}</td>
                  <td>{a.time_spent_seconds != null ? `${Math.floor(a.time_spent_seconds / 60)}m ${a.time_spent_seconds % 60}s` : '—'}</td>
                </tr>
              ))}
              {attempts.length === 0 && <tr><td colSpan={5} className="muted">Aún nadie ha realizado el examen</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
