'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, apiBase } from '@/lib/api';
import { PageNav } from '@/components/PageNav';

/**
 * Página pública de un diploma.
 *
 * Destino del QR impreso y, sobre todo, lo que se comparte en redes: por eso
 * lleva botones de difusión. Evita la palabra "certificado" y advierte que no
 * es formación acreditada, para no confundirlo con los títulos oficiales.
 */

interface Reconocimiento {
  titular: string;
  tipo: string;
  motivo: string;
  emitidoEl: string;
  acreditado: boolean;
}

export default function VerificarReconocimiento() {
  const params = useParams();
  const code = params.code as string;
  const [datos, setDatos] = useState<{ valido: boolean; reconocimiento: Reconocimiento } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ valido: boolean; reconocimiento: Reconocimiento }>(`/api/public/recognitions/${code}`)
      .then(setDatos)
      .catch(() => setError('No existe ningún reconocimiento con este código.'));
  }, [code]);

  return (
    <div style={{ minHeight: '100vh', padding: '32px 16px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <PageNav />

        {error && <div className="alert alert-error">{error}</div>}
        {!datos && !error && <p className="muted">Comprobando…</p>}

        {datos && (
          <div className="card animate-pop" style={{ borderTop: '5px solid #c41e3a', textAlign: 'center' }}>
            <div style={{ fontSize: 40, lineHeight: 1 }}>🏅</div>
            <h1 style={{ fontSize: 21, marginTop: 8 }}>{datos.reconocimiento.tipo}</h1>

            <div style={{ margin: '20px 0' }}>
              <div className="muted" style={{ fontSize: 13 }}>Gran Canaria RCP agradece a</div>
              <div style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 10px' }}>{datos.reconocimiento.titular}</div>
              <div style={{ fontSize: 15 }}>{datos.reconocimiento.motivo}</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                Emitido el {new Date(datos.reconocimiento.emitidoEl).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
            </div>

            <p style={{ fontStyle: 'italic', color: '#c41e3a', fontSize: 14.5, margin: '0 auto 20px', maxWidth: 440 }}>
              …y contribuir a que nuestra sociedad esté realmente cardioprotegida.
            </p>

            <a className="btn btn-primary press" href={`${apiBase}/api/public/recognitions/${code}/pdf`}>
              Descargar en PDF
            </a>

            <Compartir titular={datos.reconocimiento.titular} motivo={datos.reconocimiento.motivo} />

            {/* La distinción con la formación oficial va siempre visible. */}
            <div className="info-box" style={{ marginTop: 20, textAlign: 'left', fontSize: 13 }}>
              Este diploma agradece la <strong>participación y la dedicación</strong>. No constituye formación
              acreditada ni otorga créditos de formación continuada. Si buscas formación oficial con certificado
              acreditado, consulta el <Link href="/">campus</Link>.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Difusión en redes: es el motivo por el que todo participante recibe diploma. */
function Compartir({ titular, motivo }: { titular: string; motivo: string }) {
  const [copiado, setCopiado] = useState(false);
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const texto = `${titular} — ${motivo}. ¡Aprende RCP tú también y contribuye a una sociedad cardioprotegida!`;

  return (
    <div style={{ marginTop: 18 }}>
      <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>Compártelo</div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        <a className="btn btn-outline btn-small press" target="_blank" rel="noreferrer"
          href={`https://wa.me/?text=${encodeURIComponent(`${texto} ${url}`)}`}>WhatsApp</a>
        <a className="btn btn-outline btn-small press" target="_blank" rel="noreferrer"
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(texto)}&url=${encodeURIComponent(url)}`}>X</a>
        <a className="btn btn-outline btn-small press" target="_blank" rel="noreferrer"
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}>LinkedIn</a>
        <button className="btn btn-outline btn-small press"
          onClick={() => { navigator.clipboard?.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }}>
          {copiado ? '✓ Copiado' : 'Copiar enlace'}
        </button>
      </div>
    </div>
  );
}
