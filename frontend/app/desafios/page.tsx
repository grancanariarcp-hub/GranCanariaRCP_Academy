'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { AppVersion } from '@/components/AppVersion';

interface Challenge {
  id: string;
  title: string;
  area: string;
  num_questions: number;
  time_limit_seconds: number;
  kind: 'permanente' | 'temporal';
  ends_at: string | null;
  participants: string;
}

export default function DesafiosPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const user = typeof window !== 'undefined' ? getUser() : null;

  useEffect(() => {
    api<{ challenges: Challenge[] }>('/api/public/challenges').then((r) => setChallenges(r.challenges)).catch(() => {});
  }, []);

  return (
    <div style={{ minHeight: '100vh', padding: '32px 16px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <p style={{ marginBottom: 16 }}><Link href="/">← Inicio</Link></p>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ color: 'var(--primary-dark)' }}>🏆 ¿Qué tanto sabes de RCP?</h1>
          <p className="muted">Desafíos activos y reto permanente. Demuestra cuánto sabes y sube en el ranking.</p>
          <p style={{ marginTop: 10 }}><Link href="/rankings" className="btn btn-outline btn-small">Ver rankings (personas e instituciones)</Link></p>
          {!user && (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 12 }}>
              <Link href="/registro" className="btn cta-blink" style={{ background: 'linear-gradient(135deg,#c41e3a,#f59e0b)', color: '#fff', fontWeight: 700, padding: '12px 22px' }}>
                Regístrate, participa y representa a tu institución
              </Link>
              <Link href="/login/menor" className="btn press" style={{ background: 'linear-gradient(135deg,#f59e0b 0%,#ef4444 30%,#ec4899 55%,#8b5cf6 78%,#10b981 100%)', color: '#fff', fontWeight: 700, padding: '12px 22px' }}>
                Alumno menor de 18
              </Link>
            </div>
          )}
        </div>

        {challenges.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center' }}>Pronto habrá desafíos disponibles.</p>
        ) : (
          <div className="grid grid-2">
            {challenges.map((c, i) => (
              <Link key={c.id} href={`/desafios/${c.id}`} className="card press animate-in" style={{ textDecoration: 'none', borderTop: `4px solid ${c.kind === 'permanente' ? '#c41e3a' : '#f59e0b'}`, animationDelay: `${Math.min(i, 8) * 60}ms` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="card-title">{c.title}</div>
                  {c.kind === 'permanente'
                    ? <span className="badge badge-primary">Permanente</span>
                    : <span className="badge badge-warning">Temporal</span>}
                </div>
                <div className="muted" style={{ fontSize: 13, margin: '8px 0' }}>
                  {c.area} · {c.num_questions} preguntas · {Math.round(c.time_limit_seconds / 60)} min
                </div>
                <div style={{ fontSize: 13 }}>👥 {c.participants} participantes</div>
                {c.ends_at && <div className="muted" style={{ fontSize: 12 }}>Termina: {new Date(c.ends_at).toLocaleDateString('es-ES')}</div>}
                <div className="btn btn-primary btn-small" style={{ marginTop: 10 }}>Ver ranking / participar</div>
              </Link>
            ))}
          </div>
        )}
        <p style={{ textAlign: 'center', marginTop: 32 }}><AppVersion /></p>
      </div>
    </div>
  );
}
