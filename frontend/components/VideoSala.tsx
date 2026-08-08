'use client';

import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';

/**
 * Sala de videoconferencia dentro del campus (Fase 1: Jitsi embebido).
 *
 * El vídeo lo sirve Jitsi; nuestro backend solo autoriza el acceso, da el nombre
 * de sala y registra la asistencia por latidos. Compartir pantalla lo trae la
 * propia barra de Jitsi. La grabación selectiva llegará con LiveKit (Fase 2).
 */

interface Sala { room: string; rol: 'profesor' | 'alumno'; nombre: string; camaraObligatoria: boolean }
interface Asistente { nombre: string; rol: string; camara_on: boolean; segundos: number; conectado: boolean }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Jitsi = any;

function cargarJitsi(): Promise<void> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).JitsiMeetExternalAPI) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://meet.jit.si/external_api.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('No se pudo cargar el vídeo'));
    document.body.appendChild(s);
  });
}

export function VideoSala({ activityId, onClose }: { activityId: string; onClose: () => void }) {
  const contRef = useRef<HTMLDivElement>(null);
  const jitsiRef = useRef<Jitsi>(null);
  const camaraOnRef = useRef(false);
  const [sala, setSala] = useState<Sala | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asistencia, setAsistencia] = useState<Asistente[]>([]);

  useEffect(() => {
    let cancelado = false;
    let hb: ReturnType<typeof setInterval> | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;

    (async () => {
      try {
        const s = await api<Sala>(`/api/video/${activityId}/sala`, { auth: true });
        if (cancelado) return;
        setSala(s);
        await cargarJitsi();
        if (cancelado || !contRef.current) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const JitsiAPI = (window as any).JitsiMeetExternalAPI;
        const jitsi: Jitsi = new JitsiAPI('meet.jit.si', {
          roomName: s.room,
          parentNode: contRef.current,
          userInfo: { displayName: s.nombre },
          configOverwrite: {
            startWithAudioMuted: true,          // evita eco al entrar; cada uno se activa
            startWithVideoMuted: false,         // cámara encendida de partida
            prejoinPageEnabled: false,
            disableDeepLinking: true,
          },
          interfaceConfigOverwrite: {
            MOBILE_APP_PROMO: false,
            SHOW_JITSI_WATERMARK: false,
            SHOW_CHROME_EXTENSION_BANNER: false,
          },
        });
        jitsiRef.current = jitsi;

        const latido = () => api(`/api/video/${activityId}/heartbeat`, {
          method: 'POST', auth: true, body: JSON.stringify({ camaraOn: camaraOnRef.current }),
        }).catch(() => { /* la clase no se rompe si falla un latido */ });

        jitsi.on('videoConferenceJoined', () => { camaraOnRef.current = true; latido(); });
        jitsi.on('videoMuteStatusChanged', (e: { muted: boolean }) => { camaraOnRef.current = !e.muted; });
        jitsi.on('screenSharingStatusChanged', (e: { on: boolean }) => { if (e.on) camaraOnRef.current = true; });
        jitsi.on('readyToClose', () => onClose());
        hb = setInterval(latido, 30000);

        // El profesor ve la asistencia en vivo.
        if (s.rol === 'profesor') {
          const cargarAsistencia = () => api<{ asistencia: Asistente[] }>(`/api/video/${activityId}/asistencia`, { auth: true })
            .then((r) => setAsistencia(r.asistencia)).catch(() => {});
          cargarAsistencia();
          poll = setInterval(cargarAsistencia, 15000);
        }
      } catch (e) {
        if (!cancelado) setError(e instanceof ApiError ? e.message : 'No se pudo abrir la sala');
      }
    })();

    return () => {
      cancelado = true;
      if (hb) clearInterval(hb);
      if (poll) clearInterval(poll);
      try { jitsiRef.current?.dispose(); } catch { /* ya cerrada */ }
    };
  }, [activityId, onClose]);

  const enLinea = asistencia.filter((a) => a.conectado).length;

  return (
    <div className="modal-backdrop" style={{ zIndex: 130 }}>
      <div className="modal modal-wide" style={{ width: 'min(1150px, 96vw)', height: '92vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div className="card-title">
            Clase en directo{' '}
            {sala?.rol === 'profesor' && <span className="badge badge-primary">profesor</span>}
          </div>
          <button className="btn btn-outline btn-small" onClick={onClose}>Salir de la clase</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {sala?.camaraObligatoria && sala?.rol === 'alumno' && (
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
            En esta clase la cámara debe permanecer encendida.
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flex: 1, minHeight: 0 }}>
          <div ref={contRef} style={{ flex: 1, minHeight: 0, borderRadius: 10, overflow: 'hidden', background: '#000' }} />
          {sala?.rol === 'profesor' && (
            <div style={{ width: 230, overflowY: 'auto', borderLeft: '1px solid var(--gray-200)', paddingLeft: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Asistencia · {enLinea} en línea</div>
              {asistencia.length === 0 ? (
                <div className="muted" style={{ fontSize: 12 }}>Aún no hay nadie.</div>
              ) : asistencia.map((a, i) => (
                <div key={i} style={{ fontSize: 12.5, padding: '5px 0', borderBottom: '1px solid var(--gray-100)' }}>
                  <span style={{ color: a.conectado ? 'var(--success)' : 'var(--text-secondary)' }}>●</span>{' '}
                  {a.nombre}{a.rol === 'profesor' ? ' 👑' : ''} {a.camara_on ? '📷' : ''}
                  <div className="muted" style={{ fontSize: 11 }}>{Math.max(1, Math.round(a.segundos / 60))} min presente</div>
                </div>
              ))}
              <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>
                Para proyectar, usa «Compartir pantalla» en la barra de la clase.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
