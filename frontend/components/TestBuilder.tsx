'use client';

import { useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';

/**
 * Asistente de configuración de tests y exámenes para oposiciones.
 *
 * Sigue el orden en que lo piensa el opositor: de qué bancos, con qué criterio,
 * cuántas preguntas, cuánto tiempo, cómo se corrige y si podrá repetirlo.
 *
 * Nunca se ofrece barajar las OPCIONES: en las oposiciones que publican el pool
 * de preguntas, la opción A debe seguir siendo la A aunque la pregunta cambie
 * de posición. Solo se baraja el orden de las preguntas.
 */

export interface BancoConv {
  id: string;
  name: string;
  preguntas: number;
  maxOrden: number | null;
  temas: string[];
  vistas: number;
}

export interface ConfigTest {
  bankIds: string[];
  criterio: 'aleatorio' | 'rango' | 'tema';
  rangoDesde?: number;
  rangoHasta?: number;
  temas?: string[];
  count: number;
  minutos: number | null;
  correccion: 'inmediata' | 'final';
  barajarPreguntas: boolean;
}

export function TestBuilder({ bancos, onGenerado }: { bancos: BancoConv[]; onGenerado: (r: any, cfg: ConfigTest) => void }) {
  const [bankIds, setBankIds] = useState<string[]>(bancos.length === 1 ? [bancos[0].id] : []);
  const [criterio, setCriterio] = useState<'aleatorio' | 'rango' | 'tema'>('aleatorio');
  const [desde, setDesde] = useState('1');
  const [hasta, setHasta] = useState('50');
  const [temas, setTemas] = useState<string[]>([]);
  const [count, setCount] = useState('20');
  const [conTiempo, setConTiempo] = useState(false);
  const [minutos, setMinutos] = useState('30');
  const [correccion, setCorreccion] = useState<'inmediata' | 'final'>('final');
  const [barajar, setBarajar] = useState(true);
  const [error, setError] = useState('');
  const [generando, setGenerando] = useState(false);

  const elegidos = useMemo(() => bancos.filter((b) => bankIds.includes(b.id)), [bancos, bankIds]);
  const disponibles = elegidos.reduce((s, b) => s + b.preguntas, 0);
  const maxOrden = Math.max(1, ...elegidos.map((b) => b.maxOrden ?? 0));
  const temasDisponibles = useMemo(
    () => [...new Set(elegidos.flatMap((b) => b.temas ?? []))].sort(),
    [elegidos],
  );

  function alternar<T>(lista: T[], v: T, set: (l: T[]) => void) {
    set(lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);
  }

  /** Atajo: aleatorias, sin tiempo, corrección al final. */
  async function generarRapido(n: number) {
    setError('');
    setGenerando(true);
    const cfg: ConfigTest = {
      bankIds, criterio: 'aleatorio', count: n, minutos: null,
      correccion: 'final', barajarPreguntas: true,
    };
    try {
      onGenerado(await api('/api/practice/tests', { method: 'POST', auth: true, body: JSON.stringify(cfg) }), cfg);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo generar el test');
    } finally {
      setGenerando(false);
    }
  }

  async function generar() {
    setError('');
    setGenerando(true);
    const cfg: ConfigTest = {
      bankIds,
      criterio,
      rangoDesde: criterio === 'rango' ? Number(desde) : undefined,
      rangoHasta: criterio === 'rango' ? Number(hasta) : undefined,
      temas: criterio === 'tema' ? temas : undefined,
      count: Number(count),
      minutos: conTiempo ? Number(minutos) : null,
      correccion,
      barajarPreguntas: barajar,
    };
    try {
      onGenerado(await api('/api/practice/tests', { method: 'POST', auth: true, body: JSON.stringify(cfg) }), cfg);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo generar el test');
    } finally {
      setGenerando(false);
    }
  }

  const puedeGenerar = bankIds.length > 0
    && Number(count) > 0
    && (criterio !== 'tema' || temas.length > 0)
    && (criterio !== 'rango' || (Number(desde) > 0 && Number(hasta) >= Number(desde)));

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Configura tu test</div>
        <div className="card-subtitle">Cada paso ajusta de dónde salen las preguntas y cómo lo harás</div>
      </div>

      {error && <p className="alert alert-error">{error}</p>}

      {/* Atajo: elegido el banco, un clic y a responder. Es lo que se usa a
          diario; el asistente completo queda para cuando se quiere afinar. */}
      <div style={{ background: 'var(--gray-100)', borderRadius: 10, padding: 14, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}>Generación rápida</div>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>
          Aleatorias del banco elegido, sin tiempo y con corrección al final.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[10, 20, 50, 100].map((n) => (
            <button key={n} type="button" className="btn btn-primary btn-small press"
              disabled={bankIds.length === 0 || generando}
              onClick={() => generarRapido(n)}>
              {n} preguntas
            </button>
          ))}
        </div>
        {bankIds.length === 0 && (
          <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>Elige abajo al menos un banco.</p>
        )}
      </div>

      {/* 1 · Bancos */}
      <Paso n={1} titulo="¿De qué bancos?">
        <div style={{ display: 'grid', gap: 8 }}>
          {bancos.map((b) => (
            <label key={b.id} style={{
              display: 'flex', gap: 10, alignItems: 'flex-start', padding: 11, borderRadius: 10, cursor: 'pointer',
              border: bankIds.includes(b.id) ? '2px solid var(--primary-dark)' : '1px solid var(--gray-300)',
              background: bankIds.includes(b.id) ? 'var(--gray-100)' : '#fff',
            }}>
              <input type="checkbox" checked={bankIds.includes(b.id)}
                onChange={() => alternar(bankIds, b.id, setBankIds)} style={{ marginTop: 3 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14.5 }}>{b.name}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  {b.preguntas} preguntas · {b.vistas} ya vistas
                  {b.temas?.length > 0 && ` · ${b.temas.length} materias`}
                </div>
              </div>
            </label>
          ))}
        </div>
        {bankIds.length > 1 && (
          <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
            Con varios bancos, las preguntas se mezclan entre todos ellos.
          </p>
        )}
      </Paso>

      {/* 2 · Criterio */}
      <Paso n={2} titulo="¿Qué preguntas?">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {([
            ['aleatorio', 'Aleatorias'],
            ['rango', 'Por rango de numeración'],
            ['tema', 'Por materia'],
          ] as const).map(([v, txt]) => (
            <button key={v} type="button" className={`tab ${criterio === v ? 'active' : ''}`}
              style={{ flex: 'unset', padding: '7px 12px' }} onClick={() => setCriterio(v)}>
              {txt}
            </button>
          ))}
        </div>

        {criterio === 'rango' && (
          <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <label className="form-label" htmlFor="t-desde">Desde la</label>
                <input id="t-desde" className="form-input" inputMode="numeric" style={{ width: 110 }}
                  value={desde} onChange={(e) => setDesde(e.target.value)} />
              </div>
              <div>
                <label className="form-label" htmlFor="t-hasta">Hasta la</label>
                <input id="t-hasta" className="form-input" inputMode="numeric" style={{ width: 110 }}
                  value={hasta} onChange={(e) => setHasta(e.target.value)} />
              </div>
            </div>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
              Es el número de la pregunta dentro del banco, el mismo que figura en el documento oficial.
              {elegidos.length > 0 && ` Hay numeración hasta la ${maxOrden}.`}
            </p>
          </>
        )}

        {criterio === 'tema' && (
          temasDisponibles.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>Los bancos elegidos no tienen materias definidas.</p>
          ) : (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {temasDisponibles.map((t) => (
                <button key={t} type="button" onClick={() => alternar(temas, t, setTemas)}
                  className={`btn btn-small ${temas.includes(t) ? 'btn-primary' : 'btn-outline'}`}>
                  {t}
                </button>
              ))}
            </div>
          )
        )}
      </Paso>

      {/* 3 · Número */}
      <Paso n={3} titulo="¿Cuántas preguntas?">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="form-input" inputMode="numeric" style={{ width: 110 }}
            value={count} onChange={(e) => setCount(e.target.value)} />
          {[10, 20, 50, 100].map((n) => (
            <button key={n} type="button" className="btn btn-outline btn-small" onClick={() => setCount(String(n))}>{n}</button>
          ))}
        </div>
        {elegidos.length > 0 && (
          <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
            Disponibles en los bancos elegidos: {disponibles}. Si pides más de las que cumplen el criterio,
            el test se genera con las que haya y se te avisa.
          </p>
        )}
      </Paso>

      {/* 4 · Tiempo */}
      <Paso n={4} titulo="¿Con tiempo límite?">
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14.5, marginBottom: 8 }}>
          <input type="checkbox" checked={conTiempo} onChange={(e) => setConTiempo(e.target.checked)} />
          Poner un tiempo máximo
        </label>
        {conTiempo && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="form-input" inputMode="numeric" style={{ width: 110 }}
              value={minutos} onChange={(e) => setMinutos(e.target.value)} />
            <span className="muted" style={{ fontSize: 14 }}>minutos</span>
            <span className="muted" style={{ fontSize: 12.5 }}>
              (ritmo real: {(Number(minutos) / Math.max(1, Number(count))).toFixed(1)} min por pregunta)
            </span>
          </div>
        )}
      </Paso>

      {/* 5 · Corrección */}
      <Paso n={5} titulo="¿Cuándo quieres la corrección?">
        <div style={{ display: 'grid', gap: 8 }}>
          <Opcion activo={correccion === 'inmediata'} onClick={() => setCorreccion('inmediata')}
            titulo="Tras cada respuesta"
            texto="Ves la correcta y su justificación al momento, con la referencia al documento oficial. Ideal para estudiar." />
          <Opcion activo={correccion === 'final'} onClick={() => setCorreccion('final')}
            titulo="Al terminar"
            texto="Contestas todo y corriges al final, como en el examen real." />
        </div>
      </Paso>

      {/* 6 · Barajado */}
      <Paso n={6} titulo="¿Barajar las preguntas?">
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14.5 }}>
          <input type="checkbox" checked={barajar} onChange={(e) => setBarajar(e.target.checked)} style={{ marginTop: 3 }} />
          <span>
            Barajar el orden de las preguntas, para poder repetir el test sin memorizar la secuencia.
            <span className="muted" style={{ display: 'block', fontSize: 12.5, marginTop: 3 }}>
              Sin barajar, las preguntas salen en el orden del documento oficial.
              <strong> Las opciones de cada pregunta nunca se reordenan</strong>: la A sigue siendo la A.
            </span>
          </span>
        </label>
      </Paso>

      <button className="btn btn-primary btn-full press" style={{ marginTop: 8 }}
        onClick={generar} disabled={!puedeGenerar || generando}>
        {generando ? 'Generando…' : 'Generar el test'}
      </button>
    </div>
  );
}

function Paso({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--gray-100)' }}>
      <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 10 }}>
        <span style={{
          width: 24, height: 24, borderRadius: '50%', background: 'var(--primary-dark)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0,
        }}>{n}</span>
        <strong style={{ fontSize: 15 }}>{titulo}</strong>
      </div>
      {children}
    </div>
  );
}

function Opcion({ activo, onClick, titulo, texto }: { activo: boolean; onClick: () => void; titulo: string; texto: string }) {
  return (
    <button type="button" onClick={onClick} style={{
      textAlign: 'left', padding: 12, borderRadius: 10, cursor: 'pointer', background: activo ? 'var(--gray-100)' : '#fff',
      border: activo ? '2px solid var(--primary-dark)' : '1px solid var(--gray-300)',
    }}>
      <div style={{ fontWeight: 600, fontSize: 14.5 }}>{titulo}</div>
      <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{texto}</div>
    </button>
  );
}
