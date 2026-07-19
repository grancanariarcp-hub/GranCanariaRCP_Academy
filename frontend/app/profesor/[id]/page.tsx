'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { AppVersion } from '@/components/AppVersion';
import { PageNav } from '@/components/PageNav';

type CvCat = 'formacion' | 'investigacion' | 'publicaciones' | 'reconocimientos' | 'experiencia';
const LABELS: Record<CvCat, string> = {
  formacion: '🎓 Formación',
  investigacion: '🔬 Investigación',
  publicaciones: '📄 Publicaciones',
  reconocimientos: '🏅 Reconocimientos',
  experiencia: '💼 Experiencia laboral',
};

export default function PublicProfessorPage() {
  const { id } = useParams();
  const [data, setData] = useState<{ professor: { name: string; headline: string | null; photo_url: string | null }; cv: Record<CvCat, Array<{ text: string }>> } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<typeof data>(`/api/public/professors/${id}/cv`)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No disponible'));
  }, [id]);

  return (
    <div style={{ minHeight: '100vh', padding: '32px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <PageNav />
        {error && <div className="alert alert-error">{error}</div>}
        {data && (
          <div className="card animate-pop" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(135deg,var(--primary-dark),var(--secondary-dark))', padding: '26px 24px', display: 'flex', gap: 18, alignItems: 'center' }}>
              <div style={{ width: 84, height: 84, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', overflow: 'hidden', flexShrink: 0, border: '3px solid rgba(255,255,255,0.7)' }}>
                {data.professor.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.professor.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 34 }}>👤</div>
                )}
              </div>
              <div style={{ color: '#fff' }}>
                <h1 style={{ fontSize: 24 }}>{data.professor.name}</h1>
                {data.professor.headline && <div style={{ opacity: 0.9 }}>{data.professor.headline}</div>}
              </div>
            </div>

            <div style={{ padding: 24 }}>
            {(Object.keys(LABELS) as CvCat[]).map((cat) =>
              data.cv[cat].length > 0 ? (
                <div key={cat} style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, color: 'var(--primary-dark)', marginBottom: 4 }}>{LABELS[cat]}</div>
                  <ul style={{ margin: '0 0 0 18px' }}>
                    {data.cv[cat].map((it, i) => <li key={i}>{it.text}</li>)}
                  </ul>
                </div>
              ) : null,
            )}
            </div>
          </div>
        )}
        <p style={{ textAlign: 'center', marginTop: 24 }}><AppVersion /></p>
      </div>
    </div>
  );
}
