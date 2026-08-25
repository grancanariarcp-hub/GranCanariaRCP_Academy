'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PreviewPregunta } from '@/components/PreviewPregunta';

/**
 * Vista previa de un banco: recorre sus preguntas una a una tal como las ve el
 * alumno (con la correcta resaltada y la explicación), sin tener que abrir la
 * lista y pinchar cada una. Reutiliza PreviewPregunta añadiéndole navegación.
 */
export function BankPreview({ bankId, bankName, onClose }: { bankId: string; bankName: string; onClose: () => void }) {
  const [ids, setIds] = useState<string[] | null>(null);
  const [i, setI] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ questions: Array<{ id: string }> }>(`/api/banks/${bankId}/questions`, { auth: true })
      .then((r) => setIds(r.questions.map((q) => q.id)))
      .catch(() => setError('No se pudieron cargar las preguntas del banco'));
  }, [bankId]);

  // Estados de carga / vacío: un modal simple con el mismo cierre.
  if (error || ids === null || ids.length === 0) {
    return (
      <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div className="card-title">Vista previa de «{bankName}»</div>
            <button className="btn btn-outline btn-small" onClick={onClose}>Cerrar</button>
          </div>
          {error ? <div className="alert alert-error">{error}</div>
            : ids === null ? <p className="muted">Cargando…</p>
              : <p className="muted">Este banco todavía no tiene preguntas.</p>}
        </div>
      </div>
    );
  }

  return (
    <PreviewPregunta
      questionId={ids[i]}
      onClose={onClose}
      posicion={`${i + 1} / ${ids.length}`}
      onPrev={i > 0 ? () => setI(i - 1) : undefined}
      onNext={i < ids.length - 1 ? () => setI(i + 1) : undefined}
    />
  );
}
