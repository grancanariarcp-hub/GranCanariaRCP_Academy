'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { api, ApiError } from '@/lib/api';

interface Dashboard {
  profile: {
    display_name: string;
    is_minor: boolean;
    access_code: string;
    institution_name: string;
  } | null;
  progress: { answered: number; correct: number; scorePct: number | null };
  byCategory: Array<{ category: string; answered: string; correct: string }>;
}

export default function StudentDashboard() {
  const user = useSession(['student'], '/login/student');
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api<Dashboard>('/api/student/dashboard', { auth: true })
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error cargando datos'));
  }, [user]);

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  return (
    <AppShell
      user={user}
      title="Mi progreso"
      nav={[
        { label: 'Inicio', href: '/student', active: true },
        { label: 'Tests', href: '/student' },
        { label: 'Cursos', href: '/student' },
      ]}
    >
      {error && <div className="alert alert-error">{error}</div>}

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-value">{data?.progress.answered ?? '—'}</div>
          <div className="stat-label">Preguntas respondidas</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data?.progress.correct ?? '—'}</div>
          <div className="stat-label">Aciertos</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {data?.progress.scorePct != null ? `${data.progress.scorePct}%` : '—'}
          </div>
          <div className="stat-label">Puntuación</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data?.byCategory.length ?? 0}</div>
          <div className="stat-label">Categorías iniciadas</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">¡Hola, {user.name}!</div>
            <div className="card-subtitle">{data?.profile?.institution_name ?? ''}</div>
          </div>
          <div className="info-box" style={{ marginBottom: 16 }}>
            Bienvenido a tu área de formación en RCP. Aquí verás tu progreso por
            niveles (SVB, SVI, SVA) a medida que completes tests.
          </div>
          {data?.profile && (
            <p className="muted" style={{ fontSize: 13 }}>
              Tu código de acceso: <strong>{data.profile.access_code}</strong>
              {data.profile.is_minor && <> · <span className="badge badge-warning">Menor</span></>}
            </p>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Progreso por categoría</div>
          </div>
          <div className="table-responsive">
            <table>
              <thead>
                <tr><th>Nivel</th><th>Respondidas</th><th>Aciertos</th></tr>
              </thead>
              <tbody>
                {(data?.byCategory ?? []).map((c) => (
                  <tr key={c.category}>
                    <td><span className="badge badge-primary">{c.category}</span></td>
                    <td>{c.answered}</td>
                    <td>{c.correct}</td>
                  </tr>
                ))}
                {(!data || data.byCategory.length === 0) && (
                  <tr><td colSpan={3} className="muted">Aún no has realizado tests</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
