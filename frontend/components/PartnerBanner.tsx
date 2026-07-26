'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/**
 * Tarjeta de venta cruzada con PÚLSAR (simulación clínica presencial).
 *
 * Promociona la parte práctica —que se hace con PÚLSAR— dentro de la academia,
 * de forma simétrica a como PÚLSAR nos promociona a nosotros. Es SOLO marketing:
 * no toca cursos, actas ni matrículas. La configura el super admin y se guarda
 * en la base de datos; si está desactivada, este componente no pinta nada.
 *
 * El enlace de salida ya trae ?ref=academia (lo añade el backend), para medir de
 * dónde vienen los leads que capta PÚLSAR.
 */

interface Banner {
  titulo: string;
  texto: string;
  imagenUrl: string;
  enlace: string;
  textoBoton: string;
}

export function PartnerBanner({ variante = 'ancho' }: { variante?: 'ancho' | 'compacto' }) {
  const [banner, setBanner] = useState<Banner | null>(null);

  useEffect(() => {
    api<{ banner: Banner | null }>('/api/public/partner-banner')
      .then((r) => setBanner(r.banner))
      .catch(() => {});
  }, []);

  if (!banner) return null;

  return (
    <a
      href={banner.enlace}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="card press"
      style={{
        display: 'flex',
        gap: 18,
        alignItems: 'center',
        flexWrap: 'wrap',
        textDecoration: 'none',
        borderLeft: '4px solid #7c3aed',
        background: 'linear-gradient(105deg, #faf7ff 0%, var(--bg-card) 60%)',
        marginBottom: 24,
      }}
    >
      {banner.imagenUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={banner.imagenUrl}
          alt=""
          style={{ width: variante === 'compacto' ? 84 : 120, height: 'auto', borderRadius: 10, flexShrink: 0 }}
        />
      )}
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span
            style={{
              fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: '#7c3aed', background: '#f0e9ff', padding: '2px 8px', borderRadius: 20,
            }}
          >
            Fase práctica
          </span>
        </div>
        <div style={{ fontSize: variante === 'compacto' ? 16 : 18, fontWeight: 700, color: 'var(--primary-dark)' }}>
          {banner.titulo}
        </div>
        <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.55, margin: '5px 0 0' }}>
          {banner.texto}
        </p>
      </div>
      <span
        className="btn btn-small"
        style={{ background: '#7c3aed', color: '#fff', flexShrink: 0, whiteSpace: 'nowrap' }}
      >
        {banner.textoBoton} →
      </span>
    </a>
  );
}
