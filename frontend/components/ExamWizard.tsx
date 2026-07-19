'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

interface Bank { id: string; name: string; kind: string; questions: string }
interface Tema { tema: string; disponibles: number }

/** Minutos sugeridos: 1,5 min por pregunta, redondeado a múltiplos de 5. */
const sugerir = (n: number) => Math.max(5, Math.ceil((n * 1.5) / 5) * 5);

/**
 * Asistente de creación de test/examen: nombre → bancos → nº de preguntas
 * (aleatorias o por temas) → tiempo (con sugerencia) → listo.
 */
export function ExamWizard({ courseId, moduleId, onCreated }: { courseId: string; moduleId: string; onCreated: () => void }) {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  const [temas, setTemas] = useState<Tema[]>([]);
  const [total, setTotal] = useState(0);

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'test' | 'examen'>('test');
  const [mode, setMode] = useState<'aleatorio' | 'temas'>('aleatorio');
  const [count, setCount] = useState('10');
  const [porTema, setPorTema] = useState<Record<string, string>>({});
  const [minutos, setMinutos] = useState('');
  const [passPct, setPassPct] = useState('60');
  const [attempts, setAttempts] = useState('1');
  const [shuffle, setShuffle] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ banks: Bank[] }>('/api/banks', { auth: true }).then((r) => setBanks(r.banks)).catch(() => {});
  }, []);

  // Al cambiar los bancos, consultamos cuántas preguntas hay disponibles.
  useEffect(() => {
    if (sel.length === 0) { setTemas([]); setTotal(0); return; }
    api<{ total: number; porTema: Tema[] }>('/api/banks/availability', { method: 'POST', auth: true, body: JSON.stringify({ bankIds: sel }) })
      .then((r) => { setTemas(r.porTema); setTotal(r.total); })
      .catch(() => { setTemas([]); setTotal(0); });
  }, [sel]);

  const nPreguntas = mode === 'aleatorio'
    ? Number(count) || 0
    : Object.values(porTema).reduce((s, v) => s + (Number(v) || 0), 0);

  async function crear() {
    setMsg(null); setSaving(true);
    try {
      const body = {
        title, kind, bankIds: sel, mode,
        count: mode === 'aleatorio' ? Number(count) : undefined,
        porTema: mode === 'temas'
          ? Object.entries(porTema).filter(([, v]) => Number(v) > 0).map(([tema, v]) => ({ tema, count: Number(v) }))
          : undefined,
        timeLimitMin: minutos ? Number(minutos) : sugerir(nPreguntas),
        passPct: Number(passPct) || 60,
        attemptsAllowed: Number(attempts) || 1,
        shuffle,
      };
      const r = await api<{ preguntas: number }>(`/api/courses/${courseId}/modules/${moduleId}/exams/wizard`, {
        method: 'POST', auth: true, body: JSON.stringify(body),
      });
      setMsg({ ok: true, text: `Creado con ${r.preguntas} preguntas ✅` });
      setTitle(''); setSel([]); setPorTema({}); setMinutos('');
      onCreated();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Error al crear' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ borderTop: '1px dashed var(--gray-300)', paddingTop: 12, marginTop: 10 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Asistente de test / examen</div>
      {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}

      {/* 1. Nombre y tipo */}
      <div className="grid grid-2" style={{ gap: 10 }}>
        <div className="form-group">
          <label className="form-label">1 · Nombre</label>
          <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej.: Examen final SVB" />
        </div>
        <div className="form-group">
          <label className="form-label">Tipo</label>
          <select className="form-select" value={kind} onChange={(e) => setKind(e.target.value as 'test' | 'examen')}>
            <option value="test">Test de autoevaluación</option>
            <option value="examen">Examen final (requiere encuesta previa)</option>
          </select>
        </div>
      </div>

      {/* 2. Bancos */}
      <div className="form-group">
        <label className="form-label">2 · Bancos de preguntas</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {banks.map((b) => {
            const on = sel.includes(b.id);
            return (
              <button key={b.id} type="button" className={`tab ${on ? 'active' : ''}`} style={{ flex: 'unset', padding: '6px 10px', fontSize: 12 }}
                onClick={() => setSel(on ? sel.filter((x) => x !== b.id) : [...sel, b.id])}>
                {b.name} <span className="muted">({b.questions})</span>
              </button>
            );
          })}
          {banks.length === 0 && <span className="muted" style={{ fontSize: 13 }}>No hay bancos disponibles.</span>}
        </div>
        {sel.length > 0 && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{total} preguntas disponibles en total</div>}
      </div>

      {/* 3. Selección */}
      {sel.length > 0 && (
        <div className="form-group">
          <label className="form-label">3 · Qué preguntas</label>
          <div className="tabs" style={{ marginBottom: 8 }}>
            <button type="button" className={`tab ${mode === 'aleatorio' ? 'active' : ''}`} onClick={() => setMode('aleatorio')}>Aleatorias</button>
            <button type="button" className={`tab ${mode === 'temas' ? 'active' : ''}`} onClick={() => setMode('temas')}>Por temas</button>
          </div>
          {mode === 'aleatorio' ? (
            <input className="form-input" type="number" min="1" max={total || 200} value={count} onChange={(e) => setCount(e.target.value)} placeholder="Nº de preguntas" />
          ) : (
            <div className="table-responsive">
              <table>
                <thead><tr><th>Tema</th><th>Disponibles</th><th>Cuántas</th></tr></thead>
                <tbody>
                  {temas.map((t) => (
                    <tr key={t.tema}>
                      <td>{t.tema}</td>
                      <td className="muted">{t.disponibles}</td>
                      <td>
                        <input className="form-input" type="number" min="0" max={t.disponibles} style={{ width: 80 }}
                          value={porTema[t.tema] ?? ''} onChange={(e) => setPorTema({ ...porTema, [t.tema]: e.target.value })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {nPreguntas > total && total > 0 && (
            <div className="alert alert-error" style={{ marginTop: 8 }}>Pides {nPreguntas} preguntas y solo hay {total} disponibles.</div>
          )}
        </div>
      )}

      {/* 4. Tiempo y condiciones */}
      {nPreguntas > 0 && (
        <>
          <div className="grid grid-3" style={{ gap: 10 }}>
            <div className="form-group">
              <label className="form-label">4 · Minutos</label>
              <input className="form-input" type="number" min="1" value={minutos} onChange={(e) => setMinutos(e.target.value)} placeholder={`${sugerir(nPreguntas)} sugeridos`} />
            </div>
            <div className="form-group">
              <label className="form-label">% para aprobar</label>
              <input className="form-input" type="number" min="0" max="100" value={passPct} onChange={(e) => setPassPct(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Intentos</label>
              <input className="form-input" type="number" min="1" max="10" value={attempts} onChange={(e) => setAttempts(e.target.value)} />
            </div>
          </div>
          <div className="info-box" style={{ fontSize: 12, marginBottom: 10 }}>
            Para <strong>{nPreguntas} preguntas</strong> sugerimos <strong>{sugerir(nPreguntas)} minutos</strong> (1,5 min por pregunta).
            Déjalo vacío para usar la sugerencia.
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
            Barajar el orden para cada alumno (dificulta copiar)
          </label>
        </>
      )}

      <button className="btn btn-primary btn-full" onClick={crear}
        disabled={saving || !title.trim() || sel.length === 0 || nPreguntas === 0 || (total > 0 && nPreguntas > total)}>
        {saving ? 'Creando…' : `Crear ${kind === 'examen' ? 'examen' : 'test'} con ${nPreguntas} preguntas`}
      </button>
    </div>
  );
}
