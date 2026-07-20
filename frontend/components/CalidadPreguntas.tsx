'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Ayuda } from '@/components/ayuda/Ayuda';

/**
 * Calidad de las preguntas de un examen.
 *
 * El motor estaba escrito y sin pantalla: los alumnos podían avisar de una
 * pregunta ambigua, el profesorado ver su dificultad real y anularla, y al
 * anularla se recalifican los exámenes ya entregados. Nada de eso era accesible.
 *
 * Ordena por avisos y luego por dificultad, que es como se busca una pregunta
 * mala: primero las que alguien ha señalado, después las que casi todo el mundo
 * falla —una pregunta que falla el 95 % suele estar mal, no ser difícil—.
 */

interface Pregunta {
  id: string;
  text: string;
  format: string;
  excluded_from_grading: boolean;
  respondida: number;
  aciertos: number;
  acierto_pct: number | null;
  avisos: number;
  detalle_avisos: Array<{ kind: string; comment: string | null }>;
}

const AVISO: Record<string, string> = {
  ambigua: 'Ambigua',
  mal_redactada: 'Mal redactada',
  error: 'Respuesta incorrecta',
};

export function CalidadPreguntas({ courseId, examId }: { courseId: string; examId: string }) {
  const [preguntas, setPreguntas] = useState<Pregunta[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);

  const cargar = useCallback(() => {
    api<{ questions: Pregunta[] }>(`/api/courses/${courseId}/exams/${examId}/quality`, { auth: true })
      .then((r) => setPreguntas(r.questions))
      .catch(() => setPreguntas([]));
  }, [courseId, examId]);

  useEffect(cargar, [cargar]);

  async function anular(q: Pregunta) {
    const excluir = !q.excluded_from_grading;
    if (excluir && !confirm(
      'Al anular esta pregunta dejará de contar para la nota de todos, y los exámenes ya entregados se '
      + 'recalcularán al momento. Nadie puede bajar de nota. ¿Confirmas?')) return;
    setMsg(null);
    try {
      const r = await api<{ recalificados: number }>(
        `/api/courses/${courseId}/exams/${examId}/questions/${q.id}/grading`,
        { method: 'PATCH', auth: true, body: JSON.stringify({ excluded: excluir }) },
      );
      setMsg(r.recalificados > 0
        ? `Hecho. Se han recalificado ${r.recalificados} examen(es) ya entregados.`
        : 'Hecho. No había exámenes entregados que recalcular.');
      cargar();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'No se ha podido cambiar la pregunta');
    }
  }

  if (!preguntas || preguntas.length === 0) return null;

  const problematicas = preguntas.filter((q) => q.avisos > 0 || (q.acierto_pct !== null && q.acierto_pct < 30));

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <div className="card-title">Calidad de las preguntas <Ayuda tema="profesor-calidad" /></div>
        <div className="card-subtitle">
          {problematicas.length > 0
            ? `${problematicas.length} pregunta(s) merecen una mirada`
            : 'Ninguna pregunta da señales de estar mal'}
        </div>
      </div>

      {msg && <div className="alert alert-success" style={{ fontSize: 13.5 }}>{msg}</div>}

      <div className="table-responsive" style={{ maxHeight: 420 }}>
        <table className="table-plain">
          <thead>
            <tr><th>Pregunta</th><th>Aciertos</th><th>Avisos</th><th></th></tr>
          </thead>
          <tbody>
            {preguntas.map((q) => (
              <tr key={q.id} style={{ opacity: q.excluded_from_grading ? 0.55 : 1 }}>
                <td style={{ fontSize: 13.5 }}>
                  {q.text.slice(0, 110)}{q.text.length > 110 ? '…' : ''}
                  {q.excluded_from_grading && <span className="badge badge-warning" style={{ marginLeft: 6 }}>anulada</span>}
                  {q.avisos > 0 && abierta === q.id && (
                    <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
                      {q.detalle_avisos.map((a, i) => (
                        <div key={i}>· {AVISO[a.kind] ?? a.kind}{a.comment ? `: «${a.comment}»` : ''}</div>
                      ))}
                    </div>
                  )}
                </td>
                <td style={{ fontSize: 13.5, whiteSpace: 'nowrap' }}>
                  {q.acierto_pct === null ? (
                    <span className="muted">sin datos</span>
                  ) : (
                    <strong style={{ color: q.acierto_pct < 30 ? 'var(--danger)' : q.acierto_pct < 60 ? 'var(--warning)' : 'var(--success)' }}>
                      {q.acierto_pct} %
                    </strong>
                  )}
                  <div className="muted" style={{ fontSize: 11.5 }}>{q.respondida} respuestas</div>
                </td>
                <td>
                  {q.avisos > 0 ? (
                    <button className="link-action" onClick={() => setAbierta(abierta === q.id ? null : q.id)}>
                      {q.avisos} aviso{q.avisos > 1 ? 's' : ''}
                    </button>
                  ) : <span className="muted">—</span>}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-outline btn-small" onClick={() => anular(q)}>
                    {q.excluded_from_grading ? 'Volver a contar' : 'Anular'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
        Un acierto muy bajo no siempre significa que la pregunta esté mal: puede ser el punto del temario que
        peor se explicó. Léela antes de anularla.
      </p>
    </div>
  );
}
