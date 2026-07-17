'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { saveSession, type SessionUser } from '@/lib/auth';
import { AppVersion } from '@/components/AppVersion';

type Role = 'alumno' | 'profesor';

export default function RegistroPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>('alumno');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [headline, setHeadline] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);
    setLoading(true);
    try {
      if (role === 'profesor') {
        await api('/api/auth/professor/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password, headline: headline || undefined }),
        });
        setDone('✅ Solicitud enviada. Un administrador validará tu cuenta de profesor. Después podrás acceder.');
      } else {
        const res = await api<{ token: string; user: SessionUser }>('/api/auth/student/register-public', {
          method: 'POST',
          body: JSON.stringify({ name, email, password }),
        });
        saveSession(res.token, res.user);
        router.push('/student');
      }
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
          <p>Regístrate como alumno o como profesor</p>
        </div>

        <div className="tabs">
          <button type="button" className={`tab ${role === 'alumno' ? 'active' : ''}`} onClick={() => setRole('alumno')}>🎒 Alumno</button>
          <button type="button" className={`tab ${role === 'profesor' ? 'active' : ''}`} onClick={() => setRole('profesor')}>🧑‍🏫 Profesor</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {done ? (
          <div className="alert alert-success">{done}</div>
        ) : (
          <form onSubmit={onSubmit}>
            <div className="form-group">
              <label className="form-label">Nombre y apellidos</label>
              <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            {role === 'profesor' && (
              <div className="form-group">
                <label className="form-label">Titulación / especialidad (opcional)</label>
                <input className="form-input" placeholder="Ej.: Médico intensivista" value={headline} onChange={(e) => setHeadline(e.target.value)} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Contraseña (mín. 8)</label>
              <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {role === 'profesor' && (
              <div className="info-box" style={{ fontSize: 12, marginBottom: 12 }}>
                Las cuentas de profesor las valida un administrador antes de poder entrar.
              </div>
            )}
            <button className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Enviando…' : role === 'profesor' ? 'Solicitar cuenta de profesor' : 'Crear cuenta'}
            </button>
          </form>
        )}

        <p className="muted" style={{ textAlign: 'center', fontSize: 13, marginTop: 18 }}>
          ¿Ya tienes cuenta? <Link href="/login">Acceso</Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: 8 }}><AppVersion /></p>
      </div>
    </div>
  );
}
