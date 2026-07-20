'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

/**
 * Aviso de perfil docente incompleto.
 *
 * Aparece mientras falte algo del currículum, que es requisito para publicar
 * un curso. Se muestra con barra de avance en lugar de un simple error, para
 * que se vea cuánto queda y no parezca un muro.
 */

interface Requisito { clave: string; etiqueta: string; cumplido: boolean; ayuda: string }
interface Estado { completo: boolean; faltan: string[]; progresoPct: number; requisitos: Requisito[] }

export function PerfilDocenteAviso({ compacto = false }: { compacto?: boolean }) {
  const [e, setE] = useState<Estado | null>(null);

  useEffect(() => {
    api<Estado>('/api/profile/docente', { auth: true }).then(setE).catch(() => {});
  }, []);

  if (!e || e.completo) return null;

  if (compacto) {
    return (
      <div className="alert alert-error" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span>
          Para <strong>publicar</strong> un curso falta completar tu perfil docente: {e.faltan.join(', ')}.
        </span>
        <Link href="/admin/perfil" className="btn btn-primary btn-small">Completar perfil</Link>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid var(--warning)' }}>
      <div className="card-header">
        <div className="card-title">Completa tu perfil docente</div>
        <div className="card-subtitle">Es lo que verán tus alumnos para saber quién imparte el curso</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
        <span className="muted">Perfil completado</span>
        <strong>{e.progresoPct} %</strong>
      </div>
      <div style={{ height: 8, background: 'var(--gray-200)', borderRadius: 999, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{
          height: '100%', width: `${e.progresoPct}%`, transition: 'width .3s ease',
          background: e.progresoPct >= 75 ? 'var(--success)' : 'var(--warning)',
        }} />
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {e.requisitos.map((r) => (
          <div key={r.clave} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 16, lineHeight: 1.2, color: r.cumplido ? 'var(--success)' : 'var(--gray-500)' }}>
              {r.cumplido ? '✓' : '○'}
            </span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, textDecoration: r.cumplido ? 'line-through' : 'none', opacity: r.cumplido ? 0.6 : 1 }}>
                {r.etiqueta}
              </div>
              {!r.cumplido && <div className="muted" style={{ fontSize: 12.5 }}>{r.ayuda}</div>}
            </div>
          </div>
        ))}
      </div>

      <p className="muted" style={{ fontSize: 12.5, marginTop: 14 }}>
        Puedes crear y preparar tus cursos sin esto; solo se exige para <strong>publicarlos</strong>.
      </p>
    </div>
  );
}
