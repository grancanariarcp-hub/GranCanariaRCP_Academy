'use client';

import { useEffect, useState } from 'react';
import { api, ApiError, downloadFile, uploadFile } from '@/lib/api';
import type { SessionUser } from '@/lib/auth';

interface Course {
  title: string;
  duration_hours: number | null;
  acreditacion: string | null;
  cfc: string | null;
  publico_objetivo: string[] | null;
}
interface Profile {
  name: string;
  email?: string | null;
  headline?: string | null;
  role: string;
  photo_url?: string | null;
  access_code?: string;
  age?: number | null;
}

export function ProfilePanel({ user }: { user: SessionUser }) {
  const isStaff = user.role !== 'student';
  const [profile, setProfile] = useState<Profile | null>(null);
  const [taught, setTaught] = useState<Course[]>([]);
  const [received, setReceived] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);

  // change password
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [downloading, setDownloading] = useState(false);

  async function load() {
    try {
      const r = await api<{ profile: Profile; taught: Course[]; received: Course[] }>('/api/profile', { auth: true });
      setProfile(r.profile);
      setTaught(r.taught);
      setReceived(r.received);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error cargando el perfil');
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    try {
      await api('/api/profile/password', { method: 'POST', auth: true, body: JSON.stringify({ currentPassword: cur, newPassword: nw }) });
      setPwMsg({ ok: true, text: 'Contraseña actualizada ✅' });
      setCur(''); setNw('');
    } catch (err) {
      setPwMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Error' });
    }
  }

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    try {
      await uploadFile('/api/profile/photo', file);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al subir la foto');
    }
  }

  async function legajo() {
    setDownloading(true);
    try {
      await downloadFile('/api/profile/legajo', 'legajo-grancanaria-rcp.pdf');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al generar el legajo');
    } finally {
      setDownloading(false);
    }
  }

  const courses = isStaff ? taught : received;

  return (
    <>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="grid grid-2">
        {/* Datos + foto + legajo */}
        <div className="card">
          <div className="card-header"><div className="card-title">Mis datos</div></div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--gray-200)', overflow: 'hidden', flexShrink: 0 }}>
              {profile?.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 28 }}>👤</div>
              )}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{profile?.name}</div>
              {profile?.headline && <div className="muted" style={{ fontSize: 13 }}>{profile.headline}</div>}
              {profile?.email && <div className="muted" style={{ fontSize: 13 }}>{profile.email}</div>}
              {isStaff && (
                <label className="btn btn-outline btn-small" style={{ cursor: 'pointer', marginTop: 8 }}>
                  Cambiar foto
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { uploadPhoto(e.target.files?.[0]); e.target.value = ''; }} />
                </label>
              )}
            </div>
          </div>

          <button className="btn btn-primary btn-full" onClick={legajo} disabled={downloading}>
            {downloading ? 'Generando…' : '📄 Generar legajo (PDF)'}
          </button>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Se genera al momento y se descarga; no se guarda en el sistema.
          </p>
        </div>

        {/* Cambiar contraseña */}
        <div className="card">
          <div className="card-header"><div className="card-title">Cambiar contraseña</div></div>
          {pwMsg && <div className={`alert ${pwMsg.ok ? 'alert-success' : 'alert-error'}`}>{pwMsg.text}</div>}
          <form onSubmit={changePw}>
            <div className="form-group">
              <label className="form-label">Contraseña actual</label>
              <input className="form-input" type="password" value={cur} onChange={(e) => setCur(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Nueva contraseña (mín. 8)</label>
              <input className="form-input" type="password" value={nw} onChange={(e) => setNw(e.target.value)} required />
            </div>
            <button className="btn btn-primary btn-full">Actualizar contraseña</button>
          </form>
        </div>
      </div>

      {/* Cursos */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <div className="card-title">{isStaff ? 'Cursos impartidos' : 'Mis cursos'}</div>
          <div className="card-subtitle">{courses.length} cursos</div>
        </div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr><th>Curso</th><th>Horas</th><th>Acreditación</th><th>CFC</th><th>Público</th></tr>
            </thead>
            <tbody>
              {courses.map((c, i) => (
                <tr key={i}>
                  <td>{c.title}</td>
                  <td>{c.duration_hours ?? '—'}</td>
                  <td>{c.acreditacion ?? '—'}</td>
                  <td>{c.cfc ?? '—'}</td>
                  <td style={{ fontSize: 12 }}>{c.publico_objetivo?.join(', ') || '—'}</td>
                </tr>
              ))}
              {courses.length === 0 && <tr><td colSpan={5} className="muted">Sin cursos todavía</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
