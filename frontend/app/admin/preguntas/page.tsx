'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { api, ApiError, downloadFile, uploadFile } from '@/lib/api';
import { adminNav } from '@/lib/nav';
import { VideoEmbed } from '@/components/VideoEmbed';

type Level = 'SVB' | 'SVI' | 'SVA';
type Audience = 'ninos' | 'jovenes' | 'adultos';
type QType = 'teorica' | 'caso_clinico';

type Visibility = 'privado' | 'publico' | 'restringido';

interface QuestionRow {
  id: string;
  category: Level;
  audiences: Audience[];
  qtype: QType;
  difficulty: number;
  text: string;
  tema: string | null;
  is_critical: boolean;
  bank_name: string | null;
  bank_visibility: Visibility | null;
}

interface FullQuestion {
  id: string;
  bank_id: string;
  tema: string | null;
  category: Level | null;
  audiences: Audience[];
  qtype: QType;
  difficulty: number;
  text: string;
  clinical_context: string | null;
  options: string[];
  correct_index: number;
  explanation: string | null;
  source_erc: string | null;
  source_plan_nacional: string | null;
  video_url: string | null;
  image_url?: string | null;
  flashcard: string | null;
  tags: string[];
  is_critical: boolean;
  ref_document_id: string | null;
  ref_page: number | null;
}

const AUDIENCE_LABEL: Record<Audience, string> = {
  ninos: '👶 Niños',
  jovenes: '🧑 Jóvenes',
  adultos: '👨 Adultos',
};

/** Previsualización de una pregunta tal como la ve el alumno (con la correcta marcada). */
function PreviewAlumno({ q, onClose }: { q: FullQuestion; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div className="card-title">Vista del alumno</div>
          <button className="btn btn-outline btn-small" onClick={onClose}>Cerrar</button>
        </div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
          Así se ve al responderla. La opción correcta va resaltada (el alumno no la ve hasta corregir).
        </div>

        {q.qtype === 'caso_clinico' && q.clinical_context && (
          <div className="info-box" style={{ marginBottom: 12 }}>{q.clinical_context}</div>
        )}
        {q.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={q.image_url} alt="" style={{ maxWidth: '100%', borderRadius: 10, marginBottom: 12 }} />
        )}
        {q.video_url && <div style={{ marginBottom: 12 }}><VideoEmbed url={q.video_url} /></div>}

        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 12 }}>{q.text}</div>

        <div style={{ display: 'grid', gap: 8 }}>
          {q.options.map((op, i) => {
            const correcta = i === q.correct_index;
            return (
              <div key={i} style={{
                padding: '10px 12px', borderRadius: 10,
                border: `1.5px solid ${correcta ? 'var(--success)' : 'var(--gray-200)'}`,
                background: correcta ? 'rgba(39,103,73,0.08)' : '#fff',
                display: 'flex', gap: 10, alignItems: 'center',
              }}>
                <span style={{ fontWeight: 700, color: correcta ? 'var(--success)' : 'var(--text-secondary)' }}>{String.fromCharCode(65 + i)}</span>
                <span style={{ flex: 1 }}>{op}</span>
                {correcta && <span className="badge badge-success">correcta</span>}
              </div>
            );
          })}
        </div>

        {q.explanation && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Explicación (debriefing)</div>
            <div className="info-box" style={{ fontSize: 13.5 }}>{q.explanation}</div>
          </div>
        )}
      </div>
    </div>
  );
}

const VIS_LABEL: Record<Visibility, string> = {
  privado: '🔒 Privado',
  publico: '🌐 Público',
  restringido: '👥 Restringido',
};

