'use client';

import { useState } from 'react';
import { VideoEmbed } from '@/components/VideoEmbed';

/**
 * Vista previa de un examen «como alumno», a partir de las preguntas ya cargadas
 * en el editor. Dos modos:
 *  · «Al responder»: en blanco, tal cual lo ve el alumno al hacer el examen.
 *  · «Al revisar»: con la respuesta correcta y el feedback (lo que ve después).
 */

type Par = { left: string; right: string };
type MultiOpt = { text: string; correct?: boolean };
interface PQ {
  id: string; format: string; text: string;
  options: Array<string | Par | MultiOpt>;
  correct_index: number | null;
  explanation?: string | null; option_feedback?: string[];
  image_url?: string | null; video_url?: string | null;
}

export function ExamPreview({
  titulo, feedbackGeneral, questions, onClose,
}: {
  titulo: string;
  feedbackGeneral?: string | null;
  questions: PQ[];
  onClose: () => void;
}) {
  const [modo, setModo] = useState<'responder' | 'revisar'>('responder');
  const revisar = modo === 'revisar';

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div className="card-title">Vista previa · como alumno</div>
          <button className="btn btn-outline btn-small" onClick={onClose}>Cerrar</button>
        </div>

        {/* Interruptor de modo */}
        <div className="tabs" style={{ marginBottom: 8 }}>
          <button type="button" className={`tab ${modo === 'responder' ? 'active' : ''}`} onClick={() => setModo('responder')}>Al responder</button>
          <button type="button" className={`tab ${revisar ? 'active' : ''}`} onClick={() => setModo('revisar')}>Al revisar (con soluciones)</button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
          {revisar ? 'Cómo lo ve el alumno tras enviarlo: respuesta correcta y feedback.' : 'Cómo lo ve el alumno al hacerlo: en blanco, sin soluciones.'}
        </p>

        <h2 style={{ fontSize: 20, margin: '8px 0 12px' }}>{titulo}</h2>
        {revisar && feedbackGeneral && <div className="info-box" style={{ marginBottom: 12 }}><strong>Valoración general:</strong> {feedbackGeneral}</div>}

        {questions.length === 0 && <p className="muted">Este examen aún no tiene preguntas.</p>}

        {questions.map((q, i) => (
          <div key={q.id} style={{ borderTop: '1px solid var(--gray-200)', padding: '12px 0' }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{i + 1}. {q.text}</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {q.image_url && <img src={q.image_url} alt="" style={{ maxWidth: '100%', borderRadius: 10, marginBottom: 10 }} />}
            {q.video_url && <div style={{ marginBottom: 10 }}><VideoEmbed url={q.video_url} /></div>}

            {(q.format === 'test' || q.format === 'vf') && (
              <div style={{ display: 'grid', gap: 3 }}>
                {(q.options as string[]).map((opt, idx) => {
                  const ok = idx === q.correct_index;
                  return (
                    <div key={idx}>
                      <label style={{ fontSize: 13.5, display: 'flex', gap: 8, alignItems: 'center', color: revisar && ok ? 'var(--success)' : undefined, fontWeight: revisar && ok ? 700 : 400 }}>
                        <input type="radio" disabled />
                        {opt}{revisar && ok ? ' ✓' : ''}
                      </label>
                      {revisar && q.option_feedback?.[idx] && <div className="muted" style={{ fontSize: 12, marginLeft: 24 }}>💬 {q.option_feedback[idx]}</div>}
                    </div>
                  );
                })}
              </div>
            )}
            {q.format === 'multiple' && (
              <div style={{ display: 'grid', gap: 3 }}>
                {(q.options as MultiOpt[]).map((o, idx) => (
                  <div key={idx}>
                    <label style={{ fontSize: 13.5, display: 'flex', gap: 8, alignItems: 'center', color: revisar && o.correct ? 'var(--success)' : undefined, fontWeight: revisar && o.correct ? 700 : 400 }}>
                      <input type="checkbox" disabled />
                      {o.text}{revisar && o.correct ? ' ✓ (correcta)' : ''}
                    </label>
                    {revisar && q.option_feedback?.[idx] && <div className="muted" style={{ fontSize: 12, marginLeft: 24 }}>💬 {q.option_feedback[idx]}</div>}
                  </div>
                ))}
                <div className="muted" style={{ fontSize: 12 }}>El alumno marca todas las que quiera.</div>
              </div>
            )}
            {q.format === 'escala' && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="muted" style={{ fontSize: 12.5 }}>{(q.options as string[])[0]}</span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <input type="radio" disabled /><span style={{ fontSize: 12 }}>{n}</span>
                  </label>
                ))}
                <span className="muted" style={{ fontSize: 12.5 }}>{(q.options as string[])[1]}</span>
              </div>
            )}
            {q.format === 'emparejar' && (
              revisar ? (
                <div style={{ display: 'grid', gap: 3, fontSize: 13 }}>
                  {(q.options as Par[]).map((p, idx) => <div key={idx}>{p.left} <span className="muted">↔</span> {p.right}</div>)}
                  <div className="muted" style={{ fontSize: 12 }}>La columna derecha se baraja en cada intento.</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 6 }}>
                  {(q.options as Par[]).map((p, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ flex: 1 }}>{p.left}</span>
                      <span className="muted">↔</span>
                      <select className="form-select" style={{ flex: 1 }} disabled>
                        <option>Elegir…</option>
                        {(q.options as Par[]).map((x, k) => <option key={k}>{x.right}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )
            )}
            {q.format === 'abierta' && (
              revisar
                ? <div className="muted" style={{ fontSize: 13 }}>Respuesta libre (la corrige el profesor).</div>
                : <textarea className="form-input" style={{ height: 60, padding: 10 }} disabled placeholder="Respuesta del alumno…" />
            )}

            {revisar && q.explanation && <div className="info-box" style={{ marginTop: 8, fontSize: 13 }}>{q.explanation}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
