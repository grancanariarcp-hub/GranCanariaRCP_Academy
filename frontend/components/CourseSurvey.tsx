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
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});
  const [itemComments, setItemComments] = useState<Record<string, string>>({});
  const [escala, setEscala] = useState({ min: 1, max: 10, etiquetaMin: 'Muy deficiente', etiquetaMax: 'Excelente' });
  const [globalRating, setGlobalRating] = useState(0);
  const [recomienda, setRecomienda] = useState<boolean | null>(null);
  const [comments, setComments] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api<{ abierta: boolean; yaRespondida: boolean; items: Item[]; escala: typeof escala }>(`/api/student/courses/${courseId}/survey`, { auth: true })
      .then((r) => { setItems(r.items); setAbierta(r.abierta); setYa(r.yaRespondida); if (r.escala) setEscala(r.escala); })
      .catch(() => {});
  }, [courseId]);

  const key = (i: Item) => `${i.kind}:${i.ref ?? i.label}`;
  const faltan = items.filter((i) => !scores[key(i)] && !skipped[key(i)]).length;

  async function enviar() {
    setMsg(null);
    if (faltan > 0 || !globalRating || recomienda === null) {
      setMsg({ ok: false, text: 'Valora todos los ítems (o marca «No deseo evaluar este ítem») y completa la valoración global.' });
      return;
    }
    try {
      await api(`/api/student/courses/${courseId}/survey`, {
        method: 'POST', auth: true,
        body: JSON.stringify({
          scores: items.map((i) => ({
            kind: i.kind, ref: i.ref, label: i.label,
            score: skipped[key(i)] ? null : scores[key(i)],
            skipped: !!skipped[key(i)],
            comment: itemComments[key(i)] || undefined,
          })),
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

  const Escala = ({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) => (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', opacity: disabled ? 0.4 : 1 }}>
      {Array.from({ length: escala.max }, (_, k) => k + 1).map((n) => (
        <button key={n} type="button" disabled={disabled} onClick={() => onChange(n)} title={`${n} de ${escala.max}`}
          style={{
            width: 28, height: 28, borderRadius: 6, cursor: disabled ? 'default' : 'pointer', fontSize: 12, fontWeight: 700,
            border: '1px solid ' + (n === value ? 'var(--primary-dark)' : 'var(--gray-300)'),
            background: n === value ? 'var(--primary-dark)' : '#fff',
            color: n === value ? '#fff' : 'var(--text-secondary)',
          }}>
          {n}
        </button>
      ))}
    </div>
  );

  return (
    <div className="card animate-in" style={{ marginTop: 24 }}>
      <div className="card-header">
        <div className="card-title">Encuesta de satisfacción</div>
        <button className="link-action" onClick={() => setOpen((v) => !v)}>{open ? 'Ocultar' : 'Responder ahora'}</button>
      </div>
      {!open ? (
        <p className="muted" style={{ fontSize: 14 }}>
          Tu opinión nos ayuda a mejorar el curso y es <strong>necesaria para acceder al examen final</strong>
          {' '}(o al certificado, si el curso no tiene examen). Tarda un par de minutos.
        </p>
      ) : (
        <>
          {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}

          <div className="info-box" style={{ fontSize: 13, marginBottom: 14 }}>
            Valora del <strong>{escala.min}</strong> al <strong>{escala.max}</strong>, donde
            {' '}<strong>{escala.min} = {escala.etiquetaMin}</strong> y <strong>{escala.max} = {escala.etiquetaMax}</strong>.
            Todos los ítems son obligatorios; si prefieres no valorar alguno, marca «No deseo evaluar este ítem».
          </div>

          {GRUPOS.map((g) => {
            const del = items.filter((i) => i.kind === g.kind);
            if (del.length === 0) return null;
            return (
              <div key={g.kind} style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{g.titulo}</div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{g.ayuda}</div>
                {del.map((i) => {
                  const k = key(i);
                  return (
                    <div key={k} style={{ padding: '10px 0', borderBottom: '1px solid var(--gray-200)' }}>
                      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>{i.label}</div>
                      <Escala value={scores[k] ?? 0} onChange={(v) => setScores({ ...scores, [k]: v })} disabled={!!skipped[k]} />
                      <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, marginTop: 6, cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!skipped[k]} onChange={(e) => setSkipped({ ...skipped, [k]: e.target.checked })} />
                        No deseo evaluar este ítem
                      </label>
                      <input className="form-input" style={{ marginTop: 6, fontSize: 13 }} placeholder="Comentario sobre este ítem (opcional)"
                        value={itemComments[k] ?? ''} onChange={(e) => setItemComments({ ...itemComments, [k]: e.target.value })} maxLength={1000} />
                    </div>
                  );
                })}
              </div>
            );
          })}

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Valoración global del curso</div>
            <Escala value={globalRating} onChange={setGlobalRating} />
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
