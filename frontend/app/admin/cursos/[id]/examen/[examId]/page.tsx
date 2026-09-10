'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { api, ApiError, uploadFile } from '@/lib/api';
import { adminNav } from '@/lib/nav';
import { CalidadPreguntas } from '@/components/CalidadPreguntas';

type Format = 'test' | 'vf' | 'abierta' | 'escala' | 'emparejar' | 'multiple';
type Par = { left: string; right: string };
type MultiOpt = { text: string; correct: boolean };
interface ExamQuestion {
  id: string;
  format: Format;
  text: string;
  options: Array<string | Par | MultiOpt>;
  correct_index: number | null;
  explanation?: string | null;
  option_feedback?: string[];
  video_url?: string | null;
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
  feedback_general?: string | null;
}

interface BankRef { id: string; name: string; questions: string }
interface BankQ { id: string; tema: string | null; text: string }

const FORMAT_LABEL: Record<Format, string> = { test: '📝 Test', vf: '✔️ Verdadero/Falso', abierta: '✍️ Abierta', escala: '📊 Escala', emparejar: '🔀 Emparejar', multiple: '☑️ Selección múltiple' };

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
  const [tipo, setTipo] = useState<'test' | 'vf' | 'abierta' | 'imagen' | 'video' | 'escala' | 'emparejar' | 'multiple'>('test');
  const [mediaFormat, setMediaFormat] = useState<'test' | 'vf'>('test');
  const [videoUrl, setVideoUrl] = useState('');
  const [imgFile, setImgFile] = useState<File | null>(null);
  // escala (Likert): etiquetas de los extremos. emparejar: parejas correctas.
  const [escalaMin, setEscalaMin] = useState('Nada de acuerdo');
  const [escalaMax, setEscalaMax] = useState('Totalmente de acuerdo');
  const [pares, setPares] = useState<Par[]>([{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }]);
  // multiple (selección múltiple): opciones con marca de correcta (opcional).
  const [multi, setMulti] = useState<MultiOpt[]>([{ text: '', correct: false }, { text: '', correct: false }, { text: '', correct: false }, { text: '', correct: false }]);
  // Feedback: general de la pregunta + por opción. Y edición de una existente.
  const [expl, setExpl] = useState('');
  const [optFb, setOptFb] = useState<string[]>(['', '', '', '']);
  const [editingQId, setEditingQId] = useState<string | null>(null);

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
    setError(null);
    if (!exam) return;
    // En modo aleatorio hace falta N; sin él, el alumno recibiría el examen
    // entero en vez de un subconjunto (y sin avisar). Se exige antes de guardar.
    if (exam.random_per_student && (!exam.questions_per_attempt || exam.questions_per_attempt < 1)) {
      setError('En el modo «aleatorias en cada intento» indica cuántas preguntas por intento.');
      return;
    }
    try {
      await api(`/api/courses/${courseId}/exams/${examId}`, {
        method: 'PATCH',
        auth: true,
        body: JSON.stringify({
          title: exam.title,
          attemptsAllowed: exam.attempts_allowed,
          feedbackGeneral: exam.feedback_general ?? null,
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
  function realFormat(): Format {
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

  function resetForm() {
    setQText(''); setOptions(['', '', '', '']); setCorrect(0); setImgFile(null); setVideoUrl('');
    setPares([{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }]);
    setMulti([{ text: '', correct: false }, { text: '', correct: false }, { text: '', correct: false }, { text: '', correct: false }]);
    setExpl(''); setOptFb(['', '', '', '']); setEscalaMin('Nada de acuerdo'); setEscalaMax('Totalmente de acuerdo');
    setEditingQId(null); setTipo('test');
  }

  function construirBody(): Record<string, unknown> {
    const f = realFormat();
    const body: Record<string, unknown> = { format: f, text: qText, explanation: expl };
    if (videoUrl) body.videoUrl = videoUrl; // se conserva al editar
    if (f === 'test') {
      body.options = options; body.correctIndex = correct; body.optionFeedback = optFb;
    } else if (f === 'vf') {
      body.correctIndex = correct; body.optionFeedback = [optFb[0] ?? '', optFb[1] ?? ''];
    } else if (f === 'escala') {
      body.escalaMin = escalaMin; body.escalaMax = escalaMax;
    } else if (f === 'emparejar') {
      body.pares = pares.map((p) => ({ left: p.left.trim(), right: p.right.trim() })).filter((p) => p.left && p.right);
    } else if (f === 'multiple') {
      body.opcionesMulti = multi.map((o) => ({ text: o.text.trim(), correct: o.correct }));
      body.optionFeedback = optFb;
    }
    return body;
  }

  async function addQuestion() {
    setError(null);
    try {
      const body = construirBody();
      if (editingQId) {
        await api(`/api/courses/${courseId}/exams/${examId}/questions/${editingQId}`, { method: 'PATCH', auth: true, body: JSON.stringify(body) });
      } else {
        await api(`/api/courses/${courseId}/exams/${examId}/questions`, { method: 'POST', auth: true, body: JSON.stringify(body) });
      }
      resetForm();
      load();
    } catch (err) {
      const detail = err instanceof ApiError && err.details ? ' — ' + (err.details as Array<{ message: string }>).map((d) => d.message).join('; ') : '';
      setError((err instanceof ApiError ? err.message : 'Error') + detail);
    }
  }

  // Cargar una pregunta existente en el formulario para editarla (incl. feedback).
  function cargarParaEditar(q: ExamQuestion) {
    setEditingQId(q.id);
    setQText(q.text);
    setExpl(q.explanation ?? '');
    setVideoUrl(q.video_url ?? '');
    const fb = q.option_feedback ?? [];
    if (q.format === 'test') {
      setTipo('test');
      const opts = (q.options as string[]);
      setOptions(opts.length >= 2 ? [...opts] : [...opts, '', '', ''].slice(0, 4));
      setCorrect(q.correct_index ?? 0);
      setOptFb([...fb, '', '', '', ''].slice(0, Math.max(4, opts.length)));
    } else if (q.format === 'vf') {
      setTipo('vf'); setCorrect(q.correct_index ?? 0); setOptFb([fb[0] ?? '', fb[1] ?? '']);
    } else if (q.format === 'escala') {
      setTipo('escala'); const o = q.options as string[]; setEscalaMin(o[0] ?? ''); setEscalaMax(o[1] ?? '');
    } else if (q.format === 'emparejar') {
      setTipo('emparejar'); setPares((q.options as Par[]).map((p) => ({ left: p.left, right: p.right })));
    } else if (q.format === 'multiple') {
      setTipo('multiple'); setMulti((q.options as MultiOpt[]).map((o) => ({ text: o.text, correct: !!o.correct }))); setOptFb([...fb]);
    } else {
      setTipo('abierta');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
                    <input className="form-input" type="number" min="1" placeholder="∞" disabled={exam.attempts_allowed === 0}
                      value={exam.attempts_allowed === 0 ? '' : exam.attempts_allowed}
                      onChange={(e) => setExam({ ...exam, attempts_allowed: Number(e.target.value) || 1 })} />
                    <label className="muted" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, marginTop: 4 }}>
                      <input type="checkbox" checked={exam.attempts_allowed === 0} onChange={(e) => setExam({ ...exam, attempts_allowed: e.target.checked ? 0 : 1 })} /> Infinitos
                    </label>
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

                <div className="form-group">
                  <label className="form-label">Valoración general (la ve el alumno al terminar)</label>
                  <textarea className="form-input" style={{ height: 60, padding: 10 }} placeholder="Mensaje de cierre / recomendaciones para el alumno…"
                    value={exam.feedback_general ?? ''} onChange={(e) => setExam({ ...exam, feedback_general: e.target.value })} />
                </div>

                <button className="btn btn-primary btn-small">Guardar configuración</button>
              </form>
            </div>
          )}

          <div className="card">
            <div className="card-header"><div className="card-title">{editingQId ? '✏️ Editar pregunta' : 'Añadir pregunta'}</div></div>
            <div className="tabs">
              {([
                ['test', 'Test'], ['vf', 'Verdadero / Falso'], ['multiple', 'Selección múltiple'], ['abierta', 'Abierta'],
                ['escala', 'Escala'], ['emparejar', 'Emparejar'],
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
                  <div key={i} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="radio" name="correct" checked={correct === i} onChange={() => setCorrect(i)} />
                      <input className="form-input" placeholder={`Opción ${String.fromCharCode(65 + i)}`} value={opt} onChange={(e) => setOptions((p) => p.map((o, idx) => (idx === i ? e.target.value : o)))} />
                    </div>
                    <input className="form-input" style={{ marginTop: 4, marginLeft: 24, width: 'calc(100% - 24px)', fontSize: 12.5 }}
                      placeholder="Feedback de esta opción (opcional): por qué es correcta o no"
                      value={optFb[i] ?? ''} onChange={(e) => setOptFb((p) => { const n = [...p]; while (n.length <= i) n.push(''); n[i] = e.target.value; return n; })} />
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
                <input className="form-input" style={{ marginTop: 6, fontSize: 12.5 }} placeholder="Feedback si responde Verdadero (opcional)"
                  value={optFb[0] ?? ''} onChange={(e) => setOptFb((p) => { const n = [...p]; n[0] = e.target.value; return n; })} />
                <input className="form-input" style={{ marginTop: 4, fontSize: 12.5 }} placeholder="Feedback si responde Falso (opcional)"
                  value={optFb[1] ?? ''} onChange={(e) => setOptFb((p) => { const n = [...p]; while (n.length < 2) n.push(''); n[1] = e.target.value; return n; })} />
              </div>
            )}
            {tipo === 'multiple' && (
              <div className="form-group">
                <label className="form-label">Opciones (marca las correctas)</label>
                {multi.map((o, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <label title="Marcar como correcta" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                        <input type="checkbox" checked={o.correct} onChange={(e) => setMulti((ms) => ms.map((x, k) => (k === i ? { ...x, correct: e.target.checked } : x)))} /> ✓
                      </label>
                      <input className="form-input" placeholder={`Opción ${i + 1}`} value={o.text}
                        onChange={(e) => setMulti((ms) => ms.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))} />
                      {multi.length > 2 && <button type="button" className="btn btn-outline btn-small" onClick={() => setMulti((ms) => ms.filter((_, k) => k !== i))}>✕</button>}
                    </div>
                    <input className="form-input" style={{ marginTop: 4, marginLeft: 26, width: 'calc(100% - 26px)', fontSize: 12.5 }}
                      placeholder="Feedback de esta opción (opcional)"
                      value={optFb[i] ?? ''} onChange={(e) => setOptFb((p) => { const n = [...p]; while (n.length <= i) n.push(''); n[i] = e.target.value; return n; })} />
                  </div>
                ))}
                {multi.length < 12 && <button type="button" className="btn btn-outline btn-small" onClick={() => setMulti((ms) => [...ms, { text: '', correct: false }])}>+ Añadir opción</button>}
                <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  El alumno marca todas las que quiera. Marca las correctas para que puntúe (crédito parcial). Si no marcas ninguna, es una encuesta y no puntúa.
                </p>
              </div>
            )}
            {tipo === 'escala' && (
              <div className="form-group">
                <label className="form-label">Etiquetas de la escala (1 a 5)</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className="form-input" value={escalaMin} onChange={(e) => setEscalaMin(e.target.value)} placeholder="1 = …" />
                  <span className="muted">…</span>
                  <input className="form-input" value={escalaMax} onChange={(e) => setEscalaMax(e.target.value)} placeholder="5 = …" />
                </div>
                <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>El alumno elige del 1 al 5. No puntúa (es una opinión / autoevaluación).</p>
              </div>
            )}
            {tipo === 'emparejar' && (
              <div className="form-group">
                <label className="form-label">Parejas correctas (izquierda ↔ derecha)</label>
                {pares.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                    <input className="form-input" placeholder={`Izquierda ${i + 1}`} value={p.left}
                      onChange={(e) => setPares((ps) => ps.map((x, k) => (k === i ? { ...x, left: e.target.value } : x)))} />
                    <span className="muted">↔</span>
                    <input className="form-input" placeholder={`Derecha ${i + 1}`} value={p.right}
                      onChange={(e) => setPares((ps) => ps.map((x, k) => (k === i ? { ...x, right: e.target.value } : x)))} />
                    {pares.length > 2 && <button type="button" className="btn btn-outline btn-small" onClick={() => setPares((ps) => ps.filter((_, k) => k !== i))}>✕</button>}
                  </div>
                ))}
                {pares.length < 8 && <button type="button" className="btn btn-outline btn-small" onClick={() => setPares((ps) => [...ps, { left: '', right: '' }])}>+ Añadir pareja</button>}
                <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>La columna derecha se baraja en cada intento. Cada pareja acertada suma (crédito parcial).</p>
              </div>
            )}
            {tipo === 'abierta' && (
              <div className="info-box" style={{ marginBottom: 12, fontSize: 13 }}>
                Pregunta de respuesta libre (se corrige manualmente).
              </div>
            )}

            {/* Feedback general de la pregunta (por qué), para todos los tipos. */}
            <div className="form-group">
              <label className="form-label">Feedback / explicación (opcional)</label>
              <textarea className="form-input" style={{ height: 56, padding: 10 }}
                placeholder="Se muestra al alumno al revisar. Por qué la respuesta correcta es esa, matices, etc."
                value={expl} onChange={(e) => setExpl(e.target.value)} />
            </div>

            <button className="btn btn-primary btn-full"
              onClick={tipo === 'imagen' ? addQuestionWithImage : addQuestion}
              disabled={qText.trim().length < 3 || (tipo === 'imagen' && !imgFile) || (tipo === 'video' && !videoUrl.trim())
                || (tipo === 'emparejar' && pares.filter((p) => p.left.trim() && p.right.trim()).length < 2)
                || (tipo === 'multiple' && multi.filter((o) => o.text.trim()).length < 2)}>
              {editingQId ? 'Guardar cambios' : 'Añadir pregunta'}
            </button>
            {editingQId && (
              <button className="btn btn-outline btn-small btn-full" style={{ marginTop: 6 }} onClick={resetForm}>Cancelar edición</button>
            )}
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
                  {q.format === 'emparejar' ? (
                    <ul style={{ margin: '6px 0 0 20px', fontSize: 13 }}>
                      {(q.options as Par[]).map((p, idx) => (
                        <li key={idx}>{p.left} <span className="muted">↔</span> {p.right}</li>
                      ))}
                    </ul>
                  ) : q.format === 'multiple' ? (
                    <ul style={{ margin: '6px 0 0 20px', fontSize: 13 }}>
                      {(q.options as MultiOpt[]).map((o, idx) => (
                        <li key={idx} style={{ color: o.correct ? 'var(--success)' : undefined, fontWeight: o.correct ? 700 : 400 }}>
                          {o.text}{o.correct ? ' ✓' : ''}
                        </li>
                      ))}
                    </ul>
                  ) : q.format === 'escala' ? (
                    <div className="muted" style={{ fontSize: 13, marginLeft: 20 }}>
                      Escala 1–5: {(q.options as string[])[0]} … {(q.options as string[])[1]}
                    </div>
                  ) : q.options.length > 0 && (
                    <ul style={{ margin: '6px 0 0 20px', fontSize: 13 }}>
                      {(q.options as string[]).map((o, idx) => (
                        <li key={idx} style={{ color: idx === q.correct_index ? 'var(--success)' : undefined, fontWeight: idx === q.correct_index ? 700 : 400 }}>
                          {o}{idx === q.correct_index ? ' ✓' : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                  {q.explanation && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>💬 {q.explanation}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-outline btn-small" title="Editar (incl. feedback)" onClick={() => cargarParaEditar(q)}>✏️</button>
                  <button className="btn btn-outline btn-small" onClick={() => deleteQuestion(q.id)}>✕</button>
                </div>
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
