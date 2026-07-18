'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { AppVersion } from '@/components/AppVersion';

interface Row {
  id: string;
  name: string;
  participants: string;
  attempts: string;
  total_correct: string;
  accuracy_pct: string | null;
  position: string;
}

export default function RankingsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api<{ ranking: Row[] }>('/api/public/rankings/institutions')
      .then((r) => setRows(r.ranking))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const medal = (p: number) => (p === 1 ? '🥇' : p === 2 ? '🥈' : p === 3 ? '🥉' : `${p}`);

  return (
    <div style={{ minHeight: '100vh', padding: '32px 16px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <p style={{ marginBottom: 16 }}><Link href="/desafios">← Desafíos</Link> · <Link href="/">Inicio</Link></p>
        <h1 style={{ textAlign: 'center', color: 'var(--primary-dark)', marginBottom: 6 }}>Ranking de instituciones</h1>
        <p className="muted" style={{ textAlign: 'center', marginBottom: 20 }}>Por precisión media en los desafíos</p>

        <div className="card">
          {!loaded ? (
            <div className="muted">Cargando…</div>
          ) : rows.length === 0 ? (
            <p className="muted" style={{ textAlign: 'center' }}>Aún no hay datos de instituciones. ¡Participa en los desafíos!</p>
          ) : (
            <div className="table-responsive">
              <table>
                <thead>
                  <tr><th>#</th><th>Institución</th><th>Participantes</th><th>Precisión</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
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
        <p style={{ textAlign: 'center', marginTop: 24 }}><AppVersion /></p>
      </div>
    </div>
  );
}
