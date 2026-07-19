'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Group { scope: 'global' | 'curso'; courseId: string | null; title: string; url: string }

/**
 * Aviso emergente para unirse a los grupos de WhatsApp pendientes.
 * Aparece al entrar y deja de hacerlo cuando el alumno marca que se unió.
 * Unirse es voluntario: el teléfono queda en WhatsApp, no en la plataforma.
 */
export function WhatsAppPrompt() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [i, setI] = useState(0);

  useEffect(() => {
    api<{ groups: Group[] }>('/api/profile/whatsapp', { auth: true })
      .then((r) => setGroups(r.groups)).catch(() => {});
  }, []);

  if (groups.length === 0 || i >= groups.length) return null;
  const g = groups[i];

  async function joined() {
    try { await api('/api/profile/whatsapp/joined', { method: 'POST', auth: true, body: JSON.stringify({ courseId: g.courseId ?? undefined }) }); } catch { /* ignore */ }
    setI((v) => v + 1);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div className="card animate-pop" style={{ maxWidth: 420, width: '100%' }}>
        <div className="card-header">
          <div className="card-title">Únete al grupo de WhatsApp</div>
        </div>
        <p style={{ marginBottom: 10 }}>
          {g.scope === 'curso'
            ? <>Hay un grupo para el curso <strong>{g.title}</strong> donde se resuelven dudas y se avisa de novedades.</>
            : <>Tenemos un grupo de la comunidad <strong>{g.title}</strong> con avisos, desafíos y contenidos.</>}
        </p>
        <div className="info-box" style={{ fontSize: 12, marginBottom: 14 }}>
          Unirte es <strong>voluntario</strong>. Al hacerlo, tu número será visible para el resto de miembros del grupo,
          ya que la gestión corre a cargo de WhatsApp y no de esta plataforma.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a
            className="btn btn-primary"
            href={g.url}
            target="_blank"
            rel="noreferrer"
            onClick={joined}
            style={{ background: 'linear-gradient(135deg,#128C7E,#25D366)', color: '#fff', flex: 1 }}
          >
            Unirme al grupo
          </a>
          <button className="btn btn-outline" onClick={() => setI((v) => v + 1)}>Ahora no</button>
        </div>
        <button className="link-action" style={{ marginTop: 10 }} onClick={joined}>Ya estoy dentro, no volver a preguntar</button>
      </div>
    </div>
  );
}
