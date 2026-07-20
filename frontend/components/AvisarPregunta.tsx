'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';

/**
 * Aviso del alumno sobre una pregunta.
 *
 * Quien acaba de responder es quien mejor detecta que una pregunta está mal
 * planteada, y hasta ahora no tenía forma de decirlo: el aviso existía en el
 * servidor pero no había ningún botón. Sin este extremo, el panel de calidad
 * del profesorado solo podía guiarse por el porcentaje de acierto, que no
 * distingue una pregunta mala de un tema mal explicado.
 */

const MOTIVOS: Array<{ valor: string; etiqueta: string }> = [
  { valor: 'ambigua', etiqueta: 'Se puede entender de varias formas' },
  { valor: 'mal_redactada', etiqueta: 'Está mal escrita o se entiende mal' },
  { valor: 'error', etiqueta: 'Creo que la respuesta correcta no lo es' },
];

export function AvisarPregunta({ examId, questionId }: { examId: string; questionId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [comentario, setComentario] = useState('');
  const [estado, setEstado] = useState<'listo' | 'enviando' | 'enviado' | string>('listo');

  if (estado === 'enviado') {
    return (
      <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
        Gracias: el profesorado revisará esta pregunta.
      </div>
    );
  }

  if (!abierto) {
    return (
      <button className="link-action" style={{ fontSize: 12.5, marginTop: 8 }} onClick={() => setAbierto(true)}>
        ¿Hay algo mal en esta pregunta?
      </button>
    );
  }

  async function enviar() {
    if (!motivo) return;
    setEstado('enviando');
    try {
      await api(`/api/student/exams/${examId}/questions/${questionId}/report`, {
        method: 'POST', auth: true,
        body: JSON.stringify({ kind: motivo, comment: comentario || undefined }),
      });
      setEstado('enviado');
    } catch (e) {
      setEstado(e instanceof ApiError ? e.message : 'No se ha podido enviar el aviso');
    }
  }

  return (
    <div style={{ marginTop: 10, padding: 10, background: 'var(--gray-100)', borderRadius: 8 }}>
      <div style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
        {MOTIVOS.map((m) => (
          <label key={m.valor} style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="radio" name={`motivo-${questionId}`} checked={motivo === m.valor}
              onChange={() => setMotivo(m.valor)} />
            {m.etiqueta}
          </label>
        ))}
      </div>
      <input className="form-input" style={{ fontSize: 13 }} placeholder="Cuéntanos qué has visto (opcional)"
        value={comentario} onChange={(e) => setComentario(e.target.value)} />
      {estado !== 'listo' && estado !== 'enviando' && (
        <div className="alert alert-error" style={{ fontSize: 12.5, marginTop: 8 }}>{estado}</div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="btn btn-primary btn-small" disabled={!motivo || estado === 'enviando'} onClick={enviar}>
          {estado === 'enviando' ? 'Enviando…' : 'Avisar'}
        </button>
        <button className="btn btn-outline btn-small" onClick={() => setAbierto(false)}>Cancelar</button>
      </div>
    </div>
  );
}
