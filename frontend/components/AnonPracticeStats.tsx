'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/**
 * Participación en la práctica libre sin registro.
 *
 * Mide cuánta gente prueba el test gratuito, qué perfil tiene y cuántos acaban
 * registrándose. Es la métrica que dice si la zona gratuita está trayendo
 * usuarios o solo visitas.
 */

interface Stats {
  totales: {
    sesiones: number;
    personas: number;
    convertidas: number;
    conversionPct: number;
    mediaAciertosPct: number | null;
    mediaMinutos: number | null;
  };
  periodos: { mes_actual: number; mes_anterior: number; anio: number };
  porDispositivo: Array<{ clave: string; n: number }>;
  porPais: Array<{ clave: string; n: number }>;
  porTema: Array<{ clave: string; n: number; aciertos: string | null }>;
  diario: Array<{ dia: string; n: number }>;
}

const ETIQUETA: Record<string, string> = { movil: 'Móvil', tablet: 'Tablet', escritorio: 'Escritorio' };

export function AnonPracticeStats() {
  const [s, setS] = useState<Stats | null>(null);

  useEffect(() => {
    api<Stats>('/api/admin/anon-practice', { auth: true }).then(setS).catch(() => {});
  }, []);

  if (!s) return null;
  const maxDia = Math.max(1, ...s.diario.map((d) => d.n));

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <div className="card-title">Práctica libre sin registro</div>
        <div className="card-subtitle">Quién prueba el test gratuito y cuántos acaban registrándose</div>
      </div>

      {s.totales.sesiones === 0 ? (
        <p className="muted" style={{ margin: 0 }}>Aún nadie ha hecho el test gratuito.</p>
      ) : (
        <>
          <div className="grid grid-4" style={{ gap: 12, marginBottom: 18 }}>
            <div className="info-box">
              <div className="muted" style={{ fontSize: 12 }}>Personas</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{s.totales.personas}</div>
            </div>
            <div className="info-box">
              <div className="muted" style={{ fontSize: 12 }}>Se registraron</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>
                {s.totales.conversionPct} %
              </div>
              <div className="muted" style={{ fontSize: 11 }}>{s.totales.convertidas} de {s.totales.sesiones}</div>
            </div>
            <div className="info-box">
              <div className="muted" style={{ fontSize: 12 }}>Aciertos medios</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>
                {s.totales.mediaAciertosPct !== null ? `${s.totales.mediaAciertosPct} %` : '—'}
              </div>
            </div>
            <div className="info-box">
              <div className="muted" style={{ fontSize: 12 }}>Duración media</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>
                {s.totales.mediaMinutos !== null ? `${s.totales.mediaMinutos} min` : '—'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginBottom: 18, fontSize: 14 }}>
            <span>Mes anterior: <strong>{s.periodos.mes_anterior}</strong></span>
            <span>Lo que va de mes: <strong>{s.periodos.mes_actual}</strong></span>
            <span>Lo que va de año: <strong>{s.periodos.anio}</strong></span>
          </div>

          {/* Serie de 30 días: dice si una publicación en redes ha funcionado. */}
          {s.diario.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Últimos 30 días</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 54 }}>
                {s.diario.map((d) => (
                  <div key={d.dia} title={`${d.dia}: ${d.n}`} style={{
                    flex: 1, height: `${(d.n / maxDia) * 100}%`, minHeight: 3,
                    background: 'var(--secondary-dark)', borderRadius: '2px 2px 0 0',
                  }} />
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-3" style={{ gap: 14 }}>
            <Lista titulo="Dispositivo" filas={s.porDispositivo.map((d) => ({ k: ETIQUETA[d.clave] ?? d.clave, v: String(d.n) }))} />
            <Lista titulo="País" filas={s.porPais.map((d) => ({ k: d.clave, v: String(d.n) }))} />
            <Lista
              titulo="Tema practicado"
              filas={s.porTema.map((d) => ({ k: d.clave, v: `${d.n}${d.aciertos ? ` · ${d.aciertos} %` : ''}` }))}
            />
          </div>
        </>
      )}
    </div>
  );
}

function Lista({ titulo, filas }: { titulo: string; filas: Array<{ k: string; v: string }> }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{titulo}</div>
      {filas.length === 0 ? (
        <div className="muted" style={{ fontSize: 13 }}>—</div>
      ) : (
        filas.map((f) => (
          <div key={f.k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, padding: '3px 0' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.k}</span>
            <strong style={{ marginLeft: 8, whiteSpace: 'nowrap' }}>{f.v}</strong>
          </div>
        ))
      )}
    </div>
  );
}
