'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { AppVersion } from '@/components/AppVersion';
import { PageNav } from '@/components/PageNav';
import { StickyCampusBar } from '@/components/StickyCampusBar';
import { Contacto } from '@/components/Contacto';

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
  audience?: string;
  seconds_per_question?: number;
  thumbnail_url?: string;
}

const PUBLICOS: Array<{ key: string; label: string; desc: string; color: string }> = [
  { key: 'ninos', label: 'Niños', desc: '6 a 12 años', color: '#ec4899' },
  { key: 'jovenes', label: 'Jóvenes', desc: '13 a 17 años', color: '#8b5cf6' },
  { key: 'adultos', label: 'Adultos', desc: '18 años en adelante', color: '#2c5282' },
  { key: 'todos', label: 'Para todos', desc: 'Cualquier edad', color: '#0d9488' },
];

export default function DesafiosPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const user = typeof window !== 'undefined' ? getUser() : null;

  useEffect(() => {
    api<{ challenges: Challenge[] }>('/api/public/challenges').then((r) => setChallenges(r.challenges)).catch(() => {});
  }, []);

  return (
    <div style={{ minHeight: '100vh', padding: '32px 16px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <PageNav />
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
          PUBLICOS.map((p) => {
            const delGrupo = challenges.filter((c) => (c.audience ?? 'todos') === p.key);
            if (delGrupo.length === 0) return null;
            return (
              <div key={p.key} style={{ marginBottom: 26 }}>
                <h2 style={{ fontSize: 18, marginBottom: 4, color: p.color }}>{p.label}</h2>
                <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{p.desc}</p>
                <div className="grid grid-2">
                  {delGrupo.map((c, i) => (
              <Link key={c.id} href={`/desafios/${c.id}`} className="card press animate-in" style={{ display: 'flex', flexDirection: 'column', minHeight: 168, textDecoration: 'none', padding: c.thumbnail_url ? 0 : undefined, overflow: 'hidden', borderTop: `4px solid ${c.kind === 'permanente' ? '#c41e3a' : '#f59e0b'}`, animationDelay: `${Math.min(i, 8) * 60}ms` }}>
                {c.thumbnail_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.thumbnail_url} alt="" style={{ width: '100%', height: 92, objectFit: 'cover' }} />
                )}
                <div style={{ padding: c.thumbnail_url ? '12px 14px 0' : undefined, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="card-title">{c.title}</div>
                  {c.kind === 'permanente'
                    ? <span className="badge badge-primary">Permanente</span>
                    : <span className="badge badge-warning">Temporal</span>}
                </div>
                <div className="muted" style={{ fontSize: 13, margin: '8px 0', paddingInline: c.thumbnail_url ? 14 : undefined }}>
                  {c.area} · {c.num_questions} preguntas · {c.seconds_per_question ? `${c.seconds_per_question}s por pregunta` : `${Math.round(c.time_limit_seconds / 60)} min`}
                </div>
                <div style={{ fontSize: 13, paddingInline: c.thumbnail_url ? 14 : undefined }}>👥 {c.participants} participantes</div>
                {c.ends_at && <div className="muted" style={{ fontSize: 12 }}>Termina: {new Date(c.ends_at).toLocaleDateString('es-ES')}</div>}
                <div className="btn btn-primary btn-small" style={{ marginTop: 'auto', marginInline: c.thumbnail_url ? 14 : undefined, marginBottom: c.thumbnail_url ? 14 : undefined }}>Ver ranking / participar</div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })
        )}
        <div style={{ marginTop: 26 }}><Contacto /></div>
        <p style={{ textAlign: 'center', marginTop: 32 }}><AppVersion /></p>
      </div>

      {/* La formación oficial acompaña al usuario mientras explora los desafíos */}
      <StickyCampusBar />
    </div>
  );
}
