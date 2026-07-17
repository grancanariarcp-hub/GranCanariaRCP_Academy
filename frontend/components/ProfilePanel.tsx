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

  // CV (staff)
  type CvCat = 'formacion' | 'investigacion' | 'publicaciones' | 'reconocimientos' | 'experiencia';
  const [cv, setCv] = useState<Record<CvCat, Array<{ id: string; text: string }>> | null>(null);
  const [cvCat, setCvCat] = useState<CvCat>('formacion');
  const [cvText, setCvText] = useState('');

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
  async function loadCv() {
    try {
      const r = await api<{ cv: Record<CvCat, Array<{ id: string; text: string }>> }>('/api/profile/cv', { auth: true });
      setCv(r.cv);
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    load();
    if (isStaff) loadCv();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addCv() {
    if (!cvText.trim()) return;
    await api('/api/profile/cv', { method: 'POST', auth: true, body: JSON.stringify({ category: cvCat, text: cvText }) });
    setCvText('');
    loadCv();
  }
  async function delCv(id: string) {
    await api(`/api/profile/cv/${id}`, { method: 'DELETE', auth: true });
    loadCv();
  }

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

      {/* CV (solo profesores) */}
      {isStaff && cv && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header">
            <div className="card-title">Mi CV</div>
            <div className="card-subtitle">Esquemático, visible para los alumnos</div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '0 0 180px' }}>
              <label className="form-label">Categoría</label>
              <select className="form-select" value={cvCat} onChange={(e) => setCvCat(e.target.value as CvCat)}>
                <option value="formacion">🎓 Formación</option>
                <option value="investigacion">🔬 Investigación</option>
                <option value="publicaciones">📄 Publicaciones</option>
                <option value="reconocimientos">🏅 Reconocimientos</option>
                <option value="experiencia">💼 Experiencia laboral</option>
              </select>
            </div>
            <input className="form-input" style={{ flex: 1, minWidth: 200 }} placeholder="Añade un ítem…" value={cvText} onChange={(e) => setCvText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addCv(); }} />
            <button className="btn btn-primary btn-small" onClick={addCv}>Añadir</button>
          </div>

          {(['formacion', 'investigacion', 'publicaciones', 'reconocimientos', 'experiencia'] as CvCat[]).map((cat) => (
            <div key={cat} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{CV_LABELS[cat]}</div>
              {cv[cat].length === 0 ? (
                <div className="muted" style={{ fontSize: 13 }}>—</div>
              ) : (
                cv[cat].map((it) => (
                  <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 0', fontSize: 14 }}>
                    <span>• {it.text}</span>
                    <button className="btn btn-outline btn-small" onClick={() => delCv(it.id)}>✕</button>
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

const CV_LABELS: Record<string, string> = {
  formacion: '🎓 Formación',
  investigacion: '🔬 Investigación',
  publicaciones: '📄 Publicaciones',
  reconocimientos: '🏅 Reconocimientos',
  experiencia: '💼 Experiencia laboral',
};
