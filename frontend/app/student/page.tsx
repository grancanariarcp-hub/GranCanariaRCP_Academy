'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { api, ApiError } from '@/lib/api';
import { temaPalette } from '@/lib/temaColors';
import { WhatsAppPrompt } from '@/components/WhatsAppPrompt';

interface MyCourse {
  id: string;
  title: string;
  tema: string | null;
  subtema: string | null;
  modality: string;
  status: string;
}
interface AvailableCourse {
  id: string;
  title: string;
  tema: string | null;
  subtema: string | null;
  modality: string;
  duration_hours: number | null;
  price_cents: number;
}

export default function StudentDashboard() {
  const user = useSession(['student'], '/login/student');
  const [mine, setMine] = useState<MyCourse[]>([]);
  const [available, setAvailable] = useState<AvailableCourse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    try {
      const [m, a] = await Promise.all([
        api<{ courses: MyCourse[] }>('/api/student/courses', { auth: true }),
        api<{ courses: AvailableCourse[] }>('/api/student/available-courses', { auth: true }),
      ]);
      setMine(m.courses);
      setAvailable(a.courses);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error cargando cursos');
    }
  }
  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function enroll(courseId: string) {
    setMsg(null);
    try {
      await api(`/api/student/enroll/${courseId}`, { method: 'POST', auth: true });
      setMsg('¡Matrícula realizada! Ya lo tienes en "Mis cursos" ✅');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al matricular');
    }
  }

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  return (
    <AppShell user={user} title="Campus" nav={[{ label: 'Inicio', href: '/student', active: true }, { label: 'Práctica', href: '/practica' }, { label: 'Desafíos', href: '/desafios' }, { label: 'Perfil', href: '/student/perfil' }]}>
      <WhatsAppPrompt />
      {error && <div className="alert alert-error">{error}</div>}
      {msg && <div className="alert alert-success">{msg}</div>}

      {/* Mis cursos */}
      <div className="card animate-in" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">Mis cursos</div>
          <div className="card-subtitle">Cursos en los que estás matriculado</div>
        </div>
        {mine.length === 0 ? (
          <div className="muted">Aún no estás matriculado en ningún curso. ¡Explora los disponibles abajo!</div>
        ) : (
          <div className="grid grid-2">
            {mine.map((c, i) => (
              <div key={c.id} className="press animate-in" style={{ border: '1px solid var(--gray-200)', borderLeft: `4px solid ${temaPalette(c.tema).main}`, borderRadius: 8, padding: 16, animationDelay: `${Math.min(i, 8) * 50}ms` }}>
                <div style={{ fontWeight: 600 }}>{c.title}</div>
                <div className="muted" style={{ fontSize: 13, margin: '4px 0 10px' }}>
                  {[c.tema, c.subtema, c.modality].filter(Boolean).join(' · ')} ·{' '}
                  <span className={`badge ${c.status === 'completado' ? 'badge-success' : c.status === 'pendiente_pago' ? 'badge-warning' : 'badge-primary'}`}>{c.status}</span>
                </div>
                <Link className="btn btn-primary btn-small" href={`/student/curso/${c.id}`}>Entrar al curso</Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cursos disponibles */}
      <div className="card animate-in">
        <div className="card-header">
          <div className="card-title">Cursos disponibles</div>
          <div className="card-subtitle">Con matrícula abierta</div>
        </div>
        {available.length === 0 ? (
          <div className="muted">No hay cursos con matrícula abierta ahora mismo.</div>
        ) : (
          <div className="grid grid-2">
            {available.map((c, i) => (
              <div key={c.id} className="press animate-in" style={{ border: '1px solid var(--gray-200)', borderLeft: `4px solid ${temaPalette(c.tema).main}`, borderRadius: 8, padding: 16, animationDelay: `${Math.min(i, 8) * 50}ms` }}>
                <div style={{ fontWeight: 600 }}>{c.title}</div>
                <div className="muted" style={{ fontSize: 13, margin: '4px 0 10px' }}>
                  {[c.tema, c.subtema, c.modality].filter(Boolean).join(' · ')}
                  {c.duration_hours ? ` · ${c.duration_hours} h` : ''}
                  {' · '}
                  {c.price_cents > 0 ? <strong>{(c.price_cents / 100).toFixed(2)} €</strong> : <span className="badge badge-success">Gratis</span>}
                </div>
                <button className="btn btn-primary btn-small" onClick={() => enroll(c.id)}>
                  {c.price_cents > 0 ? 'Matricularme (pago)' : 'Matricularme gratis'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
