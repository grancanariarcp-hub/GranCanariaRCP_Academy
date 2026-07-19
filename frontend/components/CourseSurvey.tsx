'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

interface Item { kind: 'modulo' | 'profesor' | 'general'; ref: string | null; label: string }

const GRUPOS: Array<{ kind: Item['kind']; titulo: string; ayuda: string }> = [
  { kind: 'modulo', titulo: 'Los módulos del curso', ayuda: '¿Qué te han parecido los contenidos de cada módulo?' },
  { kind: 'profesor', titulo: 'El profesorado', ayuda: 'Valora la claridad y la utilidad de cada docente.' },
  { kind: 'general', titulo: 'Aspectos generales', ayuda: 'Metodología, organización y materiales.' },
];

/** Encuesta de satisfacción del curso, con los ítems generados desde el curso. */
export function CourseSurvey({ courseId }: { courseId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [abierta, setAbierta] = useState(true);
  const [ya, setYa] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [globalRating, setGlobalRating] = useState(0);
  const [recomienda, setRecomienda] = useState<boolean | null>(null);
  const [comments, setComments] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api<{ abierta: boolean; yaRespondida: boolean; items: Item[] }>(`/api/student/courses/${courseId}/survey`, { auth: true })
      .then((r) => { setItems(r.items); setAbierta(r.abierta); setYa(r.yaRespondida); })
      .catch(() => {});
  }, [courseId]);

  const key = (i: Item) => `${i.kind}:${i.ref ?? i.label}`;
  const faltan = items.filter((i) => !scores[key(i)]).length;

  async function enviar() {
    setMsg(null);
    if (faltan > 0 || !globalRating || recomienda === null) {
      setMsg({ ok: false, text: 'Completa todas las valoraciones antes de enviar.' });
      return;
    }
    try {
      await api(`/api/student/courses/${courseId}/survey`, {
        method: 'POST', auth: true,
        body: JSON.stringify({
          scores: items.map((i) => ({ kind: i.kind, ref: i.ref, label: i.label, score: scores[key(i)] })),
          globalRating, wouldRecommend: recomienda, comments: comments || undefined,
        }),
      });
      setYa(true);
      setMsg({ ok: true, text: '¡Gracias! Tu valoración nos ayuda a mejorar el curso.' });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Error al enviar' });
    }
  }

  if (items.length === 0) return null;
  if (ya) {
    return (
      <div className="card animate-in" style={{ marginTop: 24 }}>
        <div className="card-header"><div className="card-title">Encuesta de satisfacción</div></div>
        <div className="alert alert-success">✅ Ya has respondido la encuesta de este curso. ¡Gracias!</div>
      </div>
    );
  }
  if (!abierta) return null;

  const Estrellas = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <span style={{ whiteSpace: 'nowrap' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} title={`${n} de 5`}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: '0 1px', lineHeight: 1, filter: n <= value ? 'none' : 'grayscale(1) opacity(0.35)' }}>
          ⭐
        </button>
      ))}
    </span>
  );

  return (
    <div className="card animate-in" style={{ marginTop: 24 }}>
      <div className="card-header">
        <div className="card-title">Encuesta de satisfacción</div>
        <button className="link-action" onClick={() => setOpen((v) => !v)}>{open ? 'Ocultar' : 'Responder ahora'}</button>
      </div>
      {!open ? (
        <p className="muted" style={{ fontSize: 14 }}>Tu opinión es anónima para el resto de alumnos y nos ayuda a mejorar el curso. Tarda menos de 2 minutos.</p>
      ) : (
        <>
          {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}

          {GRUPOS.map((g) => {
            const del = items.filter((i) => i.kind === g.kind);
            if (del.length === 0) return null;
            return (
              <div key={g.kind} style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{g.titulo}</div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{g.ayuda}</div>
                {del.map((i) => (
                  <div key={key(i)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--gray-200)' }}>
                    <span style={{ fontSize: 14 }}>{i.label}</span>
                    <Estrellas value={scores[key(i)] ?? 0} onChange={(v) => setScores({ ...scores, [key(i)]: v })} />
                  </div>
                ))}
              </div>
            );
          })}

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Valoración global del curso</div>
            <Estrellas value={globalRating} onChange={setGlobalRating} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>¿Recomendarías este curso a un compañero?</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className={`btn btn-small ${recomienda === true ? 'btn-primary' : 'btn-outline'}`} onClick={() => setRecomienda(true)}>Sí, lo recomendaría</button>
              <button type="button" className={`btn btn-small ${recomienda === false ? 'btn-primary' : 'btn-outline'}`} onClick={() => setRecomienda(false)}>No</button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Recomendaciones o sugerencias de mejora</label>
            <textarea className="form-input" style={{ height: 80, padding: 10 }} value={comments} onChange={(e) => setComments(e.target.value)} maxLength={2000} />
          </div>

          <button className="btn btn-primary btn-full" onClick={enviar}>
            Enviar encuesta{faltan > 0 ? ` (faltan ${faltan} valoraciones)` : ''}
          </button>
        </>
      )}
    </div>
  );
}
