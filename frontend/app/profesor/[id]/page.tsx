'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { AppVersion } from '@/components/AppVersion';

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
        <p style={{ marginBottom: 16 }}><Link href="/">← Volver</Link></p>
        {error && <div className="alert alert-error">{error}</div>}
        {data && (
          <div className="card">
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--gray-200)', overflow: 'hidden', flexShrink: 0 }}>
                {data.professor.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.professor.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 28 }}>👤</div>
                )}
              </div>
              <div>
                <h1 style={{ fontSize: 22 }}>{data.professor.name}</h1>
                {data.professor.headline && <div className="muted">{data.professor.headline}</div>}
              </div>
            </div>

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
        )}
        <p style={{ textAlign: 'center', marginTop: 24 }}><AppVersion /></p>
      </div>
    </div>
  );
}
