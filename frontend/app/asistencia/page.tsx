'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { PageNav } from '@/components/PageNav';

/**
 * Destino del QR de asistencia.
 *
 * Funciona tanto si el alumno pulsa el botón de su perfil como si escanea con
 * la cámara nativa del móvil, que es lo que hace la mayoría. Nunca registra
 * nada al abrirse: primero pregunta, tal y como se pidió.
 */

interface Previo {
  accion: 'entrada' | 'salida' | 'completa';
  bloqueo: string | null;
  sesion: { id: string; title: string; fecha: string };
}

function Confirmacion() {
  const params = useSearchParams();
  const payload = params.get('p') || '';

  const [previo, setPrevio] = useState<Previo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [hecho, setHecho] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [sesionIniciada, setSesionIniciada] = useState<boolean | null>(null);

  useEffect(() => { setSesionIniciada(getUser()?.role === 'student'); }, []);

  const consultar = useCallback(async () => {
    if (!payload) { setError('Falta el código del QR.'); setCargando(false); return; }
    try {
      setPrevio(await api<Previo>(`/api/student/attendance/scan?payload=${encodeURIComponent(payload)}`, { auth: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el código');
    } finally {
      setCargando(false);
    }
  }, [payload]);

  useEffect(() => { if (sesionIniciada) consultar(); else if (sesionIniciada === false) setCargando(false); }, [sesionIniciada, consultar]);

  async function confirmar() {
    setEnviando(true);
    setError('');
    try {
      const r = await api<{ accion: string; mensaje: string }>('/api/student/attendance/scan', {
        method: 'POST', auth: true, body: JSON.stringify({ payload }),
      });
      setHecho(r.mensaje);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar');
    } finally {
      setEnviando(false);
    }
  }

  if (sesionIniciada === false) {
    return (
      <Caja titulo="Identifícate para fichar">
        <p style={{ marginBottom: 16 }}>
          Para registrar tu asistencia necesitas entrar con tu cuenta de alumno. Después vuelve a escanear el QR.
        </p>
        <Link href="/login" className="btn btn-primary btn-full">Entrar con mi cuenta</Link>
      </Caja>
    );
  }

  if (cargando) return <Caja titulo="Leyendo el código…"><p className="muted">Un momento.</p></Caja>;

  if (hecho) {
    return (
      <Caja titulo="Listo" acento="var(--success)">
        <p style={{ fontSize: 17, marginBottom: 18 }}>✓ {hecho}</p>
        <Link href="/student" className="btn btn-primary btn-full">Volver a mis cursos</Link>
      </Caja>
    );
  }

  if (error && !previo) {
    return (
      <Caja titulo="No se ha podido registrar" acento="var(--danger)">
        <p style={{ marginBottom: 18 }}>{error}</p>
        <button className="btn btn-outline btn-full" onClick={() => { setError(''); setCargando(true); consultar(); }}>
          Reintentar
        </button>
      </Caja>
    );
  }

  if (previo?.accion === 'completa') {
    return (
      <Caja titulo="Ya está registrado">
        <p style={{ marginBottom: 18 }}>
          Ya tienes registradas la entrada y la salida de <strong>{previo.sesion.title}</strong>.
        </p>
        <Link href="/student" className="btn btn-outline btn-full">Volver a mis cursos</Link>
      </Caja>
    );
  }

  const esEntrada = previo?.accion === 'entrada';

  return (
    <Caja titulo={esEntrada ? 'Vas a registrar tu ENTRADA' : 'Vas a registrar tu SALIDA'}>
      <p className="muted" style={{ marginBottom: 4 }}>{previo?.sesion.title}</p>
      <p className="muted" style={{ fontSize: 13, marginBottom: 18 }}>
        {previo && new Date(previo.sesion.fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>

      {previo?.bloqueo && <p className="alert alert-error" style={{ marginBottom: 14 }}>{previo.bloqueo}</p>}
      {error && <p className="alert alert-error" style={{ marginBottom: 14 }}>{error}</p>}

      <p style={{ fontSize: 17, marginBottom: 20 }}>
        {esEntrada ? '¿Confirmas que registras tu entrada?' : '¿Confirmas que registras tu salida?'}
      </p>

      <div style={{ display: 'flex', gap: 10 }}>
        <Link href="/student" className="btn btn-outline" style={{ flex: 1 }}>Cancelar</Link>
        <button className="btn btn-primary press" style={{ flex: 1 }} disabled={enviando || !!previo?.bloqueo} onClick={confirmar}>
          {enviando ? 'Registrando…' : 'Confirmar'}
        </button>
      </div>
    </Caja>
  );
}

function Caja({ titulo, children, acento }: { titulo: string; children: React.ReactNode; acento?: string }) {
  return (
    <div style={{ minHeight: '100vh', padding: '32px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <PageNav backHref="/student" backLabel="Mis cursos" />
        <div className="card animate-pop" style={{ borderTop: `4px solid ${acento || 'var(--primary-dark)'}` }}>
          <h1 style={{ fontSize: 21, marginBottom: 12 }}>{titulo}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function AsistenciaPage() {
  return (
    <Suspense fallback={<Caja titulo="Cargando…"><p className="muted">Un momento.</p></Caja>}>
      <Confirmacion />
    </Suspense>
  );
}
