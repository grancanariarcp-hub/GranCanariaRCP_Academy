'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Ayuda } from '@/components/ayuda/Ayuda';

/**
 * Diplomas del participante.
 *
 * Al montarse se comprueba si le corresponde algún hito por horas: así el
 * reconocimiento llega solo, sin depender de un proceso programado.
 */

interface Reconocimiento {
  id: string;
  code: string;
  kind: string;
  challenge_title: string | null;
  position: number | null;
  hours: string | null;
  issued_at: string;
}

export function MyRecognitions() {
  const [datos, setDatos] = useState<{
    recognitions: Reconocimiento[];
    horasAcumuladas: number;
    proximoHito: { horas: number; titulo: string } | null;
  } | null>(null);

  useEffect(() => {
    api('/api/profile/recognitions/check', { method: 'POST', auth: true })
      .catch(() => {})
      .finally(() => {
        api<NonNullable<typeof datos>>('/api/profile/recognitions', { auth: true })
          .then(setDatos)
          .catch(() => {});
      });
  }, []);

  if (!datos) return null;

  const { recognitions, horasAcumuladas, proximoHito } = datos;
  const progreso = proximoHito ? Math.min(100, Math.round((horasAcumuladas / proximoHito.horas) * 100)) : 0;

  return (
    <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid #c41e3a' }}>
      <div className="card-header">
        <div className="card-title">Mis diplomas <Ayuda tema="alumno-certificados" /></div>
        <div className="card-subtitle">Por participar en los desafíos y por tus horas de práctica</div>
      </div>

      {/* Avance hacia el siguiente hito: da sentido a seguir practicando. */}
      {proximoHito && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
            <span><strong>{horasAcumuladas} h</strong> de práctica acumuladas</span>
            <span className="muted">Siguiente hito: {proximoHito.horas} h</span>
          </div>
          <div style={{ height: 8, background: 'var(--gray-200)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progreso}%`, background: 'linear-gradient(90deg,#c41e3a,#f59e0b)', transition: 'width .4s ease' }} />
          </div>
        </div>
      )}

      {recognitions.length === 0 ? (
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          Aún no tienes diplomas. Participa en un desafío —lo recibe todo el que lo completa— o sigue
          practicando: al alcanzar
          {proximoHito ? ` las ${proximoHito.horas} horas` : ' los hitos de práctica'} recibirás el primero.
        </p>
      ) : (
        <div className="table-responsive">
          <table className="table-plain">
            <thead>
              <tr><th>Diploma</th><th>Fecha</th><th></th></tr>
            </thead>
            <tbody>
              {recognitions.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.kind === 'desafio' ? (
                      <>
                        <strong>{r.challenge_title}</strong>
                        {r.position && <span className="badge badge-warning" style={{ marginLeft: 6, fontSize: 11 }}>{r.position}.º puesto</span>}
                      </>
                    ) : (
                      <strong>{Number(r.hours)} horas de práctica</strong>
                    )}
                  </td>
                  <td className="muted" style={{ fontSize: 13 }}>{new Date(r.issued_at).toLocaleDateString('es-ES')}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <a className="link-action" href={`/reconocimiento/${r.code}`} target="_blank" rel="noreferrer">Ver</a>{' · '}
                    <a className="link-action" href={`${process.env.NEXT_PUBLIC_API_URL || ''}/api/public/recognitions/${r.code}/pdf`}>
                      Descargar
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