export default function PreguntasPage() {
  const user = useSession(['super_admin', 'profesor'], '/login/admin');

  // form state
  const [banks, setBanks] = useState<Array<{ id: string; name: string; kind: string }>>([]);
  const [bankId, setBankId] = useState('');
  const [tema, setTema] = useState('');
  const [qImage, setQImage] = useState<File | null>(null);
  const [filterMedia, setFilterMedia] = useState('');
  // Filtros del listado (en cliente, sobre lo ya cargado): nivel, tema, visibilidad.
  const [fNivel, setFNivel] = useState<'' | Level>('');
  const [fTema, setFTema] = useState('');
  const [fVis, setFVis] = useState<'' | Visibility>('');
  // Edición de una pregunta existente + previsualización «como alumno».
  const [editId, setEditId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [preview, setPreview] = useState<FullQuestion | null>(null);
  const [category, setCategory] = useState<Level>('SVB');
  const [audiences, setAudiences] = useState<Audience[]>(['jovenes', 'adultos']);
  const [qtype, setQtype] = useState<QType>('teorica');
  const [difficulty, setDifficulty] = useState(1);
  const [clinicalContext, setClinicalContext] = useState('');
  const [text, setText] = useState('');
  const [options, setOptions] = useState<string[]>(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [explanation, setExplanation] = useState('');
  const [sourceErc, setSourceErc] = useState('');
  const [sourcePlan, setSourcePlan] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [flashcard, setFlashcard] = useState('');
  const [tags, setTags] = useState('');
  const [isCritical, setIsCritical] = useState(false);

  const [refDocumentId, setRefDocumentId] = useState('');
  const [refPage, setRefPage] = useState('');

  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [list, setList] = useState<QuestionRow[]>([]);
  const [docs, setDocs] = useState<Array<{ id: string; title: string }>>([]);

  // Bulk import
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    created: number;
    duplicadas?: number;
    total: number;
    errors: Array<{ fila: number; errores: string[] }>;
    posibleReimport?: boolean;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  async function loadList(media?: string) {
    try {
      const [q, d, b] = await Promise.all([
        api<{ questions: QuestionRow[] }>(`/api/questions${media ? `?media=${media}` : ''}`, { auth: true }),
        api<{ documents: Array<{ id: string; title: string }> }>('/api/documents', { auth: true }),
        api<{ banks: Array<{ id: string; name: string; kind: string }> }>('/api/banks', { auth: true }).catch(() => ({ banks: [] })),
      ]);
      setList(q.questions);
      setDocs(d.documents);
      setBanks(b.banks);
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    if (user) loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function toggleAudience(a: Audience) {
    setAudiences((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }
  function setOption(i: number, v: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? v : o)));
  }
  function addOption() {
    if (options.length < 6) setOptions((p) => [...p, '']);
  }
  function removeOption(i: number) {
    if (options.length <= 2) return;
    setOptions((p) => p.filter((_, idx) => idx !== i));
    if (correctIndex >= options.length - 1) setCorrectIndex(0);
  }

  function resetForm() {
    setText('');
    setClinicalContext('');
    setOptions(['', '', '', '']);
    setCorrectIndex(0);
    setExplanation('');
    setSourceErc('');
    setSourcePlan('');
    setVideoUrl('');
    setFlashcard('');
    setTags('');
    setIsCritical(false);
    setRefDocumentId('');
    setRefPage('');
  }

  /** Cargar una pregunta existente en el formulario para editarla. */
  async function editar(id: string) {
    setMsg(null);
    try {
      const { question: q } = await api<{ question: FullQuestion }>(`/api/questions/${id}`, { auth: true });
      setEditId(q.id);
      setBankId(q.bank_id);
      setTema(q.tema ?? '');
      setCategory((q.category ?? 'SVB') as Level);
      setAudiences(q.audiences?.length ? q.audiences : ['adultos']);
      setQtype(q.qtype);
      setDifficulty(q.difficulty);
      setClinicalContext(q.clinical_context ?? '');
      setText(q.text);
      setOptions(q.options?.length ? q.options : ['', '']);
      setCorrectIndex(q.correct_index ?? 0);
      setExplanation(q.explanation ?? '');
      setSourceErc(q.source_erc ?? '');
      setSourcePlan(q.source_plan_nacional ?? '');
      setVideoUrl(q.video_url ?? '');
      setFlashcard(q.flashcard ?? '');
      setTags((q.tags ?? []).join(', '));
      setIsCritical(q.is_critical);
      setRefDocumentId(q.ref_document_id ?? '');
      setRefPage(q.ref_page ? String(q.ref_page) : '');
      setQImage(null);
      setFormOpen(true);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'No se pudo cargar la pregunta' });
    }
  }

  function salirEdicion() {
    setEditId(null);
    setBankId('');
    setTema('');
    resetForm();
  }

  async function verComoAlumno(id: string) {
    setMsg(null);
    try {
      const { question } = await api<{ question: FullQuestion }>(`/api/questions/${id}`, { auth: true });
      setPreview(question);
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'No se pudo previsualizar' });
    }
  }

  async function handleImport(file: File | undefined) {
    if (!file) return;
    setImportError(null);
    setImportResult(null);
    if (!bankId) { setImportError('Elige primero el banco de destino (arriba, en el formulario).'); return; }
    setImporting(true);
    try {
      const res = await uploadFile<{ created: number; duplicadas: number; total: number; errors: Array<{ fila: number; errores: string[] }>; posibleReimport: boolean }>(
        '/api/questions/import',
        file,
        { bankId },
      );
      setImportResult(res);
      loadList();
    } catch (err) {
      setImportError(err instanceof ApiError ? err.message : 'Error al importar');
    } finally {
      setImporting(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setSaving(true);
    try {
      const payload = {
          bankId,
          tema: tema || undefined,
          category,
          audiences,
          qtype,
          difficulty,
          text,
          clinicalContext: qtype === 'caso_clinico' ? clinicalContext : undefined,
          options: options.map((o) => o.trim()).filter(Boolean),
          correctIndex,
          explanation: explanation || undefined,
          sourceErc: sourceErc || undefined,
          sourcePlanNacional: sourcePlan || undefined,
          videoUrl: videoUrl || '',
          flashcard: flashcard || undefined,
          tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          isCritical,
          refDocumentId: refDocumentId || undefined,
          refPage: refPage ? Number(refPage) : undefined,
      };
      if (editId) {
        // Edición: se actualizan las etiquetas y el contenido (la imagen se
        // conserva; para cambiarla se crea una pregunta nueva por ahora).
        await api(`/api/questions/${editId}`, { method: 'PATCH', auth: true, body: JSON.stringify(payload) });
        setMsg({ ok: true, text: 'Pregunta actualizada ✅' });
        salirEdicion();
        loadList(filterMedia || undefined);
        return;
      }
      if (qImage) {
        // Con imagen: va como multipart, pero conserva TODAS las etiquetas.
        await uploadFile('/api/questions/image', qImage, {
          bankId, tema: tema || '', category, audiences: JSON.stringify(audiences),
          qtype, difficulty: String(difficulty), text,
          clinicalContext: qtype === 'caso_clinico' ? clinicalContext : '',
          options: JSON.stringify(options.map((o) => o.trim()).filter(Boolean)),
          correctIndex: String(correctIndex), explanation: explanation || '',
          videoUrl: videoUrl || '', tags: JSON.stringify(tags.split(',').map((t) => t.trim()).filter(Boolean)),
          isCritical: String(isCritical),
        });
      } else {
        await api('/api/questions', { method: 'POST', auth: true, body: JSON.stringify(payload) });
      }
      setMsg({ ok: true, text: `Pregunta creada${qImage ? ' con imagen' : videoUrl ? ' con vídeo' : ''} ✅` });
      setQImage(null);
      resetForm();
      loadList();
    } catch (err) {
      const detail =
        err instanceof ApiError && err.details
          ? ' — ' + (err.details as Array<{ message: string }>).map((d) => d.message).join('; ')
          : '';
      setMsg({ ok: false, text: (err instanceof ApiError ? err.message : 'Error al guardar') + detail });
    } finally {
      setSaving(false);
    }
  }

  // Temas presentes en lo cargado, para el desplegable de filtro.
  const temasDisponibles = Array.from(new Set(list.map((q) => q.tema).filter((t): t is string => !!t))).sort((a, b) => a.localeCompare(b, 'es'));
  // Filtros de nivel/tema/visibilidad aplicados en cliente sobre la lista.
  const listaFiltrada = list.filter((q) =>
    (!fNivel || q.category === fNivel) &&
    (!fTema || q.tema === fTema) &&
    (!fVis || q.bank_visibility === fVis),
  );

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  return (
    <AppShell
      user={user}
      title="Preguntas"
      nav={adminNav(user.role, '/admin/preguntas')}
    >
      {/* ---------------- Carga masiva ---------------- */}
      <details className="card" style={{ marginBottom: 20 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 16, color: 'var(--gray-900)' }}>
          Carga masiva de preguntas <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>· sube muchas de golpe (Excel o JSON)</span>
        </summary>
        <div style={{ marginTop: 14 }}>

        <div className="info-box" style={{ marginBottom: 16 }}>
          1) Descarga la plantilla · 2) rellénala (una fila/objeto por pregunta; la columna
          <strong> documento</strong> debe coincidir con el título de un PDF ya subido en
          «Documentos», y <strong>pagina</strong> con su página) · 3) súbela.
          El <strong>JSON</strong> es ideal para preguntas generadas con IA.
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-outline btn-small"
            onClick={() => downloadFile('/api/questions/template', 'plantilla-preguntas-rcp.xlsx')}
          >
            ⬇ Plantilla Excel
          </button>
          <button
            type="button"
            className="btn btn-outline btn-small"
            onClick={() => downloadFile('/api/questions/template?format=json', 'ejemplo-preguntas-rcp.json')}
          >
            ⬇ Ejemplo JSON
          </button>

          <label className="btn btn-primary btn-small" style={{ cursor: 'pointer', marginLeft: 'auto' }}>
            {importing ? 'Importando…' : '⬆ Subir plantilla rellenada'}
            <input
              type="file"
              accept=".xlsx,.json,application/json"
              style={{ display: 'none' }}
              disabled={importing}
              onChange={(e) => {
                handleImport(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        </div>

        {importError && <div className="alert alert-error" style={{ marginTop: 16 }}>{importError}</div>}
        {importResult && (
          <div style={{ marginTop: 16 }}>
            <div className={`alert ${importResult.errors.length === 0 && !importResult.posibleReimport ? 'alert-success' : 'alert-error'}`}>
              Creadas <strong>{importResult.created}</strong> de {importResult.total}
              {importResult.duplicadas ? ` · ${importResult.duplicadas} duplicadas omitidas` : ''} ·{' '}
              {importResult.errors.length} con errores
              {importResult.posibleReimport && <div style={{ marginTop: 6 }}>⚠️ Ninguna pregunta nueva: parece que ya habías importado este fichero en este banco.</div>}
            </div>
            {importResult.errors.length > 0 && (
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr><th>Fila</th><th>Problema</th></tr>
                  </thead>
                  <tbody>
                    {importResult.errors.map((e) => (
                      <tr key={e.fila}>
                        <td>{e.fila}</td>
                        <td style={{ fontSize: 13, color: 'var(--danger)' }}>{e.errores.join('; ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        </div>
      </details>

      {/* ---------------- Form (plegable, ancho completo) ---------------- */}
      <details className="card" style={{ marginBottom: 16 }} open={formOpen}
        onToggle={(e) => setFormOpen((e.target as HTMLDetailsElement).open)}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 16 }}>
          {editId ? '✏️ Editar pregunta' : 'Nueva pregunta'}
          <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}> · clasifícala por nivel, público y tipo</span>
        </summary>
        <div style={{ marginTop: 14 }}>
          {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}
          {editId && (
            <div className="info-box" style={{ marginBottom: 12, fontSize: 13 }}>
              Estás editando una pregunta existente.{' '}
              <button type="button" className="link-action" onClick={salirEdicion}>Cancelar y empezar una nueva</button>
            </div>
          )}

          <form onSubmit={onSubmit}>
            {/* Toda pregunta pertenece a un banco: así nunca quedan huérfanas. */}
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Banco (obligatorio)</label>
                <select className="form-select" value={bankId} onChange={(e) => setBankId(e.target.value)} required>
                  <option value="">Elige el banco…</option>
                  {banks.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.kind.toUpperCase()})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tema</label>
                <input className="form-input" placeholder="Ej.: Compresiones" value={tema} onChange={(e) => setTema(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Nivel</label>
                <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value as Level)}>
                  <option value="SVB">SVB · Básico</option>
                  <option value="SVI">SVI · Intermedio</option>
                  <option value="SVA">SVA · Avanzado</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Dificultad</label>
                <select className="form-select" value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))}>
                  <option value={1}>Fácil</option>
                  <option value={2}>Media</option>
                  <option value={3}>Difícil</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Público (uno o varios)</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(['ninos', 'jovenes', 'adultos'] as Audience[]).map((a) => (
                  <button
                    type="button"
                    key={a}
                    onClick={() => toggleAudience(a)}
                    className={`tab ${audiences.includes(a) ? 'active' : ''}`}
                    style={{ flex: 'unset', padding: '8px 14px' }}
                  >
                    {AUDIENCE_LABEL[a]}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Tipo de pregunta</label>
              <div className="tabs">
                <button type="button" className={`tab ${qtype === 'teorica' ? 'active' : ''}`} onClick={() => setQtype('teorica')}>
                  📘 Teórica / técnica
                </button>
                <button type="button" className={`tab ${qtype === 'caso_clinico' ? 'active' : ''}`} onClick={() => setQtype('caso_clinico')}>
                  🩺 Caso clínico
                </button>
              </div>
            </div>

            {qtype === 'caso_clinico' && (
              <div className="form-group">
                <label className="form-label">Contexto clínico (el escenario)</label>
                <textarea
                  className="form-input"
                  style={{ height: 80, padding: 10 }}
                  placeholder="Ej.: Encuentras a un hombre de 60 años en la calle, no responde y no respira con normalidad…"
                  value={clinicalContext}
                  onChange={(e) => setClinicalContext(e.target.value)}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Enunciado</label>
              <textarea
                className="form-input"
                style={{ height: 64, padding: 10 }}
                value={text}
                onChange={(e) => setText(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Opciones (marca la correcta)</label>
              {options.map((opt, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <input
                    type="radio"
                    name="correct"
                    checked={correctIndex === i}
                    onChange={() => setCorrectIndex(i)}
                    title="Marcar como correcta"
                  />
                  <input
                    className="form-input"
                    placeholder={`Opción ${String.fromCharCode(65 + i)}`}
                    value={opt}
                    onChange={(e) => setOption(i, e.target.value)}
                    required={i < 2}
                  />
                  {options.length > 2 && (
                    <button type="button" className="btn btn-outline btn-small" onClick={() => removeOption(i)}>
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {options.length < 6 && (
                <button type="button" className="btn btn-outline btn-small" onClick={addOption}>
                  + Añadir opción
                </button>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Explicación (debriefing)</label>
              <textarea className="form-input" style={{ height: 64, padding: 10 }} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
            </div>

            <details style={{ marginBottom: 16 }}>
              <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Campos avanzados (fuentes, vídeo, flashcard, etiquetas)
              </summary>
              <div className="form-group">
                <label className="form-label">Fuente ERC 2025</label>
                <input className="form-input" placeholder="Capítulo / sección / página / enlace" value={sourceErc} onChange={(e) => setSourceErc(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Fuente Plan Nacional RCP</label>
                <input className="form-input" value={sourcePlan} onChange={(e) => setSourcePlan(e.target.value)} />
              </div>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Documento de referencia</label>
                  <select className="form-select" value={refDocumentId} onChange={(e) => setRefDocumentId(e.target.value)}>
                    <option value="">— Ninguno —</option>
                    {docs.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Página</label>
                  <input className="form-input" type="number" min={1} placeholder="45" value={refPage} onChange={(e) => setRefPage(e.target.value)} />
                </div>
              </div>
              {docs.length === 0 && (
                <div className="info-box" style={{ marginBottom: 12 }}>
                  Sube tus guías en <a href="/admin/documentos">Documentos</a> para poder referenciar páginas.
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Vídeo (URL)</label>
                <input className="form-input" placeholder="https://youtube.com/…" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Flashcard (frase clave)</label>
                <input className="form-input" value={flashcard} onChange={(e) => setFlashcard(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Etiquetas (separadas por comas)</label>
                <input className="form-input" placeholder="parada, desfibrilación, compresiones" value={tags} onChange={(e) => setTags(e.target.value)} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={isCritical} onChange={(e) => setIsCritical(e.target.checked)} />
                Marcar como pregunta crítica (prioritaria)
              </label>
            </details>

            <button className="btn btn-primary btn-full" disabled={saving || audiences.length === 0}>
              {saving ? 'Guardando…' : editId ? 'Guardar cambios' : 'Crear pregunta'}
            </button>
          </form>
        </div>
      </details>

      {/* ---------------- List (ancho completo) ---------------- */}
      <div className="card">
          <div className="card-header">
            <div className="card-title">Banco de preguntas</div>
          </div>

          {/* Filtro por soporte (servidor) + nivel/tema/visibilidad (cliente). */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
            <span className="muted" style={{ fontSize: 13 }}>Soporte:</span>
            {([['', 'Todas'], ['any', 'Con imagen o vídeo'], ['imagen', 'Con imagen'], ['video', 'Con vídeo']] as Array<[string, string]>).map(([v, label]) => (
              <button key={v} type="button" className="link-action"
                style={{ fontWeight: filterMedia === v ? 700 : 400 }}
                onClick={() => { setFilterMedia(v); loadList(v || undefined); }}>
                {label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <select className="form-select" style={{ width: 'auto', minWidth: 120 }} value={fNivel} onChange={(e) => setFNivel(e.target.value as '' | Level)}>
              <option value="">Nivel: todos</option>
              <option value="SVB">SVB · Básico</option>
              <option value="SVI">SVI · Intermedio</option>
              <option value="SVA">SVA · Avanzado</option>
            </select>
            <select className="form-select" style={{ width: 'auto', minWidth: 140 }} value={fTema} onChange={(e) => setFTema(e.target.value)}>
              <option value="">Tema: todos</option>
              {temasDisponibles.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="form-select" style={{ width: 'auto', minWidth: 150 }} value={fVis} onChange={(e) => setFVis(e.target.value as '' | Visibility)}>
              <option value="">Visibilidad: todas</option>
              <option value="publico">🌐 Público</option>
              <option value="restringido">👥 Restringido</option>
              <option value="privado">🔒 Privado</option>
            </select>
            {(fNivel || fTema || fVis) && (
              <button type="button" className="link-action" onClick={() => { setFNivel(''); setFTema(''); setFVis(''); }}>Limpiar</button>
            )}
            <span className="muted" style={{ fontSize: 13, marginLeft: 'auto' }}>{listaFiltrada.length} de {list.length}</span>
          </div>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Nivel</th>
                  <th>Tema</th>
                  <th>Visib.</th>
                  <th>Público</th>
                  <th>Tipo</th>
                  <th>Enunciado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <span className="badge badge-primary">{q.category}</span>
                    </td>
                    <td style={{ fontSize: 12 }}>{q.tema || '—'}</td>
                    <td style={{ fontSize: 12 }} title={q.bank_name ?? ''}>{q.bank_visibility ? VIS_LABEL[q.bank_visibility].split(' ')[0] : '—'}</td>
                    <td style={{ fontSize: 12 }}>{q.audiences.map((a) => AUDIENCE_LABEL[a].split(' ')[0]).join(' ')}</td>
                    <td style={{ fontSize: 12 }}>{q.qtype === 'caso_clinico' ? '🩺' : '📘'}</td>
                    <td style={{ fontSize: 13 }}>
                      <button className="link-action" onClick={() => editar(q.id)} title="Editar esta pregunta" style={{ textAlign: 'left' }}>
                        {q.text.length > 60 ? q.text.slice(0, 60) + '…' : q.text}
                      </button>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="link-action" onClick={() => verComoAlumno(q.id)}>👁 Ver</button>{' · '}
                      <button className="link-action" onClick={() => editar(q.id)}>Editar</button>
                    </td>
                  </tr>
                ))}
                {listaFiltrada.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty-state">
                      {list.length === 0 ? 'Aún no hay preguntas en este banco.' : 'Ninguna pregunta coincide con los filtros.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      {/* ---------------- Previsualización «como alumno» ---------------- */}
      {preview && <PreviewAlumno q={preview} onClose={() => setPreview(null)} />}
    </AppShell>
  );
}
