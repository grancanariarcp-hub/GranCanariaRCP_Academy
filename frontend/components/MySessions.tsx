'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

/**
 * Dispositivos conectados a la cuenta.
 *
 * Se enseña el límite y las sesiones abiertas por dos motivos: quien lo conoce
 * no se sorprende cuando se le cierra una, y quien vea aquí un dispositivo que
 * no reconoce puede cerrarlo y cambiar su contraseña.
 */

interface Sesion {
  id: string; dispositivo: string | null; created_at: string; last_seen_at: string; actual: boolean;
}

export function MySessions() {
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [maximo, setMaximo] = useState(2);

  const cargar = useCallback(() => {
    api<{ sesiones: Sesion[]; maximo: number }>('/api/profile/sessions', { auth: true })
      .then((r) => { setSesiones(r.sesiones); setMaximo(r.maximo); })
      .catch(() => {});
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  if (sesiones.length === 0) return null;

  async function cerrar(id: string) {
    await api(`/api/profile/sessions/${id}`, { method: 'DELETE', auth: true });
    cargar();
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header">
        <div className="card-title">Dispositivos conectados</div>
        <div className="card-subtitle">
          Puedes usar tu cuenta en {maximo} dispositivos a la vez; al entrar en uno más se cierra el menos
          activo
        </div>
      </div>

      {sesiones.map((s) => (
        <div key={s.id} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
          padding: '10px 0', borderBottom: '1px solid var(--gray-100)', flexWrap: 'wrap',
        }}>
          <div>
            <strong style={{ fontSize: 14.5 }}>{s.dispositivo ?? 'Dispositivo'}</strong>
            {s.actual && <span className="badge badge-success" style={{ marginLeft: 6, fontSize: 11 }}>este</span>}
            <div className="muted" style={{ fontSize: 12.5 }}>
              Última actividad: {new Date(s.last_seen_at).toLocaleString('es-ES')}
            </div>
          </div>
          {!s.actual && (
            <button className="link-action danger" onClick={() => cerrar(s.id)}>Cerrar sesión</button>
          )}
        </div>
      ))}

      <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>
        ¿Ves un dispositivo que no reconoces? Ciérralo y cambia tu contraseña. Recuerda que tu progreso, tus
        fallos y tus estadísticas son personales: si compartes la cuenta, se mezclan con los de otra persona y
        dejan de servirte.
      </p>
    </div>
  );
}
