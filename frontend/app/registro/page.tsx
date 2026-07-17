'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { saveSession, type SessionUser } from '@/lib/auth';
import { AppVersion } from '@/components/AppVersion';

export default function RegistroPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api<{ token: string; user: SessionUser }>('/api/auth/student/register-public', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
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
          <h1>Crear cuenta</h1>
          <p>Regístrate para matricularte en los cursos</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label className="form-label">Nombre y apellidos</label>
            <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Contraseña (mín. 8)</label>
            <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Creando…' : 'Crear cuenta'}
          </button>
        </form>

        <p className="muted" style={{ textAlign: 'center', fontSize: 13, marginTop: 18 }}>
          ¿Ya tienes cuenta? <Link href="/login">Acceso</Link> · <Link href="/registro-profesor">Soy profesor</Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: 8 }}><AppVersion /></p>
      </div>
    </div>
  );
}
