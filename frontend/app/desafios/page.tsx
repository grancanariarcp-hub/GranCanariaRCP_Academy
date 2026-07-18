'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
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

  useEffect(() => {
    api<{ challenges: Challenge[] }>('/api/public/challenges').then((r) => setChallenges(r.challenges)).catch(() => {});
  }, []);

  return (
    <div style={{ minHeight: '100vh', padding: '32px 16px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <p style={{ marginBottom: 16 }}><Link href="/">← Inicio</Link></p>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ color: 'var(--primary-dark)' }}>🏆 Desafíos y rankings</h1>
          <p className="muted">Demuestra cuánto sabes de RCP y primeros auxilios. ¡Sube en el ranking!</p>
          <p style={{ marginTop: 10 }}><Link href="/rankings" className="btn btn-outline btn-small">🏫 Ranking de instituciones</Link></p>
        </div>

        {challenges.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center' }}>Pronto habrá desafíos disponibles.</p>
        ) : (
          <div className="grid grid-2">
            {challenges.map((c) => (
              <Link key={c.id} href={`/desafios/${c.id}`} className="card" style={{ textDecoration: 'none' }}>
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
