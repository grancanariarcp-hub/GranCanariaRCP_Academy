'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { PageNav } from '@/components/PageNav';
import { useSession } from '@/hooks/useSession';
import { api } from '@/lib/api';

/**
 * Panel de preparación de oposiciones.
 *
 * Quien prepara una OPE no cursa un temario con módulos y certificado: repite
 * exámenes, mide qué parte del temario lleva vista y repasa sus fallos. Por eso
 * este panel se organiza en torno a la COBERTURA y al simulacro, no al avance
 * por actividades.
 */

interface Banco {
  id: string;
  name: string;
  comunidad_autonoma: string | null;
  categoria_profesional: string | null;
  anio: number | null;
  preguntas: number;
  vistas: number;
  pendientes: number;
  coberturaPct: number;
  aciertoPct: number | null;
  simulacros: number;
  ultima_sesion: string | null;
  sim_questions: number | null;
  sim_minutes: number | null;
  sim_pass_pct: number | null;
  simulacroListo: boolean;
}

interface Detalle {
  banco: Banco;
  porTema: Array<{ tema: string; preguntas: number; vistas: number; aciertos: number; coberturaPct: number; aciertoPct: number | null }>;
  fallosPendientes: number;
  sesiones: Array<{ fecha: string; total: number; correct: number; pct: number; is_simulacro: boolean }>;
}

