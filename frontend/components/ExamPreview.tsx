'use client';

import { VideoEmbed } from '@/components/VideoEmbed';

/**
 * Vista previa de un examen «como alumno», a partir de las preguntas ya cargadas
 * en el editor. Es para el profesor: muestra la respuesta correcta resaltada y el
 * feedback (lo que el alumno vería al revisar). No ejecuta el examen.
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
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div className="card-title">Vista previa · como alumno</div>
          <button className="btn btn-outline btn-small" onClick={onClose}>Cerrar</button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
          Así verá el alumno el examen (aquí se muestran la respuesta correcta y el feedback, que él solo ve al revisar).
        </p>
        <h2 style={{ fontSize: 20, margin: '8px 0 12px' }}>{titulo}</h2>
        {feedbackGeneral && <div className="info-box" style={{ marginBottom: 12 }}><strong>Valoración general:</strong> {feedbackGeneral}</div>}

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
                      <div style={{ fontSize: 13.5, color: ok ? 'var(--success)' : undefined, fontWeight: ok ? 700 : 400 }}>
                        {ok ? '✓ ' : '• '}{opt}
                      </div>
                      {q.option_feedback?.[idx] && <div className="muted" style={{ fontSize: 12, marginLeft: 16 }}>💬 {q.option_feedback[idx]}</div>}
                    </div>
                  );
                })}
              </div>
            )}
            {q.format === 'multiple' && (
              <div style={{ display: 'grid', gap: 3 }}>
                {(q.options as MultiOpt[]).map((o, idx) => (
                  <div key={idx}>
                    <div style={{ fontSize: 13.5, color: o.correct ? 'var(--success)' : undefined, fontWeight: o.correct ? 700 : 400 }}>
                      {o.correct ? '☑ ' : '☐ '}{o.text}{o.correct ? ' (correcta)' : ''}
                    </div>
                    {q.option_feedback?.[idx] && <div className="muted" style={{ fontSize: 12, marginLeft: 18 }}>💬 {q.option_feedback[idx]}</div>}
                  </div>
                ))}
                <div className="muted" style={{ fontSize: 12 }}>El alumno marca todas las que quiera.</div>
              </div>
            )}
            {q.format === 'escala' && (
              <div className="muted" style={{ fontSize: 13 }}>
                Escala 1–5: {(q.options as string[])[0]} … {(q.options as string[])[1]}
              </div>
            )}
            {q.format === 'emparejar' && (
              <div style={{ display: 'grid', gap: 3, fontSize: 13 }}>
                {(q.options as Par[]).map((p, idx) => (
                  <div key={idx}>{p.left} <span className="muted">↔</span> {p.right}</div>
                ))}
                <div className="muted" style={{ fontSize: 12 }}>La columna derecha se baraja en cada intento.</div>
              </div>
            )}
            {q.format === 'abierta' && <div className="muted" style={{ fontSize: 13 }}>Respuesta libre (la corrige el profesor).</div>}

            {q.explanation && <div className="info-box" style={{ marginTop: 8, fontSize: 13 }}>{q.explanation}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
