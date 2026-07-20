'use client';

import { useEffect, useState } from 'react';
import { api, ApiError, downloadFile } from '@/lib/api';
import { clearSession } from '@/lib/auth';
import { Ayuda } from '@/components/ayuda/Ayuda';

/**
 * Derechos sobre los propios datos.
 *
 * La plataforma ya sabía exportar los datos de una persona, registrar sus
 * consentimientos y dar de baja su cuenta: estaba escrito, probado y sin
 * ninguna pantalla desde la que usarlo. Con usuarios de pago en la Unión
 * Europea, poder darse de baja y llevarse los datos no es una mejora, es una
 * obligación —y una que no se cumple si el botón no existe.
 *
 * La baja NO borra el expediente académico: anonimiza la cuenta. Un certificado
 * emitido y un acta cerrada son documentos que otras personas pueden tener que
 * verificar años después, y que la ley obliga a conservar; lo que desaparece es
 * quién era esa persona.
 */

interface Consents {
  ranking_consent: boolean | null;
  marketing_consent: boolean | null;
  accepted_terms_at: string | null;
}

export function MisDatos({ esAlumno }: { esAlumno: boolean }) {
  const [c, setC] = useState<Consents | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [password, setPassword] = useState('');
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    api<{ consents: Consents | null }>('/api/profile/consents', { auth: true })
      .then((r) => setC(r.consents)).catch(() => {});
  }, []);

  async function cambiar(campo: 'ranking' | 'marketing', valor: boolean) {
    setMsg(null);
    try {
      await api('/api/profile/consents', { method: 'POST', auth: true, body: JSON.stringify({ [campo]: valor }) });
      setC((p) => (p ? { ...p, [`${campo}_consent`]: valor } : p));
      setMsg({ ok: true, texto: 'Preferencia guardada.' });
    } catch (e) {
      setMsg({ ok: false, texto: e instanceof ApiError ? e.message : 'No se ha podido guardar.' });
    }
  }

  async function descargar() {
    setMsg(null);
    try {
      await downloadFile('/api/profile/legajo', 'mis-datos-grancanaria-rcp.pdf');
    } catch {
      setMsg({ ok: false, texto: 'No se ha podido generar el documento.' });
    }
  }

  async function darDeBaja() {
    setOcupado(true);
    setMsg(null);
    try {
      await api('/api/profile', {
        method: 'DELETE', auth: true,
        body: JSON.stringify({ currentPassword: password, reason: motivo || undefined }),
      });
      // La cuenta ya no vale: se sale del todo, no se deja una sesión huérfana.
      clearSession();
      window.location.href = '/?baja=1';
    } catch (e) {
      setMsg({ ok: false, texto: e instanceof ApiError ? e.message : 'No se ha podido completar la baja.' });
      setOcupado(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div className="card-header">
        <div className="card-title">Mis datos <Ayuda tema="mis-datos" /></div>
        <div className="card-subtitle">Qué guardamos de ti y qué puedes hacer con ello</div>
      </div>

      {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`} style={{ fontSize: 13.5 }}>{msg.texto}</div>}

      <h4 style={{ fontSize: 14.5, margin: '4px 0 8px', color: 'var(--primary-dark)' }}>Llevarte tus datos</h4>
      <p className="muted" style={{ fontSize: 13.5, marginTop: 0 }}>
        Un documento con todo lo que consta a tu nombre: tus datos, tus cursos y tus resultados. Se genera
        en el momento y no se guarda en ninguna parte.
      </p>
      <button className="btn btn-outline btn-small" onClick={descargar}>Descargar mis datos (PDF)</button>

      <h4 style={{ fontSize: 14.5, margin: '22px 0 8px', color: 'var(--primary-dark)' }}>Permisos que has dado</h4>
      {c === null ? (
        <p className="muted" style={{ fontSize: 13.5 }}>Cargando…</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {esAlumno && (
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13.5 }}>
              <input type="checkbox" checked={!!c.ranking_consent} onChange={(e) => cambiar('ranking', e.target.checked)} />
              <span>
                <strong>Aparecer en los rankings públicos</strong> de los desafíos. Si lo desactivas sigues
                participando y conservas tus diplomas; simplemente no sales en la clasificación.
              </span>
            </label>
          )}
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13.5 }}>
            <input type="checkbox" checked={!!c.marketing_consent} onChange={(e) => cambiar('marketing', e.target.checked)} />
            <span>
              <strong>Recibir avisos de nuevos cursos.</strong> Nunca es necesario para usar la plataforma, y
              puedes quitarlo cuando quieras.
            </span>
          </label>
          {c.accepted_terms_at && (
            <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
              Aceptaste las condiciones el {new Date(c.accepted_terms_at).toLocaleDateString('es-ES')}.
            </p>
          )}
        </div>
      )}

      <h4 style={{ fontSize: 14.5, margin: '22px 0 8px', color: 'var(--danger)' }}>Darme de baja</h4>
      <p className="muted" style={{ fontSize: 13.5, marginTop: 0 }}>
        Tu cuenta se cierra y tus datos personales se borran. <strong>Tus certificados y las actas de los
        cursos se conservan</strong>: son documentos que acreditan formación y que la ley obliga a mantener,
        pero dejan de estar asociados a tu nombre en la plataforma. Esta acción no se puede deshacer.
      </p>

      {!confirmando ? (
        <button className="btn btn-outline btn-small" onClick={() => setConfirmando(true)}>
          Quiero darme de baja
        </button>
      ) : (
        <div style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Confirma tu contraseña</label>
            <input className="form-input" type="password" value={password} autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">¿Por qué te vas? (opcional)</label>
            <input className="form-input" value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="Nos ayuda a mejorar" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-danger btn-small" disabled={!password || ocupado} onClick={darDeBaja}>
              {ocupado ? 'Cerrando…' : 'Confirmar la baja'}
            </button>
            <button className="btn btn-outline btn-small" onClick={() => { setConfirmando(false); setPassword(''); }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