export default function OpePage() {
  const user = useSession(['student'], '/login/student');
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [sel, setSel] = useState<string>('');
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!user) return;
    api<{ banks: Banco[] }>('/api/practice/ope-banks', { auth: true })
      .then((r) => {
        setBancos(r.banks);
        if (r.banks.length > 0) setSel(r.banks[0].id);
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [user]);

  const cargarDetalle = useCallback(async (id: string) => {
    if (!id) return;
    try {
      setDetalle(await api<Detalle>(`/api/practice/ope-banks/${id}`, { auth: true }));
    } catch { setDetalle(null); }
  }, []);

  useEffect(() => { cargarDetalle(sel); }, [sel, cargarDetalle]);

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  const b = bancos.find((x) => x.id === sel);

  return (
    <AppShell
      user={user}
      title="Preparación de oposiciones"
      nav={[
        { label: 'Inicio', href: '/student' },
        { label: 'Oposiciones', href: '/student/ope', active: true },
        { label: 'Práctica RCP básico', href: '/practica' },
        { label: 'Perfil', href: '/student/perfil' },
      ]}
    >
      <PageNav backHref="/student" backLabel="Volver al inicio" />

      {cargando ? (
        <p className="muted">Cargando…</p>
      ) : bancos.length === 0 ? (
        <div className="card">
          <h2 style={{ fontSize: 19, marginBottom: 8 }}>Todavía no hay oposiciones disponibles</h2>
          <p className="muted" style={{ margin: 0 }}>
            Cuando se publiquen bancos de preguntas de OPE o MIR aparecerán aquí, con su simulacro oficial y
            tu cobertura del temario. Mientras tanto puedes entrenar en la{' '}
            <Link href="/practica">práctica libre</Link>.
          </p>
        </div>
      ) : (
        <>
          {bancos.length > 1 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <label className="form-label" htmlFor="ope-sel">Oposición que preparas</label>
              <select id="ope-sel" className="form-select" value={sel} onChange={(e) => setSel(e.target.value)}>
                {bancos.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}{x.comunidad_autonoma ? ` · ${x.comunidad_autonoma}` : ''}{x.anio ? ` · ${x.anio}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {b && (
            <>
              {/* Cifras que de verdad importan al opositor */}
              <div className="grid grid-4" style={{ gap: 12, marginBottom: 18 }}>
                <div className="info-box">
                  <div className="muted" style={{ fontSize: 12 }}>Temario cubierto</div>
                  <div style={{ fontSize: 26, fontWeight: 700 }}>{b.coberturaPct} %</div>
                  <div className="muted" style={{ fontSize: 11 }}>{b.vistas} de {b.preguntas} preguntas</div>
                </div>
                <div className="info-box">
                  <div className="muted" style={{ fontSize: 12 }}>Por responder</div>
                  <div style={{ fontSize: 26, fontWeight: 700 }}>{b.pendientes}</div>
                </div>
                <div className="info-box">
                  <div className="muted" style={{ fontSize: 12 }}>Acierto actual</div>
                  <div style={{
                    fontSize: 26, fontWeight: 700,
                    color: b.aciertoPct === null ? undefined
                      : b.aciertoPct >= (b.sim_pass_pct ?? 50) ? 'var(--success)' : 'var(--danger)',
                  }}>
                    {b.aciertoPct !== null ? `${b.aciertoPct} %` : '—'}
                  </div>
                  {b.sim_pass_pct && <div className="muted" style={{ fontSize: 11 }}>Corte: {b.sim_pass_pct} %</div>}
                </div>
                <div className="info-box">
                  <div className="muted" style={{ fontSize: 12 }}>Fallos por repasar</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: detalle?.fallosPendientes ? 'var(--warning)' : undefined }}>
                    {detalle?.fallosPendientes ?? '—'}
                  </div>
                </div>
              </div>

              {/* Acciones: generar examen, simulacro y repaso de fallos */}
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header">
                  <div className="card-title">Ponte a prueba</div>
                  <div className="card-subtitle">
                    {b.simulacroListo
                      ? `Simulacro oficial: ${b.sim_questions} preguntas en ${b.sim_minutes} min${b.sim_pass_pct ? `, corte ${b.sim_pass_pct} %` : ''}`
                      : 'El simulacro de esta oposición aún no está configurado'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Link href={`/practica?bankId=${b.id}&modo=simulacro`}
                    className={`btn press ${b.simulacroListo ? 'btn-primary cta-blink' : 'btn-outline'}`}
                    style={b.simulacroListo ? undefined : { pointerEvents: 'none', opacity: 0.5 }}>
                    Hacer el simulacro
                  </Link>
                  <Link href={`/practica?bankId=${b.id}&modo=tema`} className="btn btn-outline press">
                    Examen a mi medida
                  </Link>
                  <Link href={`/practica?bankId=${b.id}&modo=fallos`} className="btn btn-outline press"
                    style={detalle?.fallosPendientes ? undefined : { pointerEvents: 'none', opacity: 0.5 }}>
                    Repasar mis fallos{detalle?.fallosPendientes ? ` (${detalle.fallosPendientes})` : ''}
                  </Link>
                </div>
                {b.simulacros > 0 && (
                  <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
                    Llevas {b.simulacros} simulacro{b.simulacros === 1 ? '' : 's'} realizado{b.simulacros === 1 ? '' : 's'}.
                  </p>
                )}
              </div>

              {/* Cobertura por tema: dónde están las lagunas */}
              {detalle && detalle.porTema.length > 0 && (
                <div className="card" style={{ marginBottom: 20 }}>
                  <div className="card-header">
                    <div className="card-title">Tu cobertura del temario</div>
                    <div className="card-subtitle">Cuánto llevas visto de cada tema y cómo vas de acierto</div>
                  </div>
                  {detalle.porTema.map((t) => (
                    <div key={t.tema} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 4 }}>
                        <span style={{ fontWeight: 500 }}>{t.tema}</span>
                        <span className="muted">
                          {t.vistas}/{t.preguntas}
                          {t.aciertoPct !== null && <> · <strong style={{ color: t.aciertoPct >= 50 ? 'var(--success)' : 'var(--danger)' }}>{t.aciertoPct} %</strong></>}
                        </span>
                      </div>
                      <div style={{ height: 7, background: 'var(--gray-200)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${t.coberturaPct}%`, transition: 'width .3s ease',
                          background: t.coberturaPct >= 80 ? 'var(--success)' : t.coberturaPct >= 40 ? 'var(--warning)' : 'var(--danger)',
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Evolución: lo que dice si el estudio está funcionando */}
              {detalle && detalle.sesiones.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Tu evolución</div>
                    <div className="card-subtitle">Últimas {detalle.sesiones.length} sesiones</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 100, marginBottom: 8 }}>
                    {detalle.sesiones.map((s, i) => (
                      <div key={i} title={`${s.fecha}: ${s.correct}/${s.total} (${s.pct} %)`}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                        <div style={{
                          height: `${Math.max(4, s.pct)}%`, borderRadius: '3px 3px 0 0',
                          background: s.is_simulacro ? 'var(--primary-dark)' : 'var(--secondary-dark)',
                          opacity: s.pct >= (b.sim_pass_pct ?? 50) ? 1 : 0.55,
                        }} />
                      </div>
                    ))}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Barras oscuras: simulacros. Las más tenues quedaron por debajo del corte.
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </AppShell>
  );
}
