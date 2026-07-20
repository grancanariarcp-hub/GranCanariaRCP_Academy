'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, downloadFile } from '@/lib/api';
import { Ayuda } from '@/components/ayuda/Ayuda';

/**
 * Asistencia presencial en el panel del director.
 *
 * Una jornada por día o actividad. Al proyectar el QR, la imagen se renueva
 * sola antes de que caduque el token: quien fotografíe la pantalla y reenvíe la
 * foto no consigue nada porque el código ya no vale al llegar.
 */

interface Session {
  id: string;
  title: string;
  session_date: string;
  starts_at: string | null;
  ends_at: string | null;
  min_minutes: number;
  qr_window_seconds: number;
  is_open: boolean;
  entradas: number;
  salidas: number;
}

interface RecordRow {
  student_id: string;
  display_name: string;
  apellidos: string | null;
  nombre: string | null;
  dni: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  in_method: string | null;
  out_method: string | null;
  incidencia: string | null;
}

const hora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '—';

const nombreCompleto = (r: RecordRow) =>
  r.apellidos ? `${r.apellidos}, ${r.nombre || ''}`.trim().replace(/,$/, '') : r.display_name;

export function AttendancePanel({ courseId }: { courseId: string }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState({
    title: '',
    sessionDate: new Date().toISOString().slice(0, 10),
    startsAt: '09:00',
    endsAt: '14:00',
    minMinutes: 30,
  });

  const [qrDe, setQrDe] = useState<Session | null>(null);
  const [listaDe, setListaDe] = useState<Session | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await api<{ sessions: Session[] }>(`/api/courses/${courseId}/attendance/sessions`, { auth: true });
      setSessions(r.sessions);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las jornadas');
    } finally {
      setCargando(false);
    }
  }, [courseId]);

  useEffect(() => { cargar(); }, [cargar]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api(`/api/courses/${courseId}/attendance/sessions`, {
        method: 'POST', auth: true,
        body: JSON.stringify({ ...form, minMinutes: Number(form.minMinutes) }),
      });
      setForm({ ...form, title: '' });
      setCreando(false);
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la jornada');
    }
  }

  async function borrar(s: Session) {
    if (!confirm(`¿Eliminar la jornada «${s.title}» y todos sus registros de asistencia?`)) return;
    await api(`/api/courses/${courseId}/attendance/sessions/${s.id}`, { method: 'DELETE', auth: true });
    cargar();
  }

  async function alternarApertura(s: Session) {
    await api(`/api/courses/${courseId}/attendance/sessions/${s.id}`, {
      method: 'PATCH', auth: true, body: JSON.stringify({ isOpen: !s.is_open }),
    });
    cargar();
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="card-title">Asistencia presencial <Ayuda tema="profesor-asistencia" /></div>
          <div className="card-subtitle">Una jornada por día o actividad. El alumnado ficha con el QR desde su perfil.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-small" onClick={() => downloadFile(`/api/courses/${courseId}/attendance/list.pdf`, 'listado-asistencia.pdf')}>
            Listado para firmar
          </button>
          <button className="btn btn-primary btn-small" onClick={() => setCreando((v) => !v)}>
            {creando ? 'Cancelar' : 'Nueva jornada'}
          </button>
        </div>
      </div>

      {error && <p className="alert alert-error">{error}</p>}

      {creando && (
        <form onSubmit={crear} style={{ background: 'var(--gray-100)', padding: 14, borderRadius: 10, marginBottom: 16 }}>
          <div className="grid grid-2" style={{ gap: 12 }}>
            <div>
              <label className="form-label" htmlFor="a-title">Título de la jornada</label>
              <input id="a-title" className="form-input" required minLength={2} placeholder="Prácticas con maniquí — día 1"
                value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="form-label" htmlFor="a-date">Fecha</label>
              <input id="a-date" type="date" className="form-input" required
                value={form.sessionDate} onChange={(e) => setForm({ ...form, sessionDate: e.target.value })} />
            </div>
            <div>
              <label className="form-label" htmlFor="a-ini">Hora de inicio</label>
              <input id="a-ini" type="time" className="form-input" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
            </div>
            <div>
              <label className="form-label" htmlFor="a-fin">Hora de fin</label>
              <input id="a-fin" type="time" className="form-input" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
            </div>
            <div>
              <label className="form-label" htmlFor="a-min">Permanencia mínima (minutos)</label>
              <input id="a-min" type="number" min={0} max={600} className="form-input"
                value={form.minMinutes} onChange={(e) => setForm({ ...form, minMinutes: Number(e.target.value) })} />
              <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Impide que se fiche entrada y salida seguidas y conste como jornada completa.
              </p>
            </div>
          </div>
          <button className="btn btn-primary btn-small" style={{ marginTop: 12 }}>Crear jornada</button>
        </form>
      )}

      {cargando ? (
        <p className="muted">Cargando…</p>
      ) : sessions.length === 0 ? (
        <p className="muted">Aún no hay jornadas presenciales. Crea una para poder pasar lista.</p>
      ) : (
        <div className="table-responsive">
          <table className="table-plain">
            <thead>
              <tr><th>Jornada</th><th>Fecha</th><th>Entradas</th><th>Salidas</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="row-actions">
                  <td>{s.title}</td>
                  <td>{new Date(s.session_date).toLocaleDateString('es-ES')}{s.starts_at ? ` · ${s.starts_at.slice(0, 5)}` : ''}</td>
                  <td>{s.entradas}</td>
                  <td>{s.salidas}</td>
                  <td>
                    <span className={`badge ${s.is_open ? 'badge-success' : ''}`}>{s.is_open ? 'Abierta' : 'Cerrada'}</span>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="link-action" onClick={() => setQrDe(s)}>Mostrar QR</button>{' · '}
                    <button className="link-action" onClick={() => setListaDe(s)}>Pasar lista</button>{' · '}
                    <button className="link-action" onClick={() => alternarApertura(s)}>{s.is_open ? 'Cerrar' : 'Abrir'}</button>{' · '}
                    <button className="link-action danger" onClick={() => borrar(s)}>Borrar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {qrDe && <QrProyector courseId={courseId} session={qrDe} onClose={() => { setQrDe(null); cargar(); }} />}
      {listaDe && <ListaClase courseId={courseId} session={listaDe} onClose={() => { setListaDe(null); cargar(); }} />}
    </div>
  );
}

/** QR a pantalla completa, con cuenta atrás y renovación automática. */
function QrProyector({ courseId, session, onClose }: { courseId: string; session: Session; onClose: () => void }) {
  const [qr, setQr] = useState<{ qrDataUrl: string; expiresInSeconds: number } | null>(null);
  const [restante, setRestante] = useState(0);
  const [error, setError] = useState('');
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    async function renovar() {
      try {
        const r = await api<{ qrDataUrl: string; expiresInSeconds: number }>(
          `/api/courses/${courseId}/attendance/sessions/${session.id}/qr`, { auth: true },
        );
        if (!vivo.current) return;
        setQr(r);
        setRestante(r.expiresInSeconds);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo generar el QR');
      }
    }
    renovar();
    // Se renueva un segundo antes de caducar para que nunca se muestre uno muerto.
    const tick = setInterval(() => {
      setRestante((s) => {
        if (s <= 1) { renovar(); return session.qr_window_seconds; }
        return s - 1;
      });
    }, 1000);
    return () => { vivo.current = false; clearInterval(tick); };
  }, [courseId, session.id, session.qr_window_seconds]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
        <h3 style={{ marginBottom: 4 }}>{session.title}</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
          Proyecta esta pantalla. El código se renueva solo cada {session.qr_window_seconds} s.
        </p>
        {error ? (
          <p className="alert alert-error">{error}</p>
        ) : qr ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr.qrDataUrl} alt="Código QR de asistencia" style={{ width: 'min(70vw, 380px)', imageRendering: 'pixelated' }} />
            <div style={{ marginTop: 10 }}>
              <div style={{ height: 6, background: 'var(--gray-200)', borderRadius: 999, overflow: 'hidden', maxWidth: 380, margin: '0 auto' }}>
                <div style={{
                  height: '100%', width: `${(restante / session.qr_window_seconds) * 100}%`,
                  background: restante <= 5 ? 'var(--danger)' : 'var(--success)', transition: 'width 1s linear',
                }} />
              </div>
              <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Se renueva en {restante} s</p>
            </div>
          </>
        ) : (
          <p className="muted">Generando…</p>
        )}
        <button className="btn btn-outline btn-small" style={{ marginTop: 18 }} onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}

