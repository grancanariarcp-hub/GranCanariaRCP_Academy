'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

/**
 * Jornadas presenciales del alumno, con su botón para fichar.
 *
 * Se intenta abrir el lector dentro de la app usando BarcodeDetector, que ya
 * traen los Chrome de Android. Donde no existe (iPhone, navegadores antiguos)
 * se indica usar la cámara del móvil: el QR codifica una URL, así que el lector
 * nativo lleva igualmente a la pantalla de confirmación.
 */

interface Jornada {
  id: string;
  title: string;
  session_date: string;
  starts_at: string | null;
  ends_at: string | null;
  is_open: boolean;
  course_id: string;
  course_title: string;
  check_in_at: string | null;
  check_out_at: string | null;
}

const hora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : null;

export function MyAttendance({ courseId }: { courseId?: string }) {
  const [jornadas, setJornadas] = useState<Jornada[]>([]);
  const [cargando, setCargando] = useState(true);
  const [lector, setLector] = useState(false);

  useEffect(() => {
    api<{ sessions: Jornada[] }>('/api/student/attendance', { auth: true })
      .then((r) => setJornadas(courseId ? r.sessions.filter((s) => s.course_id === courseId) : r.sessions))
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [courseId]);

  if (cargando || jornadas.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid #0d9488' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="card-title">Asistencia presencial</div>
          <div className="card-subtitle">Escanea el QR que muestra tu profesor al entrar y al salir.</div>
        </div>
        <button className="btn btn-primary btn-small press" onClick={() => setLector(true)}>Escanear QR</button>
      </div>

      <div className="table-responsive">
        <table className="table-plain">
          <thead>
            <tr><th>Jornada</th><th>Fecha</th><th>Entrada</th><th>Salida</th><th></th></tr>
          </thead>
          <tbody>
            {jornadas.map((j) => (
              <tr key={j.id}>
                <td>
                  {j.title}
                  {!courseId && <div className="muted" style={{ fontSize: 12 }}>{j.course_title}</div>}
                </td>
                <td>{new Date(j.session_date).toLocaleDateString('es-ES')}</td>
                <td>{hora(j.check_in_at) || <span className="muted">—</span>}</td>
                <td>{hora(j.check_out_at) || <span className="muted">—</span>}</td>
                <td style={{ textAlign: 'right' }}>
                  {j.check_in_at && j.check_out_at ? (
                    <span className="badge badge-success">Completa</span>
                  ) : !j.is_open ? (
                    <span className="badge">Cerrada</span>
                  ) : (
                    <button className="link-action" onClick={() => setLector(true)}>
                      {j.check_in_at ? 'Registrar salida' : 'Registrar entrada'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {lector && <LectorQr onClose={() => setLector(false)} />}
    </div>
  );
}

/** Lector de QR dentro de la app, con respaldo a la cámara del móvil. */
function LectorQr({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [soportado, setSoportado] = useState<boolean | null>(null);

  useEffect(() => {
    const Detector = (window as unknown as { BarcodeDetector?: new (o: unknown) => { detect: (v: unknown) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) { setSoportado(false); return; }
    setSoportado(true);

    let stream: MediaStream | undefined;
    let parar = false;
    const detector = new Detector({ formats: ['qr_code'] });
    const video = document.getElementById('lector-video') as HTMLVideoElement | null;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        const bucle = async () => {
          if (parar) return;
          try {
            const codigos = await detector.detect(video);
            const url = codigos[0]?.rawValue;
            if (url) {
              parar = true;
              // El QR lleva una URL completa; navegamos a su ruta interna.
              const destino = url.startsWith('http') ? new URL(url).pathname + new URL(url).search : url;
              router.push(destino);
              return;
            }
          } catch { /* fotograma ilegible: se reintenta */ }
          requestAnimationFrame(bucle);
        };
        bucle();
      } catch {
        setError('No se pudo acceder a la cámara. Revisa los permisos del navegador.');
      }
    })();

    return () => { parar = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [router]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
        <h3 style={{ marginBottom: 12 }}>Escanear el QR de clase</h3>
        {soportado === false ? (
          <p style={{ marginBottom: 16 }}>
            Tu navegador no permite leer códigos desde aquí. <strong>Abre la cámara de tu móvil</strong> y
            apunta al QR de la pantalla: te traerá directamente a la confirmación.
          </p>
        ) : error ? (
          <p className="alert alert-error">{error}</p>
        ) : (
          <>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video id="lector-video" playsInline muted
              style={{ width: '100%', borderRadius: 12, background: '#000', aspectRatio: '1 / 1', objectFit: 'cover' }} />
            <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>Apunta al código de la pantalla.</p>
          </>
        )}
        <button className="btn btn-outline btn-full" style={{ marginTop: 16 }} onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}
