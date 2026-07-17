'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { saveSession, homeForRole, type SessionUser } from '@/lib/auth';
import { AppVersion } from '@/components/AppVersion';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api<{ token: string; user: SessionUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      saveSession(res.token, res.user);
      router.push(homeForRole(res.user.role));
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
          <h1>Acceso</h1>
          <p>Alumnos, profesores y administración</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
          </div>
          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          <button className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Accediendo…' : 'Entrar'}
          </button>
        </form>

        <p className="muted" style={{ textAlign: 'center', fontSize: 13, marginTop: 18 }}>
          <Link href="/registro">Registrarse</Link> · <Link href="/login/menor">Alumno menor de 18</Link> · <Link href="/">Inicio</Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: 8 }}><AppVersion /></p>
      </div>
    </div>
  );
}
