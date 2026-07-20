'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { AppVersion } from '@/components/AppVersion';
import { PageNav } from '@/components/PageNav';
import { StickyCampusBar } from '@/components/StickyCampusBar';
import { Contacto } from '@/components/Contacto';

interface Inst { id: string; name: string; participants: string; attempts: string; total_correct: string; accuracy_pct: string | null; position: string }
interface Person { name: string; institution: string | null; challenges: string; points: string; accuracy_pct: string | null; position: string }

const medal = (p: number) => (p === 1 ? '🥇' : p === 2 ? '🥈' : p === 3 ? '🥉' : `${p}`);

export default function RankingsPage() {
  const [tab, setTab] = useState<'personas' | 'instituciones'>('personas');
  const [insts, setInsts] = useState<Inst[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loaded, setLoaded] = useState(false);
  const user = typeof window !== 'undefined' ? getUser() : null;

  useEffect(() => {
    Promise.all([
      api<{ ranking: Inst[] }>('/api/public/rankings/institutions').then((r) => setInsts(r.ranking)).catch(() => {}),
      api<{ ranking: Person[] }>('/api/public/rankings/individuals').then((r) => setPeople(r.ranking)).catch(() => {}),
    ]).finally(() => setLoaded(true));
  }, []);

  return (
    <div style={{ minHeight: '100vh', padding: '32px 16px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <PageNav backHref="/desafios" backLabel="Desafíos" />
        <h1 style={{ textAlign: 'center', color: 'var(--primary-dark)', marginBottom: 6 }}>Rankings</h1>
        <p className="muted" style={{ textAlign: 'center', marginBottom: 18 }}>Los mejores en los desafíos de RCP y primeros auxilios</p>

        {!user && (
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <Link href="/registro" className="btn cta-blink" style={{ background: 'linear-gradient(135deg,#c41e3a,#f59e0b)', color: '#fff', fontWeight: 700, padding: '12px 22px' }}>
              Regístrate, participa y representa a tu institución
            </Link>
          </div>
        )}

        <div className="tabs" style={{ maxWidth: 380, margin: '0 auto 16px' }}>
          <button className={`tab ${tab === 'personas' ? 'active' : ''}`} onClick={() => setTab('personas')}>👤 Personas</button>
          <button className={`tab ${tab === 'instituciones' ? 'active' : ''}`} onClick={() => setTab('instituciones')}>🏫 Instituciones</button>
        </div>

        <div className="card animate-in">
          {!loaded ? (
            <div className="muted">Cargando…</div>
          ) : tab === 'personas' ? (
            people.length === 0 ? (
              <p className="muted" style={{ textAlign: 'center' }}>Aún no hay participaciones. ¡Sé el primero!</p>
            ) : (
              <div className="table-responsive">
                <table>
                  <thead><tr><th>#</th><th>Persona</th><th>Desafíos</th><th>Puntos</th></tr></thead>
                  <tbody>
                    {people.map((r, i) => {
                      const pos = Number(r.position);
                      return (
                        <tr key={i} style={pos <= 3 ? { background: 'rgba(26,54,93,0.05)' } : undefined}>
                          <td style={{ fontSize: pos <= 3 ? 20 : 14, fontWeight: 700 }}>{medal(pos)}</td>
                          <td><strong>{r.name}</strong>{r.institution && <div className="muted" style={{ fontSize: 12 }}>{r.institution}</div>}</td>
                          <td>{r.challenges}</td>
                          <td><span className="badge badge-primary">{r.points}</span> <span className="muted" style={{ fontSize: 12 }}>({r.accuracy_pct ?? '—'}%)</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : insts.length === 0 ? (
            <p className="muted" style={{ textAlign: 'center' }}>Aún no hay datos de instituciones.</p>
          ) : (
            <div className="table-responsive">
              <table>
                <thead><tr><th>#</th><th>Institución</th><th>Participantes</th><th>Precisión</th></tr></thead>
                <tbody>
                  {insts.map((r) => {
                    const pos = Number(r.position);
                    return (
                      <tr key={r.id} style={pos <= 3 ? { background: 'rgba(26,54,93,0.05)' } : undefined}>
                        <td style={{ fontSize: pos <= 3 ? 20 : 14, fontWeight: 700 }}>{medal(pos)}</td>
                        <td><strong>{r.name}</strong><div className="muted" style={{ fontSize: 12 }}>{r.total_correct} aciertos · {r.attempts} intentos</div></td>
                        <td>{r.participants}</td>
                        <td><span className="badge badge-primary">{r.accuracy_pct ?? '—'}%</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div style={{ marginTop: 26 }}><Contacto /></div>
        <p style={{ textAlign: 'center', marginTop: 24 }}><AppVersion /></p>
      </div>
      <StickyCampusBar />
    </div>
  );
}
