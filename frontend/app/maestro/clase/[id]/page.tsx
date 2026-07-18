'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { api, ApiError, apiBase } from '@/lib/api';

interface Clase { id: string; name: string }
interface Alumno { id: string; display_name: string; access_code: string; age: number | null; activo: boolean }

export default function ClaseDetallePage() {
  const classId = useParams().id as string;
  const user = useSession(['institution_teacher'], '/login');
  const [clase, setClase] = useState<Clase | null>(null);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [count, setCount] = useState('10');
  const [error, setError] = useState<string | null>(null);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  async function load() {
    try {
      const r = await api<{ class: Clase; students: Alumno[] }>(`/api/maestro/classes/${classId}`, { auth: true });
      setClase(r.class); setAlumnos(r.students);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Error'); }
  }
  useEffect(() => { if (user) load(); /* eslint-disable-next-line */ }, [user]);

  async function generate() {
    setError(null);
    try {
      await api(`/api/maestro/classes/${classId}/codes`, { method: 'POST', auth: true, body: JSON.stringify({ count: Number(count) }) });
      load();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Error'); }
  }
  async function delCode(id: string) {
    try { await api(`/api/maestro/classes/${classId}/codes/${id}`, { method: 'DELETE', auth: true }); load(); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Error'); }
  }

  const joinUrl = (code: string) => `${origin}/login/menor?code=${encodeURIComponent(code)}`;
  const qrSrc = (code: string) => `${apiBase}/api/public/qr?data=${encodeURIComponent(joinUrl(code))}`;

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  return (
    <AppShell user={user} title={clase?.name ?? 'Clase'} nav={[{ label: 'Mis clases', href: '/maestro', active: true }]}>
      <p style={{ marginBottom: 16 }}><Link href="/maestro">← Mis clases</Link></p>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card animate-in no-print" style={{ marginBottom: 20 }}>
        <div className="card-header"><div className="card-title">Generar códigos</div><div className="card-subtitle">Cada alumno recibe un código y su QR</div></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">¿Cuántos?</label>
            <input className="form-input" type="number" min="1" max="100" value={count} onChange={(e) => setCount(e.target.value)} style={{ width: 120 }} />
          </div>
          <button className="btn btn-primary" onClick={generate}>Generar</button>
          {alumnos.length > 0 && <button className="btn btn-outline" onClick={() => window.print()}>🖨️ Imprimir hoja</button>}
        </div>
        <div className="info-box" style={{ marginTop: 12, fontSize: 13 }}>
          El alumno <strong>escanea el QR</strong> o <strong>escribe el código</strong> en «Alumno menor de 18», y elige su seudónimo y edad. Con eso participa en los desafíos representando a la institución.
        </div>
      </div>

      {alumnos.length === 0 ? (
        <div className="card">Aún no hay códigos. Genera los que necesites.</div>
      ) : (
        <div className="grid grid-3" style={{ gap: 14 }}>
          {alumnos.map((a) => (
            <div key={a.id} className="card print-card" style={{ textAlign: 'center', padding: 14 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc(a.access_code)} alt="" style={{ width: 150, height: 150 }} />
              <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 16, marginTop: 6, letterSpacing: 1 }}>{a.access_code}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                {a.activo ? `${a.display_name}${a.age ? ` · ${a.age} años` : ''}` : 'Sin asignar'}
              </div>
              {!a.activo && <button className="btn btn-outline btn-small no-print" style={{ marginTop: 8 }} onClick={() => delCode(a.id)}>Borrar</button>}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
