'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { api, ApiError, uploadFile } from '@/lib/api';
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
  shuffle: boolean;
  random_per_student: boolean;
  questions_per_attempt: number | null;
}

interface BankRef { id: string; name: string; questions: string }
interface BankQ { id: string; tema: string | null; text: string }

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

  // Importar preguntas desde un banco
  const [banks, setBanks] = useState<BankRef[]>([]);
  const [bankSel, setBankSel] = useState('');
  const [bankCount, setBankCount] = useState('10');
  const [bankQs, setBankQs] = useState<BankQ[] | null>(null);
  const [bankPick, setBankPick] = useState<Record<string, boolean>>({});
  const [bankMsg, setBankMsg] = useState<{ ok: boolean; text: string } | null>(null);

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

  // Bancos disponibles como fuente de preguntas.
  useEffect(() => {
    if (!user) return;
    api<{ banks: BankRef[] }>('/api/banks?conPreguntas=1', { auth: true })
      .then((r) => setBanks(r.banks)).catch(() => {});
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
          shuffle: exam.shuffle,
          randomPerStudent: exam.random_per_student,
          questionsPerAttempt: exam.random_per_student ? (exam.questions_per_attempt ?? null) : null,
        }),
      });
      setCfgMsg('Configuración guardada ✅');
    } catch (err) {
      setCfgMsg(err instanceof ApiError ? err.message : 'Error');
    }
  }

  // Modo por intento derivado de los dos flags, y su setter.
  const modo: 'fijo' | 'barajado' | 'aleatorio' =
    exam?.random_per_student ? 'aleatorio' : exam?.shuffle ? 'barajado' : 'fijo';
  function setModo(m: 'fijo' | 'barajado' | 'aleatorio') {
    if (!exam) return;
    if (m === 'fijo') setExam({ ...exam, shuffle: false, random_per_student: false });
    else if (m === 'barajado') setExam({ ...exam, shuffle: true, random_per_student: false });
    else setExam({ ...exam, shuffle: true, random_per_student: true, questions_per_attempt: exam.questions_per_attempt ?? Math.min(10, questions.length || 10) });
  }

  async function importarDelBanco(soloSeleccionadas: boolean) {
    if (!bankSel) { setBankMsg({ ok: false, text: 'Elige un banco' }); return; }
    setBankMsg(null);
    try {
      if (soloSeleccionadas) {
        const ids = Object.keys(bankPick).filter((k) => bankPick[k]);
        if (ids.length === 0) { setBankMsg({ ok: false, text: 'Marca al menos una pregunta' }); return; }
        const r = await api<{ added: number }>(`/api/courses/${courseId}/exams/${examId}/questions/from-bank/select`,
          { method: 'POST', auth: true, body: JSON.stringify({ bankId: bankSel, questionIds: ids }) });
        setBankMsg({ ok: true, text: `Añadidas ${r.added} preguntas del banco ✅` });
        setBankPick({});
      } else {
        const n = Math.max(1, Number(bankCount) || 1);
        const r = await api<{ added: number }>(`/api/courses/${courseId}/exams/${examId}/questions/from-bank`,
          { method: 'POST', auth: true, body: JSON.stringify({ bankId: bankSel, count: n }) });
        setBankMsg({ ok: true, text: `Añadidas ${r.added} preguntas al azar ✅` });
      }
      load();
    } catch (err) {
      setBankMsg({ ok: false, text: err instanceof ApiError ? err.message : 'No se pudo importar' });
    }
  }

  async function verPreguntasBanco() {
    if (!bankSel) { setBankMsg({ ok: false, text: 'Elige un banco' }); return; }
    setBankMsg(null); setBankQs(null); setBankPick({});
    try {
      const r = await api<{ questions: BankQ[] }>(`/api/banks/${bankSel}/questions`, { auth: true });
      setBankQs(r.questions);
    } catch (err) {
      setBankMsg({ ok: false, text: err instanceof ApiError ? err.message : 'No se pudieron cargar' });
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

                <div className="form-group">
                  <label className="form-label">En cada intento</label>
                  <select className="form-select" value={modo} onChange={(e) => setModo(e.target.value as typeof modo)}>
                    <option value="fijo">Mismas preguntas, mismo orden</option>
                    <option value="barajado">Mismas preguntas, orden distinto cada vez</option>
                    <option value="aleatorio">Preguntas aleatorias del conjunto en cada intento</option>
                  </select>
                  <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    {modo === 'aleatorio'
                      ? 'Cada intento saca al azar N preguntas del total del examen. Añade abajo todo el banco y elige N.'
                      : modo === 'barajado'
                        ? 'Se usan todas las preguntas del examen; solo cambia el orden.'
                        : 'Todos los alumnos ven las mismas preguntas en el mismo orden.'}
                  </p>
                  {modo === 'aleatorio' && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                      <span className="muted" style={{ fontSize: 13 }}>Preguntas por intento:</span>
                      <input className="form-input" type="number" min="1" style={{ width: 90 }}
                        value={exam.questions_per_attempt ?? ''} placeholder="N"
                        onChange={(e) => setExam({ ...exam, questions_per_attempt: e.target.value ? Number(e.target.value) : null })} />
                      <span className="muted" style={{ fontSize: 12 }}>de {questions.length} en el examen</span>
                    </div>
                  )}
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

          {/* Importar preguntas desde un banco */}
          <div className="card" style={{ marginTop: 24 }}>
            <div className="card-header"><div className="card-title">Traer preguntas de un banco</div></div>
            {bankMsg && <div className={`alert ${bankMsg.ok ? 'alert-success' : 'alert-error'}`}>{bankMsg.text}</div>}
            <div className="form-group">
              <label className="form-label">Banco</label>
              <select className="form-select" value={bankSel} onChange={(e) => { setBankSel(e.target.value); setBankQs(null); setBankPick({}); }}>
                <option value="">Elige un banco…</option>
                {banks.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.questions})</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="muted" style={{ fontSize: 13 }}>Al azar:</span>
              <input className="form-input" type="number" min="1" style={{ width: 80 }} value={bankCount} onChange={(e) => setBankCount(e.target.value)} />
              <button className="btn btn-outline btn-small" onClick={() => importarDelBanco(false)} disabled={!bankSel}>Añadir N al azar</button>
              <button className="btn btn-outline btn-small" onClick={verPreguntasBanco} disabled={!bankSel}>Elegir preguntas concretas</button>
            </div>

            {bankQs && (
              <div style={{ marginTop: 12 }}>
                {bankQs.length === 0 ? (
                  <p className="muted" style={{ fontSize: 13 }}>Ese banco no tiene preguntas.</p>
                ) : (
                  <>
                    <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--gray-200)', borderRadius: 8, padding: 8 }}>
                      {bankQs.map((q) => (
                        <label key={q.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '4px 0', fontSize: 13 }}>
                          <input type="checkbox" checked={!!bankPick[q.id]} onChange={(e) => setBankPick((p) => ({ ...p, [q.id]: e.target.checked }))} />
                          <span>{q.tema && <span className="muted">[{q.tema}] </span>}{q.text}</span>
                        </label>
                      ))}
                    </div>
                    <button className="btn btn-primary btn-small" style={{ marginTop: 8 }} onClick={() => importarDelBanco(true)}>
                      Añadir seleccionadas ({Object.values(bankPick).filter(Boolean).length})
                    </button>
                  </>
                )}
              </div>
            )}
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
