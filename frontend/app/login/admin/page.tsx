'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { saveSession, type SessionUser } from '@/lib/auth';
import { AppVersion } from '@/components/AppVersion';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('grancanariarcp@gmail.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api<{ token: string; user: SessionUser }>('/api/auth/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      saveSession(res.token, res.user);
      router.push(res.user.role === 'profesor' ? '/admin/cursos' : '/admin');
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
          <h1>Panel de administración</h1>
          <p>Super Admin / Administrador de institución</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Accediendo…' : 'Entrar'}
          </button>
        </form>

        <p className="muted" style={{ textAlign: 'center', fontSize: 13, marginTop: 18 }}>
          <Link href="/login/student">Acceso alumnos</Link> · <Link href="/">Inicio</Link>
        </p>
        <p className="muted" style={{ textAlign: 'center', fontSize: 13, marginTop: 4 }}>
          ¿Eres profesor? <Link href="/registro-profesor">Regístrate aquí</Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: 8 }}>
          <AppVersion />
        </p>
      </div>
    </div>
  );
}
