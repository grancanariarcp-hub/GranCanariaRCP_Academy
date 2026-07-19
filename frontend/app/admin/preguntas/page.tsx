'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { api, ApiError, downloadFile, uploadFile } from '@/lib/api';
import { adminNav } from '@/lib/nav';

type Level = 'SVB' | 'SVI' | 'SVA';
type Audience = 'ninos' | 'jovenes' | 'adultos';
type QType = 'teorica' | 'caso_clinico';

interface QuestionRow {
  id: string;
  category: Level;
  audiences: Audience[];
  qtype: QType;
  difficulty: number;
  text: string;
  is_critical: boolean;
}

const AUDIENCE_LABEL: Record<Audience, string> = {
  ninos: '👶 Niños',
  jovenes: '🧑 Jóvenes',
  adultos: '👨 Adultos',
};

export default function PreguntasPage() {
  const user = useSession(['super_admin', 'profesor'], '/login/admin');

  // form state
  const [banks, setBanks] = useState<Array<{ id: string; name: string; kind: string }>>([]);
  const [bankId, setBankId] = useState('');
  const [tema, setTema] = useState('');
  const [qImage, setQImage] = useState<File | null>(null);
  const [filterMedia, setFilterMedia] = useState('');
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

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  return (
    <AppShell
      user={user}
      title="Preguntas"
      nav={adminNav(user.role, '/admin/preguntas')}
    >
      {/* ---------------- Carga masiva ---------------- */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">Carga masiva de preguntas</div>
          <div className="card-subtitle">Sube muchas preguntas de golpe (Excel o JSON)</div>
        </div>

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

      <div className="grid grid-2">
        {/* ---------------- Form ---------------- */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Nueva pregunta</div>
            <div className="card-subtitle">Clasifícala por nivel, público y tipo</div>
          </div>

          {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}

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
              {saving ? 'Guardando…' : 'Crear pregunta'}
            </button>
          </form>
        </div>

        {/* ---------------- List ---------------- */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Banco de preguntas</div>
            <div className="card-subtitle">{list.length} preguntas</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <span className="muted" style={{ fontSize: 13 }}>Filtrar:</span>
            {([['', 'Todas'], ['any', 'Con imagen o vídeo'], ['imagen', 'Con imagen'], ['video', 'Con vídeo']] as Array<[string, string]>).map(([v, label]) => (
              <button key={v} type="button" className={`link-action ${filterMedia === v ? '' : ''}`}
                style={{ fontWeight: filterMedia === v ? 700 : 400 }}
                onClick={() => { setFilterMedia(v); loadList(v || undefined); }}>
                {label}
              </button>
            ))}
          </div>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Nivel</th>
                  <th>Público</th>
                  <th>Tipo</th>
                  <th>Enunciado</th>
                </tr>
              </thead>
              <tbody>
                {list.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <span className="badge badge-primary">{q.category}</span>
                    </td>
                    <td style={{ fontSize: 12 }}>{q.audiences.map((a) => AUDIENCE_LABEL[a].split(' ')[0]).join(' ')}</td>
                    <td style={{ fontSize: 12 }}>{q.qtype === 'caso_clinico' ? '🩺' : '📘'}</td>
                    <td style={{ fontSize: 13 }}>{q.text.length > 60 ? q.text.slice(0, 60) + '…' : q.text}</td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      Aún no hay preguntas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
