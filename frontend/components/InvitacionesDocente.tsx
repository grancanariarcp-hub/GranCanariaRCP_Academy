'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

/**
 * Invitaciones a cursos pendientes de respuesta del profesor.
 *
 * Incluir a un profesor no lo hace participante: su participación queda
 * pendiente hasta que la acepta aquí. Mientras no responda, no figura como
 * responsable del curso ni en su acta. Si no tiene ninguna pendiente, no se
 * pinta nada.
 */
interface Invitacion { course_id: string; title: string; role: string; parte: string; director: string | null }

const ROL: Record<string, string> = { director: 'director', instructor: 'instructor' };
const PARTE: Record<string, string> = { teorica: 'parte teórica', practica: 'parte práctica', ambas: 'teoría y práctica' };

export function InvitacionesDocente() {
  const [invs, setInvs] = useState<Invitacion[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  function cargar() {
    api<{ invitaciones: Invitacion[] }>('/api/profile/invitaciones', { auth: true })
      .then((r) => setInvs(r.invitaciones)).catch(() => {});
  }
  useEffect(() => { cargar(); }, []);

  async function responder(courseId: string, accion: 'aceptar' | 'rechazar') {
    setMsg(null);
    try {
      await api(`/api/profile/invitaciones/${courseId}`, { method: 'POST', auth: true, body: JSON.stringify({ accion }) });
      setInvs((prev) => prev.filter((i) => i.course_id !== courseId));
      setMsg(accion === 'aceptar' ? '✅ Invitación aceptada. Ya participas en el curso.' : 'Invitación rechazada.');
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'No se pudo responder');
    }
  }

  if (invs.length === 0 && !msg) return null;

  return (
    <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid var(--warning)' }}>
      <div className="card-header">
        <div className="card-title">Invitaciones a cursos</div>
        <div className="card-subtitle">Debes aceptar para figurar como profesor del curso</div>
      </div>
      {msg && <div className="alert alert-success" style={{ fontSize: 13 }}>{msg}</div>}
      {invs.map((i) => (
        <div key={i.course_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--gray-200)', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 600 }}>{i.title}</div>
            <div className="muted" style={{ fontSize: 12.5 }}>
              Como <strong>{ROL[i.role] ?? i.role}</strong> · {PARTE[i.parte] ?? i.parte}
              {i.director ? ` · te invita ${i.director}` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-small" onClick={() => responder(i.course_id, 'aceptar')}>Aceptar</button>
            <button className="btn btn-outline btn-small" onClick={() => responder(i.course_id, 'rechazar')}>Rechazar</button>
          </div>
        </div>
      ))}
    </div>
  );
}
