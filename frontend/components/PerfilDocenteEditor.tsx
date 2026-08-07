'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Ayuda } from '@/components/ayuda/Ayuda';
import { REDES, redInfo, type EnlaceSocial } from '@/lib/social';

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
  const [dni, setDni] = useState('');
  const [redes, setRedes] = useState<EnlaceSocial[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api<{ profile?: { headline: string | null; profession: string | null; dni: string | null; social_links?: EnlaceSocial[] } }>('/api/profile', { auth: true })
      .then((r) => {
        setHeadline(r.profile?.headline ?? '');
        setProfession(r.profile?.profession ?? '');
        setDni(r.profile?.dni ?? '');
        setRedes(r.profile?.social_links ?? []);
      })
      .catch(() => {});
  }, []);

  function añadirRed() { setRedes((r) => [...r, { red: 'instagram', etiqueta: '', url: '' }]); }
  function quitarRed(i: number) { setRedes((r) => r.filter((_, k) => k !== i)); }
  function cambiarRed(i: number, campo: keyof EnlaceSocial, valor: string) {
    setRedes((r) => r.map((e, k) => (k === i ? { ...e, [campo]: valor } : e)));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setGuardando(true);
    // Se descartan las filas sin URL (y las «otra» sin nombre): igual que hace el
    // backend, para no guardar iconos que no llevan a ninguna parte.
    const socialLinks = redes
      .filter((x) => x.url.trim() && (x.red !== 'otra' || (x.etiqueta ?? '').trim()))
      .map((x) => ({ red: x.red, etiqueta: x.red === 'otra' ? (x.etiqueta ?? '').trim() : '', url: x.url.trim() }));
    try {
      await api('/api/profile', { method: 'PATCH', auth: true, body: JSON.stringify({ headline, profession, dni, socialLinks }) });
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
        <div className="card-title">Cómo te ven tus alumnos <Ayuda tema="profesor-perfil" /></div>
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

        <div className="form-group">
          <label className="form-label" htmlFor="pd-dni">Documento (DNI, NIE o pasaporte)</label>
          <input id="pd-dni" className="form-input" maxLength={30} value={dni}
            onChange={(e) => setDni(e.target.value)} placeholder="Figura en las actas que firmas" />
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Se usa en las actas y, en cursos con práctica, para identificarte en PÚLSAR.
          </p>
        </div>

        {/* Redes sociales: se ven en tu ficha pública y tu tarjeta. Solo las que rellenes. */}
        <div className="form-group">
          <label className="form-label">Perfiles en redes sociales</label>
          {redes.map((e, i) => {
            const info = redInfo(e.red);
            return (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', width: 24, justifyContent: 'center', color: 'var(--primary-dark)' }}
                  dangerouslySetInnerHTML={{ __html: info.icono }} />
                <select className="form-select" style={{ width: 'auto', minWidth: 120 }} value={e.red}
                  onChange={(ev) => cambiarRed(i, 'red', ev.target.value)}>
                  {REDES.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
                {e.red === 'otra' && (
                  <input className="form-input" style={{ width: 120 }} maxLength={40} placeholder="Nombre"
                    value={e.etiqueta ?? ''} onChange={(ev) => cambiarRed(i, 'etiqueta', ev.target.value)} />
                )}
                <input className="form-input" style={{ flex: 1, minWidth: 160 }}
                  placeholder={e.red === 'web' ? 'https://tu-sitio.es' : 'Enlace a tu perfil'}
                  value={e.url} onChange={(ev) => cambiarRed(i, 'url', ev.target.value)} />
                <button type="button" className="btn btn-outline btn-small" title="Quitar" onClick={() => quitarRed(i)}>✕</button>
              </div>
            );
          })}
          <button type="button" className="btn btn-outline btn-small" onClick={añadirRed}>+ Añadir perfil RRSS</button>
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Se muestran solo los que rellenes. Puedes escribir el enlace sin «https://».
          </p>
        </div>

        <button className="btn btn-primary btn-small" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </form>
    </div>
  );
}
