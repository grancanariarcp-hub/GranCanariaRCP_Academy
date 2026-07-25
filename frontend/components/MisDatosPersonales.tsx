'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

/**
 * Datos personales del alumno: nombre, apellidos y documento.
 *
 * Son los que se imprimen en el certificado y con los que se cruza su nota
 * práctica desde PÚLSAR. Los nuevos los dan al registrarse; esto deja a los que
 * ya tenían cuenta completarlos, y a cualquiera corregir una errata antes de que
 * quede impresa.
 */
export function MisDatosPersonales() {
  const [nombre, setNombre] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [documento, setDocumento] = useState('');
  const [faltaDoc, setFaltaDoc] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => {
    api<{ profile: { nombre?: string | null; apellidos?: string | null; dni?: string | null; name?: string } }>('/api/profile', { auth: true })
      .then((r) => {
        setNombre(r.profile.nombre ?? '');
        setApellidos(r.profile.apellidos ?? '');
        setDocumento(r.profile.dni ?? '');
        setFaltaDoc(!r.profile.dni);
      })
      .catch(() => {});
  }, []);

  async function guardar() {
    setMsg(null);
    try {
      await api('/api/profile/student', {
        method: 'PATCH', auth: true, body: JSON.stringify({ nombre, apellidos, documento }),
      });
      setFaltaDoc(false);
      setMsg({ ok: true, texto: '✅ Datos guardados.' });
    } catch (e) {
      setMsg({ ok: false, texto: e instanceof ApiError ? e.message : 'No se pudieron guardar' });
    }
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <div className="card-title">Mis datos personales</div>
        <div className="card-subtitle">Aparecen en tu certificado</div>
      </div>

      {faltaDoc && (
        <div className="alert alert-error" style={{ fontSize: 13 }}>
          Te falta el documento (DNI, NIE o pasaporte). Complétalo: sin él no podrás obtener el
          certificado de un curso.
        </div>
      )}
      {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`} style={{ fontSize: 13 }}>{msg.texto}</div>}

      <div className="grid grid-2" style={{ gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Nombre</label>
          <input className="form-input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Apellidos</label>
          <input className="form-input" value={apellidos} onChange={(e) => setApellidos(e.target.value)} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Documento (DNI, NIE o pasaporte)</label>
        <input className="form-input" value={documento} onChange={(e) => setDocumento(e.target.value)} />
      </div>
      <button className="btn btn-primary btn-small" onClick={guardar}>Guardar datos</button>
    </div>
  );
}
