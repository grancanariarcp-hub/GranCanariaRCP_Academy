'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { VideoEmbed } from '@/components/VideoEmbed';

/**
 * Previsualización de una pregunta tal como la responde el alumno, con la
 * opción correcta resaltada, la explicación, la imagen y el vídeo. Se le pasa
 * solo el id y ella pide la pregunta completa; así se reutiliza desde el
 * listado de preguntas y desde las preguntas de un banco.
 */

interface FullQuestion {
  id: string;
  category: string | null;
  qtype: string;
  text: string;
  clinical_context: string | null;
  options: string[];
  correct_index: number;
  explanation: string | null;
  video_url: string | null;
  image_url?: string | null;
}

export function PreviewPregunta({ questionId, onClose, onPrev, onNext, posicion }: {
  questionId: string;
  onClose: () => void;
  /** Navegación opcional (para recorrer las preguntas de un banco). */
  onPrev?: () => void;
  onNext?: () => void;
  posicion?: string;
}) {
  const [q, setQ] = useState<FullQuestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ question: FullQuestion }>(`/api/questions/${questionId}`, { auth: true })
      .then((r) => setQ(r.question))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'No se pudo cargar'));
  }, [questionId]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div className="card-title">
            Vista del alumno
            {posicion && <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}> · {posicion}</span>}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(onPrev || onNext) && (
              <>
                <button className="btn btn-outline btn-small" onClick={onPrev} disabled={!onPrev} title="Anterior">←</button>
                <button className="btn btn-outline btn-small" onClick={onNext} disabled={!onNext} title="Siguiente">→</button>
              </>
            )}
            <button className="btn btn-outline btn-small" onClick={onClose}>Cerrar</button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {!q && !error && <p className="muted">Cargando…</p>}

        {q && (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
