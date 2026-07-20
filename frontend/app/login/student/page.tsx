'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { saveSession, type SessionUser } from '@/lib/auth';
import { AppVersion } from '@/components/AppVersion';
import { PageNav } from '@/components/PageNav';
import { AvisoSesionCaducada } from '@/components/AvisoSesionCaducada';

type Method = 'code' | 'email' | 'register';

export default function StudentLoginPage() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>('code');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Shared form fields
  const [accessCode, setAccessCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [institutionCode, setInstitutionCode] = useState('');

  function finish(res: { token: string; user: SessionUser }) {
    saveSession(res.token, res.user);
    router.push('/student');
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      if (method === 'code') {
        const res = await api<{ token: string; user: SessionUser }>('/api/auth/student/login-code', {
          method: 'POST',
          body: JSON.stringify({ accessCode }),
        });
        finish(res);
      } else if (method === 'email') {
        const res = await api<{ token: string; user: SessionUser }>('/api/auth/student/login-email', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        finish(res);
      } else {
        const res = await api<{ token: string; user: SessionUser; accessCode: string }>(
          '/api/auth/student/register',
          {
            method: 'POST',
            body: JSON.stringify({ displayName, email, password, institutionCode }),
          },
        );
        finish(res);
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
        <PageNav />
        <div className="auth-logo">
          <img src="/logo-horizontal.png" alt="Gran Canaria RCP" />
          <h1>Acceso alumnos</h1>
          <p>Elige tu método de acceso</p>
        </div>

        <div className="tabs">
          <button className={`tab ${method === 'code' ? 'active' : ''}`} onClick={() => setMethod('code')} type="button">
            Código
          </button>
          <button className={`tab ${method === 'email' ? 'active' : ''}`} onClick={() => setMethod('email')} type="button">
            Email
          </button>
          <button className={`tab ${method === 'register' ? 'active' : ''}`} onClick={() => setMethod('register')} type="button">
            Registro
          </button>
        </div>

        <AvisoSesionCaducada />
        {error && <div className="alert alert-error">{error}</div>}
        {notice && <div className="alert alert-success">{notice}</div>}

        <form onSubmit={onSubmit}>
          {method === 'code' && (
            <div className="form-group">
              <label className="form-label">Código de acceso</label>
              <input
                className="form-input"
                placeholder="RCP-XXXX-XXXX"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                required
              />
              <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                Prueba con <strong>RCP-DEMO-2026</strong>
              </p>
            </div>
          )}

          {method === 'email' && (
            <>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Contraseña</label>
                <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </>
          )}

          {method === 'register' && (
            <>
              <div className="form-group">
                <label className="form-label">Nombre a mostrar</label>
                <input className="form-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Código de institución</label>
                <input className="form-input" placeholder="IES-GC-01" value={institutionCode} onChange={(e) => setInstitutionCode(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Contraseña (mín. 8)</label>
                <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </>
          )}

          <button className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Procesando…' : method === 'register' ? 'Crear cuenta' : 'Entrar'}
          </button>
        </form>

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
