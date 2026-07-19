'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, apiBase } from '@/lib/api';
import { PageNav } from '@/components/PageNav';

/**
 * Verificación pública de un certificado de reconocimiento.
 *
 * Destino del QR impreso. Deja claro que reconoce participación y dedicación,
 * y que NO es formación acreditada: la distinción con los certificados de
 * aprovechamiento debe ser evidente para quien lo recibe y para quien lo lee.
 */

interface Reconocimiento {
  titular: string;
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
            <h1 style={{ fontSize: 21, marginTop: 8 }}>Certificado de reconocimiento</h1>

            <div style={{ margin: '20px 0' }}>
              <div className="muted" style={{ fontSize: 13 }}>Otorgado a</div>
              <div style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 10px' }}>{datos.reconocimiento.titular}</div>
              <div style={{ fontSize: 15 }}>{datos.reconocimiento.motivo}</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                Emitido el {new Date(datos.reconocimiento.emitidoEl).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
            </div>

            <p style={{ fontStyle: 'italic', color: '#c41e3a', fontSize: 14.5, margin: '0 auto 20px', maxWidth: 420 }}>
              Gracias por contribuir a que nuestra sociedad cada día esté más cardioprotegida.
            </p>

            <a className="btn btn-primary press" href={`${apiBase}/api/public/recognitions/${code}/pdf`}>
              Descargar en PDF
            </a>

            {/* La distinción con la formación oficial va siempre visible. */}
            <div className="info-box" style={{ marginTop: 20, textAlign: 'left', fontSize: 13 }}>
              Este documento reconoce la <strong>participación y la dedicación</strong>. No constituye formación
              acreditada ni otorga créditos de formación continuada. Si buscas formación oficial con certificado
              acreditado, consulta el <Link href="/">campus</Link>.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
