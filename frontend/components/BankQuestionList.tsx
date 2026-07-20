'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useDebounced } from '@/hooks/useDebounced';

/**
 * Preguntas de un banco, con sus filtros.
 *
 * Se abre desde el listado de bancos para revisar el contenido o para decidir
 * de qué parte del banco saldrá un examen, sin tener que abrirlo entero.
 */

interface Faceta { valor: string; n: number }
interface Pregunta {
  id: string; orden: number | null; tema: string | null; difficulty: number | null;
  qtype: string; audiences: string[]; is_critical: boolean; is_active: boolean;
  text: string; con_imagen: boolean; con_video: boolean;
}

const TIPO: Record<string, string> = { teorica: 'Teórica', caso_clinico: 'Caso clínico' };
const DIFICULTAD: Record<string, string> = { '1': 'Fácil', '2': 'Media', '3': 'Difícil' };

export function BankQuestionList({ bankId, bankName }: { bankId: string; bankName: string }) {
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [facetas, setFacetas] = useState<Record<string, Faceta[]>>({});
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [f, setF] = useState({ tema: '', dificultad: '', qtype: '', audiencia: '', media: '', q: '' });

  // Igual que en el listado de bancos: sin esperar, una petición por tecla.
  const fEstable = useDebounced(f);

  const cargar = useCallback(async () => {
    setCargando(true);
    const qs = new URLSearchParams();
    Object.entries(fEstable).forEach(([k, v]) => { if (v) qs.set(k, v); });
    try {
      const r = await api<{ questions: Pregunta[]; total: number; facetas: Record<string, Faceta[]> }>(
        `/api/banks/${bankId}/questions?${qs.toString()}`, { auth: true },
      );
      setPreguntas(r.questions);
      setTotal(r.total);
      setFacetas(r.facetas);
    } catch { /* la lista queda vacía */ } finally { setCargando(false); }
  }, [bankId, fEstable]);

  useEffect(() => { cargar(); }, [cargar]);

  const activos = Object.values(f).some(Boolean);
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="card-header">
        <div className="card-title">Preguntas de «{bankName}»</div>
        <div className="card-subtitle">Filtra por materia, dificultad, tipo o público</div>
      </div>

      <div className="filter-bar" style={{ maxWidth: 'none', marginBottom: 14 }}>
        <div className="filter-grid">
          <div>
            <label className="form-label" htmlFor="q-buscar">Buscar</label>
            <input id="q-buscar" className="form-input" placeholder="Texto de la pregunta"
              value={f.q} onChange={(e) => set({ q: e.target.value })} />
          </div>
          <div>
            <label className="form-label" htmlFor="q-tema">Materia</label>
            <select id="q-tema" className="form-select" value={f.tema} onChange={(e) => set({ tema: e.target.value })}
              disabled={(facetas.tema ?? []).length === 0}>
              <option value="">Todas</option>
              {(facetas.tema ?? []).map((x) => <option key={x.valor} value={x.valor}>{x.valor} ({x.n})</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="q-dif">Dificultad</label>
            <select id="q-dif" className="form-select" value={f.dificultad} onChange={(e) => set({ dificultad: e.target.value })}
              disabled={(facetas.dificultad ?? []).length === 0}>
              <option value="">Cualquiera</option>
              {(facetas.dificultad ?? []).map((x) => (
                <option key={x.valor} value={x.valor}>{DIFICULTAD[x.valor] ?? x.valor} ({x.n})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="q-tipo">Tipo</label>
            <select id="q-tipo" className="form-select" value={f.qtype} onChange={(e) => set({ qtype: e.target.value })}
              disabled={(facetas.qtype ?? []).length === 0}>
              <option value="">Todos</option>
              {(facetas.qtype ?? []).map((x) => (
                <option key={x.valor} value={x.valor}>{TIPO[x.valor] ?? x.valor} ({x.n})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="q-aud">Público</label>
            <select id="q-aud" className="form-select" value={f.audiencia} onChange={(e) => set({ audiencia: e.target.value })}
              disabled={(facetas.audiencia ?? []).length === 0}>
              <option value="">Cualquiera</option>
              {(facetas.audiencia ?? []).map((x) => <option key={x.valor} value={x.valor}>{x.valor} ({x.n})</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="q-media">Soporte</label>
            <select id="q-media" className="form-select" value={f.media} onChange={(e) => set({ media: e.target.value })}>
              <option value="">Cualquiera</option>
              <option value="imagen">Con imagen</option>
              <option value="video">Con vídeo</option>
              <option value="sin">Solo texto</option>
            </select>
          </div>
        </div>
        <div className="filter-foot">
          <span className="muted">{cargando ? 'Cargando…' : `${total} pregunta${total === 1 ? '' : 's'}`}</span>
          {activos && (
            <button type="button" className="link-action"
              onClick={() => setF({ tema: '', dificultad: '', qtype: '', audiencia: '', media: '', q: '' })}>
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {!cargando && preguntas.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>Ninguna pregunta coincide con esos filtros.</p>
      ) : (
        <div className="table-responsive" style={{ maxHeight: '55vh' }}>
          <table className="table-plain">
            <thead>
              <tr><th>Nº</th><th>Pregunta</th><th>Materia</th><th>Dificultad</th><th>Tipo</th></tr>
            </thead>
            <tbody>
              {preguntas.map((q) => (
                <tr key={q.id}>
                  <td className="muted">{q.orden ?? '—'}</td>
                  <td>
                    {q.text}
                    <span style={{ marginLeft: 6 }}>
                      {q.con_imagen && <span className="badge" style={{ fontSize: 10 }}>imagen</span>}
                      {q.con_video && <span className="badge" style={{ fontSize: 10, marginLeft: 4 }}>vídeo</span>}
                      {q.is_critical && <span className="badge badge-warning" style={{ fontSize: 10, marginLeft: 4 }}>crítica</span>}
                    </span>
                  </td>
                  <td>{q.tema ?? <span className="muted">—</span>}</td>
                  <td>{q.difficulty ? (DIFICULTAD[String(q.difficulty)] ?? q.difficulty) : '—'}</td>
                  <td>{TIPO[q.qtype] ?? q.qtype}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