/** Lista de clase con marcado manual a un clic. */
function ListaClase({ courseId, session, onClose }: { courseId: string; session: Session; onClose: () => void }) {
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const r = await api<{ records: RecordRow[] }>(
        `/api/courses/${courseId}/attendance/sessions/${session.id}/records`, { auth: true },
      );
      setRows(r.records);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la lista');
    } finally {
      setCargando(false);
    }
  }, [courseId, session.id]);

  useEffect(() => { cargar(); }, [cargar]);

  async function marcar(studentId: string, action: 'in' | 'out' | 'clear') {
    try {
      await api(`/api/courses/${courseId}/attendance/sessions/${session.id}/records/${studentId}`, {
        method: 'POST', auth: true, body: JSON.stringify({ action }),
      });
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar');
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 4 }}>Pasar lista · {session.title}</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
          {new Date(session.session_date).toLocaleDateString('es-ES')} · marca a mano a quien no haya podido escanear.
        </p>
        {error && <p className="alert alert-error">{error}</p>}
        {cargando ? (
          <p className="muted">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="muted">No hay alumnos matriculados en el curso.</p>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '60vh' }}>
            <table className="table-plain">
              <thead>
                <tr><th>#</th><th>Alumno</th><th>Entrada</th><th>Salida</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.student_id}>
                    <td className="muted">{i + 1}</td>
                    <td>
                      {nombreCompleto(r)}
                      {r.incidencia && <div className="muted" style={{ fontSize: 12 }}>{r.incidencia}</div>}
                    </td>
                    <td>
                      {hora(r.check_in_at)}
                      {r.in_method === 'manual' && <span className="muted" style={{ fontSize: 11 }}> (manual)</span>}
                    </td>
                    <td>
                      {hora(r.check_out_at)}
                      {r.out_method === 'manual' && <span className="muted" style={{ fontSize: 11 }}> (manual)</span>}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="link-action" onClick={() => marcar(r.student_id, 'in')}>Entrada</button>{' · '}
                      <button className="link-action" onClick={() => marcar(r.student_id, 'out')}>Salida</button>
                      {(r.check_in_at || r.check_out_at) && (
                        <>{' · '}<button className="link-action danger" onClick={() => marcar(r.student_id, 'clear')}>Limpiar</button></>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button className="btn btn-outline btn-small" style={{ marginTop: 16 }} onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
