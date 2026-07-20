'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { PageNav } from '@/components/PageNav';
import { useSession } from '@/hooks/useSession';
import { api } from '@/lib/api';

/**
 * Estadística fina del opositor sobre un banco.
 *
 * Tres vistas: por materia (dónde fallo y qué me falta), pregunta a pregunta
 * (cuáles se me atragantan) y el aviso de punto ciego, que aparece cuando ya
 * ha respondido lo suficiente como para haber visto todo el banco y sin embargo
 * quedan preguntas que nunca le han salido.
 */

interface Banco { id: string; name: string }
interface Materia {
  materia: string; preguntas: number; vistas: number; respuestas: number; aciertos: number;
  coberturaPct: number; aciertoPct: number | null; falloPct: number | null; pendientes: number;
}
interface Cobertura {
  total: number; vistas: number; respuestas: number; pendientes: number; coberturaPct: number;
  puntoCiego: boolean; mensaje: string | null;
}
interface PreguntaStat {
  id: string; orden: number | null; tema: string | null; text: string;
  veces: number; aciertos: number; ultima_correcta: boolean | null;
  veces_comunidad: number; acierto_comunidad_pct: number | null;
  aciertoPct: number | null; falloPct: number | null;
}

export default function EstadisticasOpePage() {
  const user = useSession(['student'], '/login/student');
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [sel, setSel] = useState('');
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [cobertura, setCobertura] = useState<Cobertura | null>(null);
  const [sinVer, setSinVer] = useState<PreguntaStat[]>([]);
  const [preguntas, setPreguntas] = useState<PreguntaStat[]>([]);
  const [soloFalladas, setSoloFalladas] = useState(false);
  const [vista, setVista] = useState<'materias' | 'preguntas'>('materias');

  useEffect(() => {
    if (!user) return;
    api<{ banks: Banco[] }>('/api/practice/ope-banks', { auth: true })
      .then((r) => { setBancos(r.banks); if (r.banks[0]) setSel(r.banks[0].id); })
      .catch(() => {});
  }, [user]);

  const cargar = useCallback(async () => {
    if (!sel) return;
    const [m, q] = await Promise.all([
      api<{ materias: Materia[]; cobertura: Cobertura; sinVer: PreguntaStat[] }>(`/api/practice/ope-banks/${sel}/materias`, { auth: true }),
      api<{ preguntas: PreguntaStat[] }>(`/api/practice/ope-banks/${sel}/questions${soloFalladas ? '?falladas=1' : ''}`, { auth: true }),
    ]);
    setMaterias(m.materias);
    setCobertura(m.cobertura);
    setSinVer(m.sinVer);
    setPreguntas(q.preguntas);
  }, [sel, soloFalladas]);

  useEffect(() => { cargar().catch(() => {}); }, [cargar]);

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  const flojas = [...materias].filter((m) => m.falloPct !== null).sort((a, b) => (b.falloPct ?? 0) - (a.falloPct ?? 0));
  const menosVistas = [...materias].sort((a, b) => a.coberturaPct - b.coberturaPct);

  return (
    <AppShell
      user={user}
      title="Mis estadísticas"
      nav={[
        { label: 'Inicio', href: '/student' },
        { label: 'Oposiciones', href: '/student/ope' },
        { label: 'Generar test', href: '/student/ope/test' },
        { label: 'Estadísticas', href: '/student/ope/estadisticas', active: true },
      ]}
    >
      <PageNav backHref="/student/ope" backLabel="Volver a oposiciones" />

      {bancos.length === 0 ? (
        <div className="card"><p className="muted" style={{ margin: 0 }}>Todavía no hay bancos de oposición publicados.</p></div>
      ) : (
        <>
          {bancos.length > 1 && (
            <div className="card" style={{ marginBottom: 18 }}>
              <label className="form-label" htmlFor="est-banco">Banco</label>
              <select id="est-banco" className="form-select" value={sel} onChange={(e) => setSel(e.target.value)}>
                {bancos.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          {/* Punto ciego: el aviso más útil de toda la pantalla */}
          {cobertura?.puntoCiego && (
            <div className="card animate-pop" style={{ marginBottom: 18, borderLeft: '5px solid var(--warning)' }}>
              <h3 style={{ fontSize: 17, marginBottom: 6 }}>Tienes un punto ciego en el temario</h3>
              <p style={{ fontSize: 14.5, marginBottom: 12 }}>{cobertura.mensaje}</p>
              <Link href="/student/ope/test" className="btn btn-primary btn-small press">
                Generar test con las que menos he visto
              </Link>
              {sinVer.length > 0 && (
                <details style={{ marginTop: 12 }}>
                  <summary className="link-action" style={{ fontSize: 13 }}>
                    Ver las {cobertura.pendientes} preguntas que nunca te han salido
                  </summary>
                  <div style={{ marginTop: 8, maxHeight: 240, overflowY: 'auto' }}>
                    {sinVer.map((q) => (
                      <div key={q.id} className="muted" style={{ fontSize: 13, padding: '3px 0' }}>
                        {q.orden && <strong>nº {q.orden}. </strong>}{q.text}
                        {q.tema && <span className="badge" style={{ marginLeft: 6, fontSize: 10 }}>{q.tema}</span>}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {cobertura && (
            <div className="grid grid-4" style={{ gap: 12, marginBottom: 18 }}>
              <Cifra k="Preguntas del banco" v={String(cobertura.total)} />
              <Cifra k="Distintas respondidas" v={`${cobertura.vistas} (${cobertura.coberturaPct} %)`} />
              <Cifra k="Respuestas dadas" v={String(cobertura.respuestas)} />
              <Cifra k="Nunca vistas" v={String(cobertura.pendientes)}
                color={cobertura.pendientes > 0 ? 'var(--warning)' : 'var(--success)'} />
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            <button className={`tab ${vista === 'materias' ? 'active' : ''}`} style={{ flex: 'unset', padding: '7px 14px' }}
              onClick={() => setVista('materias')}>Por materia</button>
            <button className={`tab ${vista === 'preguntas' ? 'active' : ''}`} style={{ flex: 'unset', padding: '7px 14px' }}
              onClick={() => setVista('preguntas')}>Pregunta a pregunta</button>
          </div>

          {vista === 'materias' ? (
            <>
              {flojas.length > 0 && (
                <div className="grid grid-2" style={{ gap: 14, marginBottom: 18 }}>
                  <div className="card">
                    <div className="card-header"><div className="card-title">Donde más fallas</div></div>
                    {flojas.slice(0, 5).map((m) => (
                      <div key={m.materia} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '5px 0' }}>
                        <span>{m.materia}</span>
                        <strong style={{ color: 'var(--danger)' }}>{m.falloPct} % de fallo</strong>
                      </div>
                    ))}
                  </div>
                  <div className="card">
                    <div className="card-header"><div className="card-title">Lo que menos has trabajado</div></div>
                    {menosVistas.slice(0, 5).map((m) => (
                      <div key={m.materia} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '5px 0' }}>
                        <span>{m.materia}</span>
                        <span className="muted">{m.vistas}/{m.preguntas} vistas</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="card">
                <div className="card-header"><div className="card-title">Todas las materias</div></div>
                <div className="table-responsive">
                  <table className="table-plain">
                    <thead>
                      <tr><th>Materia</th><th>Cobertura</th><th>Respuestas</th><th>Acierto</th><th>Pendientes</th></tr>
                    </thead>
                    <tbody>
                      {materias.map((m) => (
                        <tr key={m.materia}>
                          <td><strong>{m.materia}</strong></td>
                          <td>
                            {m.vistas}/{m.preguntas}
                            <div style={{ height: 5, background: 'var(--gray-200)', borderRadius: 999, marginTop: 3, width: 90 }}>
                              <div style={{
                                height: '100%', width: `${m.coberturaPct}%`, borderRadius: 999,
                                background: m.coberturaPct >= 80 ? 'var(--success)' : m.coberturaPct >= 40 ? 'var(--warning)' : 'var(--danger)',
                              }} />
                            </div>
                          </td>
                          <td>{m.respuestas}</td>
                          <td>
                            {m.aciertoPct !== null
                              ? <strong style={{ color: m.aciertoPct >= 50 ? 'var(--success)' : 'var(--danger)' }}>{m.aciertoPct} %</strong>
                              : <span className="muted">—</span>}
                          </td>
                          <td>{m.pendientes > 0 ? <span className="badge badge-warning">{m.pendientes}</span> : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div className="card-title">Pregunta a pregunta</div>
                  <div className="card-subtitle">Cuántas veces la has respondido y cómo te va, comparado con la comunidad</div>
                </div>
                <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 13.5 }}>
                  <input type="checkbox" checked={soloFalladas} onChange={(e) => setSoloFalladas(e.target.checked)} />
                  Solo las que fallé
                </label>
              </div>
              <div className="table-responsive">
                <table className="table-plain">
                  <thead>
                    <tr><th>Nº</th><th>Pregunta</th><th>Veces</th><th>Mi acierto</th><th>La comunidad</th></tr>
                  </thead>
                  <tbody>
                    {preguntas.map((q) => (
                      <tr key={q.id}>
                        <td className="muted">{q.orden ?? '—'}</td>
                        <td>
                          {q.text}
                          {q.tema && <div className="muted" style={{ fontSize: 11.5 }}>{q.tema}</div>}
                        </td>
                        <td>
                          {q.veces}
                          {q.veces > 0 && q.ultima_correcta === false && (
                            <span className="badge badge-warning" style={{ marginLeft: 5, fontSize: 10 }}>fallada</span>
                          )}
                        </td>
                        <td>
                          {q.aciertoPct !== null
                            ? <strong style={{ color: q.aciertoPct >= 50 ? 'var(--success)' : 'var(--danger)' }}>{q.aciertoPct} %</strong>
                            : <span className="muted">sin responder</span>}
                        </td>
                        <td className="muted">
                          {/* Si la comunidad también la falla, no es cosa tuya. */}
                          {q.acierto_comunidad_pct !== null
                            ? `${q.acierto_comunidad_pct} % (${q.veces_comunidad} resp.)`
                            : 'pocos datos'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preguntas.length === 0 && (
                <p className="muted" style={{ margin: 0 }}>
                  {soloFalladas ? 'No tienes preguntas falladas pendientes.' : 'Aún no hay preguntas en este banco.'}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

function Cifra({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div className="info-box">
      <div className="muted" style={{ fontSize: 12 }}>{k}</div>
      <div style={{ fontSize: 23, fontWeight: 700, color }}>{v}</div>
    </div>
  );
}
