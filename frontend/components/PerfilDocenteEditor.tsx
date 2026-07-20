'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

/**
 * Titular y profesión del docente.
 *
 * Se mostraban en la ficha pública pero no había forma de escribirlos: solo
 * podían llegar desde el formulario de registro, y quien no los pusiera
 * entonces no podía corregirlo nunca.
 */
export function PerfilDocenteEditor({ onGuardado }: { onGuardado?: () => void }) {
  const [headline, setHeadline] = useState('');
  const [profession, setProfession] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api<{ profile?: { headline: string | null; profession: string | null } }>('/api/profile', { auth: true })
      .then((r) => {
        setHeadline(r.profile?.headline ?? '');
        setProfession(r.profile?.profession ?? '');
      })
      .catch(() => {});
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setGuardando(true);
    try {
      await api('/api/profile', { method: 'PATCH', auth: true, body: JSON.stringify({ headline, profession }) });
      setMsg({ ok: true, text: '✅ Perfil actualizado' });
      onGuardado?.();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'No se pudo guardar' });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header">
        <div className="card-title">Cómo te ven tus alumnos</div>
        <div className="card-subtitle">Aparece junto a tus cursos y en tu ficha pública</div>
      </div>

      {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}

      <form onSubmit={guardar}>
        <div className="form-group">
          <label className="form-label" htmlFor="pd-headline">Titular profesional</label>
          <input id="pd-headline" className="form-input" maxLength={160} value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="Enfermero de UCI · Instructor de SVA" />
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Una línea. Es lo primero que lee quien se plantea matricularse en tu curso.
          </p>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="pd-prof">Profesión sanitaria</label>
          <input id="pd-prof" className="form-input" maxLength={120} value={profession}
            onChange={(e) => setProfession(e.target.value)}
            placeholder="Médico · Enfermero · Técnico de emergencias" />
        </div>

        <button className="btn btn-primary btn-small" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </form>
    </div>
  );
}
