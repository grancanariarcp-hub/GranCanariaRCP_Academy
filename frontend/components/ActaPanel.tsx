'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, downloadFile } from '@/lib/api';

/**
 * Acta del curso en el panel de dirección.
 *
 * El borrador se puede sacar cuantas veces haga falta. Cerrar el acta congela
 * los datos: por eso el botón avisa antes y una corrección posterior exige
 * declarar el motivo, que queda registrado en la nueva versión.
 */

interface Acta {
  id: string;
  numero: string;
  version: number;
  code: string;
  hash: string;
  motivo: string | null;
  closed_at: string;
  cerrada_por: string | null;
  resumen: { matriculados: number; aptos: number; noAptos: number; presentados: number } | null;
}

export function ActaPanel({ courseId }: { courseId: string }) {
  const [actas, setActas] = useState<Acta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [cerrando, setCerrando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await api<{ actas: Acta[] }>(`/api/courses/${courseId}/actas`, { auth: true });
      setActas(r.actas);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las actas');
    } finally {
      setCargando(false);
    }
  }, [courseId]);

  useEffect(() => { cargar(); }, [cargar]);

  const yaHayActa = actas.length > 0;

  async function cerrar() {
    if (!yaHayActa && !confirm(
      'Al cerrar el acta se congelan los datos del curso: alumnos, calificaciones, asistencia y encuesta '
      + 'quedan fijados tal y como están ahora.\n\n¿Cerrar el acta?',
    )) return;

    setCerrando(true);
    setError('');
    setMsg('');
    try {
      const r = await api<{ acta: { numero: string; version: number } }>(`/api/courses/${courseId}/acta`, {
        method: 'POST', auth: true,
        body: JSON.stringify(yaHayActa ? { motivo } : {}),
      });
      setMsg(`✅ Acta ${r.acta.numero}${r.acta.version > 1 ? ` (versión ${r.acta.version})` : ''} cerrada`);
      setMotivo('');
      setPidiendoMotivo(false);
      cargar();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'MOTIVO_REQUERIDO') setPidiendoMotivo(true);
      else setError(e instanceof Error ? e.message : 'No se pudo cerrar el acta');
    } finally {
      setCerrando(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="card-title">Acta del curso</div>
          <div className="card-subtitle">Documento que cierra la actividad formativa</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-small"
            onClick={() => downloadFile(`/api/courses/${courseId}/acta/preview.pdf`, 'acta-borrador.pdf')}>
            Ver borrador
          </button>
          <button className="btn btn-primary btn-small press" onClick={() => (yaHayActa ? setPidiendoMotivo(true) : cerrar())} disabled={cerrando}>
            {cerrando ? 'Cerrando…' : yaHayActa ? 'Rehacer el acta' : 'Cerrar el acta'}
          </button>
        </div>
      </div>

      {error && <p className="alert alert-error">{error}</p>}
      {msg && <p className="alert alert-success">{msg}</p>}

      {pidiendoMotivo && (
        <div style={{ background: 'var(--gray-100)', padding: 14, borderRadius: 10, marginBottom: 14 }}>
          <label className="form-label" htmlFor="acta-motivo">Motivo de la corrección</label>
          <input id="acta-motivo" className="form-input" value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder="Corrección de la calificación de un alumno" />
          <p className="muted" style={{ fontSize: 12, margin: '6px 0 10px' }}>
            El acta anterior no se borra: se conserva y esta pasa a ser una versión nueva del mismo número.
          </p>
          <button className="btn btn-primary btn-small" onClick={cerrar} disabled={cerrando || motivo.trim().length < 3}>
            Cerrar nueva versión
          </button>{' '}
          <button className="btn btn-outline btn-small" onClick={() => { setPidiendoMotivo(false); setMotivo(''); }}>
            Cancelar
          </button>
        </div>
      )}

      {cargando ? (
        <p className="muted">Cargando…</p>
      ) : actas.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          Este curso aún no tiene acta. Saca primero el borrador para revisar que los datos son correctos;
          al cerrarla quedarán congelados y verificables.
        </p>
      ) : (
        <div className="table-responsive">
          <table className="table-plain">
            <thead>
              <tr><th>Acta</th><th>Cerrada</th><th>Resultado</th><th>Motivo</th><th></th></tr>
            </thead>
            <tbody>
              {actas.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.numero}</strong>
                    {a.version > 1 && <span className="badge badge-warning" style={{ marginLeft: 6, fontSize: 11 }}>v{a.version}</span>}
                    <div className="muted" style={{ fontSize: 11, fontFamily: 'monospace' }}>{a.hash.slice(0, 16)}…</div>
                  </td>
                  <td>
                    {new Date(a.closed_at).toLocaleDateString('es-ES')}
                    {a.cerrada_por && <div className="muted" style={{ fontSize: 12 }}>{a.cerrada_por}</div>}
                  </td>
                  <td>
                    {a.resumen
                      ? <>{a.resumen.aptos} aptos de {a.resumen.matriculados}</>
                      : '—'}
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>{a.motivo || '—'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="link-action"
                      onClick={() => downloadFile(`/api/courses/${courseId}/actas/${a.code}.pdf`, `${a.numero}.pdf`)}>
                      Descargar
                    </button>{' · '}
                    <a className="link-action" href={`/acta/${a.code}`} target="_blank" rel="noreferrer">Verificar</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
