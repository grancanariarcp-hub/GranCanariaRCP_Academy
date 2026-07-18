'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { AppVersion } from '@/components/AppVersion';

function ctaCard(background: string): React.CSSProperties {
  return {
    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
    minHeight: 104, textAlign: 'center', textDecoration: 'none', color: '#fff',
    borderRadius: 14, padding: 20, background, boxShadow: 'var(--shadow-md)',
  };
}

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
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ color: 'var(--primary-dark)', fontSize: 30 }}>🏆 ¿Qué tanto sabes de RCP?</h1>
          <p className="muted" style={{ maxWidth: 560, margin: '6px auto 0' }}>Desafíos activos y reto permanente. Demuestra cuánto sabes y sube en el ranking.</p>

          {!user ? (
            <div className="grid grid-3" style={{ maxWidth: 820, margin: '20px auto 0', gap: 14 }}>
              <Link href="/registro" className="press cta-blink animate-in" style={ctaCard('linear-gradient(135deg,#c41e3a,#f59e0b)')}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>Regístrate y participa</div>
                <div style={{ fontSize: 13, opacity: 0.95, marginTop: 4 }}>Representa a tu institución</div>
              </Link>
              <Link href="/login/menor" className="press animate-in" style={ctaCard('linear-gradient(135deg,#f59e0b 0%,#ef4444 30%,#ec4899 55%,#8b5cf6 78%,#10b981 100%)')}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>Alumno menor de 18</div>
                <div style={{ fontSize: 13, opacity: 0.95, marginTop: 4 }}>Entra con el código de tu clase</div>
              </Link>
              <Link href="/rankings" className="press animate-in" style={ctaCard('linear-gradient(135deg,var(--primary-dark),var(--secondary-dark))')}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>Rankings</div>
                <div style={{ fontSize: 13, opacity: 0.95, marginTop: 4 }}>Personas e instituciones</div>
              </Link>
            </div>
          ) : (
            <p style={{ marginTop: 14 }}><Link href="/rankings" className="btn btn-outline">Ver rankings (personas e instituciones)</Link></p>
          )}
        </div>

        {challenges.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center' }}>Pronto habrá desafíos disponibles.</p>
        ) : (
          <div className="grid grid-2">
            {challenges.map((c, i) => (
              <Link key={c.id} href={`/desafios/${c.id}`} className="card press animate-in" style={{ display: 'flex', flexDirection: 'column', minHeight: 168, textDecoration: 'none', borderTop: `4px solid ${c.kind === 'permanente' ? '#c41e3a' : '#f59e0b'}`, animationDelay: `${Math.min(i, 8) * 60}ms` }}>
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
                <div className="btn btn-primary btn-small" style={{ marginTop: 'auto' }}>Ver ranking / participar</div>
              </Link>
            ))}
          </div>
        )}
        <p style={{ textAlign: 'center', marginTop: 32 }}><AppVersion /></p>
      </div>
    </div>
  );
}
