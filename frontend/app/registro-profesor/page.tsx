'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { AppVersion } from '@/components/AppVersion';
import { PageNav } from '@/components/PageNav';

export default function RegistroProfesorPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [headline, setHeadline] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api('/api/auth/professor/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, headline: headline || undefined }),
      });
      setDone(true);
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
          <h1>Registro de profesor</h1>
          <p>Crea tu cuenta para impartir cursos</p>
        </div>

        {done ? (
          <div className="alert alert-success">
            ✅ <strong>Solicitud enviada.</strong> Un administrador validará tu cuenta.
            Cuando te aprueben, podrás entrar desde «Acceso administración».
          </div>
        ) : (
          <>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={onSubmit}>
              <div className="form-group">
                <label className="form-label">Nombre y apellidos</label>
                <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Titulación / especialidad (opcional)</label>
                <input className="form-input" placeholder="Ej.: Médico intensivista" value={headline} onChange={(e) => setHeadline(e.target.value)} />
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
                {loading ? 'Enviando…' : 'Solicitar cuenta de profesor'}
              </button>
            </form>
          </>
        )}

        <p className="muted" style={{ textAlign: 'center', fontSize: 13, marginTop: 18 }}>
          <Link href="/login/admin">Acceso administración</Link> · <Link href="/">Inicio</Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: 8 }}>
          <AppVersion />
        </p>
      </div>
    </div>
  );
}
