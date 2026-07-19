'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { saveSession, type SessionUser } from '@/lib/auth';
import { AppVersion } from '@/components/AppVersion';
import { PageNav } from '@/components/PageNav';

export default function MinorLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'codigo' | 'apodo'>('codigo');
  const [accessCode, setAccessCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [age, setAge] = useState('');
  const [institutions, setInstitutions] = useState<Array<{ id: string; name: string }>>([]);
  const [institutionId, setInstitutionId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (code) setAccessCode(code.toUpperCase());
    api<{ institutions: Array<{ id: string; name: string }> }>('/api/public/institutions')
      .then((r) => setInstitutions(r.institutions)).catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body = mode === 'codigo'
        ? { path: '/api/auth/student/login-code', data: { accessCode, nickname: nickname || undefined, age: age ? Number(age) : undefined } }
        : { path: '/api/auth/student/login-institution', data: { institutionId, nickname, age: Number(age) } };
      const res = await api<{ token: string; user: SessionUser }>(body.path, { method: 'POST', body: JSON.stringify(body.data) });
      saveSession(res.token, res.user);
      router.push('/student');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <PageNav />
        <div className="auth-logo">
          <img src="/logo-horizontal.png" alt="Gran Canaria RCP" />
          <h1>Alumno menor de 18</h1>
          <p>Entra para participar en los desafíos</p>
        </div>

        <div className="tabs">
          <button type="button" className={`tab ${mode === 'codigo' ? 'active' : ''}`} onClick={() => { setMode('codigo'); setError(null); }}>Con mi código</button>
          <button type="button" className={`tab ${mode === 'apodo' ? 'active' : ''}`} onClick={() => { setMode('apodo'); setError(null); }}>Ya me registré</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={onSubmit}>
          {mode === 'codigo' ? (
            <div className="form-group">
              <label className="form-label">Código</label>
              <input className="form-input" placeholder="RCP-XXXX-XXXX" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} required />
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Tu institución</label>
              <select className="form-select" value={institutionId} onChange={(e) => setInstitutionId(e.target.value)} required>
                <option value="">Elige tu institución…</option>
                {institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Tu apodo (seudónimo)</label>
            <input className="form-input" placeholder="Ej.: ElRápido" value={nickname} onChange={(e) => setNickname(e.target.value)} required={mode === 'apodo'} />
          </div>
          <div className="form-group">
            <label className="form-label">Tu edad</label>
            <input className="form-input" type="number" min="3" max="17" value={age} onChange={(e) => setAge(e.target.value)} required={mode === 'apodo'} />
          </div>
          <button className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <div className="info-box" style={{ marginTop: 14, fontSize: 12 }}>
          🔒 No pedimos tu nombre ni tu email: solo un apodo y tu edad.
          {mode === 'apodo' && ' Si no te encuentra, entra con tu código.'}
        </div>

        <p className="muted" style={{ textAlign: 'center', fontSize: 13, marginTop: 14 }}>
          <Link href="/login">Acceso con email</Link> · <Link href="/">Inicio</Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: 8 }}><AppVersion /></p>
      </div>
    </div>
  );
}
