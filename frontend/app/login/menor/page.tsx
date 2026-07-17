'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { saveSession, type SessionUser } from '@/lib/auth';
import { AppVersion } from '@/components/AppVersion';

export default function MinorLoginPage() {
  const router = useRouter();
  const [accessCode, setAccessCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [age, setAge] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api<{ token: string; user: SessionUser }>('/api/auth/student/login-code', {
        method: 'POST',
        body: JSON.stringify({
          accessCode,
          nickname: nickname || undefined,
          age: age ? Number(age) : undefined,
        }),
      });
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
        <div className="auth-logo">
          <img src="/logo-horizontal.png" alt="Gran Canaria RCP" />
          <h1>Alumno menor de 18</h1>
          <p>Entra con el código que te dio tu profesor</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label className="form-label">Código</label>
            <input className="form-input" placeholder="RCP-XXXX-XXXX" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Tu apodo (seudónimo)</label>
            <input className="form-input" placeholder="Ej.: ElRápido" value={nickname} onChange={(e) => setNickname(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Tu edad</label>
            <input className="form-input" type="number" min="3" max="17" value={age} onChange={(e) => setAge(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <div className="info-box" style={{ marginTop: 14, fontSize: 12 }}>
          🔒 No pedimos tu nombre ni tu email: solo un apodo y tu edad.
        </div>

        <p className="muted" style={{ textAlign: 'center', fontSize: 13, marginTop: 14 }}>
          <Link href="/login">Acceso con email</Link> · <Link href="/">Inicio</Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: 8 }}><AppVersion /></p>
      </div>
    </div>
  );
}
