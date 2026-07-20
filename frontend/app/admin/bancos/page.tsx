'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { api, ApiError, downloadFile } from '@/lib/api';
import { adminNav } from '@/lib/nav';
import { BankFilters, FILTROS_VACIOS, type FiltrosBanco, type Facetas } from '@/components/BankFilters';
import { BankQuestionList } from '@/components/BankQuestionList';
import { COMUNIDADES, CATEGORIAS } from '@/lib/sanidad';

interface Bank {
  id: string;
  name: string;
  kind: string;
  comunidad_autonoma: string | null;
  anio: number | null;
  categoria_profesional: string | null;
  official: boolean;
  questions: string;
  sim_questions: number | null;
  sim_minutes: number | null;
  sim_pass_pct: number | null;
  visibility: 'privado' | 'publico';
  mine: boolean;
  canManage: boolean;
}

const INSTITUCIONES = ['ERC', 'AHA', 'PNRCP', 'ILCOR', 'Cruz Roja', 'Otra'];
const POBLACIONES = ['Niños de 6 a 12 años', 'Jóvenes de 13 a 17 años', 'Adultos +18 años', 'Sanitarios'];

/**
 * Las dos dimensiones del banco se etiquetan según el tipo:
 *  RCP        → Institución (desplegable) + Población objetivo (desplegable)
 *  Formativo  → Especialidad + Tema
 *  OPE/MIR/Otro → Comunidad autónoma + Categoría profesional (+ oficiales y simulacro)
 */
function shapeFor(kind: string) {
  if (kind === 'rcp') {
    return { d1: 'Institución', d2: 'Población objetivo', o1: INSTITUCIONES, o2: POBLACIONES, o2Grupos: null, official: false, sim: false };
  }
  if (kind === 'formativo') {
    return { d1: 'Especialidad', d2: 'Tema', o1: null, o2: null, o2Grupos: null, official: false, sim: false };
  }
  return { d1: 'Comunidad autónoma', d2: 'Categoría profesional', o1: COMUNIDADES, o2: null, official: true, sim: true, o2Grupos: CATEGORIAS };
}

export default function BancosPage() {
  const user = useSession(['super_admin', 'profesor', 'auditor'], '/login/admin');
  const [banks, setBanks] = useState<Bank[]>([]);
  const [filtros, setFiltros] = useState<FiltrosBanco>({ ...FILTROS_VACIOS });
  const [facetas, setFacetas] = useState<Facetas | null>(null);
  const [total, setTotal] = useState(0);
  const [verPreguntasDe, setVerPreguntasDe] = useState<Bank | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Formulario (sirve para crear y para editar)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('rcp');
  const [anio, setAnio] = useState('');
  const [dim1, setDim1] = useState('');
  const [dim2, setDim2] = useState('');
  const [official, setOfficial] = useState(false);
  const [visibility, setVisibility] = useState<'privado' | 'publico'>('privado');
  const [simQ, setSimQ] = useState('');
  const [simMin, setSimMin] = useState('');
  const [simPass, setSimPass] = useState('');

  // Importar preguntas
  const [selBank, setSelBank] = useState('');
  const [json, setJson] = useState('');
  const [archivo, setArchivo] = useState('');
  const [importando, setImportando] = useState(false);
  const [temas, setTemas] = useState<Array<{ tema: string; questions: string }>>([]);
  const [impMsg, setImpMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const shape = shapeFor(kind);

  async function load() {
    try {
      const qs = new URLSearchParams();
      if (filtros.kind) qs.set('kind', filtros.kind);
      if (filtros.dim1) qs.set('dim1', filtros.dim1);
      if (filtros.dim2) qs.set('dim2', filtros.dim2);
      if (filtros.anio) qs.set('anio', filtros.anio);
      if (filtros.visibility) qs.set('visibility', filtros.visibility);
      if (filtros.mine) qs.set('mine', '1');
      if (filtros.conPreguntas) qs.set('conPreguntas', '1');
      if (filtros.q) qs.set('q', filtros.q);
      const r = await api<{ banks: Bank[]; total: number; facetas: Facetas }>(
        `/api/banks?${qs.toString()}`, { auth: true },
      );
      setBanks(r.banks);
      setFacetas(r.facetas);
      setTotal(r.total);
    } catch { /* ignore */ }
  }
  // Los filtros se resuelven en el servidor, así que recargamos al cambiarlos.
  useEffect(() => { if (user) load(); /* eslint-disable-next-line */ }, [user, filtros]);

  function resetForm() {
    setEditingId(null); setName(''); setKind('rcp'); setAnio('');
    setDim1(''); setDim2(''); setOfficial(false); setSimQ(''); setSimMin(''); setSimPass('');
  }

  function startEdit(b: Bank) {
    setEditingId(b.id);
    setName(b.name); setKind(b.kind); setAnio(b.anio?.toString() ?? ''); setVisibility(b.visibility ?? 'privado');
    setDim1(b.comunidad_autonoma ?? ''); setDim2(b.categoria_profesional ?? '');
    setOfficial(b.official);
    setSimQ(b.sim_questions?.toString() ?? ''); setSimMin(b.sim_minutes?.toString() ?? ''); setSimPass(b.sim_pass_pct?.toString() ?? '');
    setMsg(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const s = shapeFor(kind);
    // Los campos que no aplican a este tipo se envían en null para limpiarlos.
    const body = {
      // El servidor exige un nombre; si se deja vacío se marca como pendiente y
      // se sustituye por el del archivo en cuanto se importe.
      name: name.trim() || 'Sin nombre',
      kind,
      anio: anio ? Number(anio) : null,
      comunidadAutonoma: dim1 || null,
      categoriaProfesional: dim2 || null,
      official: s.official ? official : false,
      simQuestions: s.sim && simQ ? Number(simQ) : null,
      simMinutes: s.sim && simMin ? Number(simMin) : null,
      simPassPct: s.sim && simPass ? Number(simPass) : null,
    };
    try {
      if (editingId) {
        await api(`/api/banks/${editingId}`, { method: 'PATCH', auth: true, body: JSON.stringify(body) });
        setMsg({ ok: true, text: 'Banco actualizado ✅' });
      } else {
        await api('/api/banks', { method: 'POST', auth: true, body: JSON.stringify(body) });
        setMsg({ ok: true, text: 'Banco creado ✅' });
      }
      resetForm();
      load();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Error' });
    }
  }

  async function removeBank(b: Bank) {
    if (!confirm(`¿Borrar el banco «${b.name}» y sus ${b.questions} preguntas? Esta acción no se puede deshacer.`)) return;
    try {
      await api(`/api/banks/${b.id}`, { method: 'DELETE', auth: true });
      if (selBank === b.id) setSelBank('');
      if (editingId === b.id) resetForm();
      load();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Error al borrar' });
    }
  }

  async function download(b: Bank) {
    try { await downloadFile(`/api/banks/${b.id}/export`, `${b.name}.json`); } catch { /* ignore */ }
  }

  async function loadTemas(id: string) {
    setSelBank(id); setImpMsg(null);
    try {
      setTemas((await api<{ temas: Array<{ tema: string; questions: string }> }>(`/api/public/banks/${id}/temas`)).temas);
    } catch { setTemas([]); }
  }

  /**
   * Lee el archivo elegido y, si el banco quedó sin nombre, le pone el del
   * archivo: es lo que el usuario espera y ahorra un paso en cada importación.
   */
  async function cargarArchivo(file: File | undefined) {
    if (!file) return;
    setImpMsg(null);
    try {
      const texto = await file.text();
      JSON.parse(texto); // se valida aquí para avisar antes de enviar nada
      setJson(texto);
      setArchivo(file.name);

      const banco = banks.find((b) => b.id === selBank);
      const sinNombre = !banco?.name || /^sin nombre$/i.test(banco.name);
      if (banco && sinNombre) {
        const limpio = file.name.replace(/\.json$/i, '').replace(/[_-]+/g, ' ').trim();
        await api(`/api/banks/${banco.id}`, { method: 'PATCH', auth: true, body: JSON.stringify({ name: limpio }) });
        load();
        setImpMsg({ ok: true, text: `Archivo cargado. El banco pasa a llamarse «${limpio}».` });
        return;
      }
      setImpMsg({ ok: true, text: 'Archivo cargado. Pulsa «Importar preguntas» para añadirlas.' });
    } catch {
      setImpMsg({ ok: false, text: 'El archivo no contiene un JSON válido' });
    }
  }

  async function importJson() {
    setImportando(true);
    setImpMsg(null);
    let parsed: unknown;
    try { parsed = JSON.parse(json); } catch { setImpMsg({ ok: false, text: 'JSON no válido' }); setImportando(false); return; }
    if (!Array.isArray(parsed)) { setImpMsg({ ok: false, text: 'Debe ser una lista [ ... ]' }); setImportando(false); return; }
    try {
      const r = await api<{ created: number; duplicadas: number; total: number; errors: Array<{ fila: number }>; posibleReimport: boolean }>(`/api/banks/${selBank}/import`, { method: 'POST', auth: true, body: JSON.stringify({ questions: parsed }) });
      const partes = [`Creadas ${r.created}/${r.total}`];
      if (r.duplicadas > 0) partes.push(`${r.duplicadas} duplicadas omitidas`);
      if (r.errors.length) partes.push(`errores en filas: ${r.errors.map((e) => e.fila).join(', ')}`);
      if (r.posibleReimport) partes.push('⚠️ Ninguna pregunta nueva: parece que este banco ya estaba importado');
      setImpMsg({ ok: r.errors.length === 0 && !r.posibleReimport, text: partes.join(' · ') });
      setJson(''); setArchivo(''); loadTemas(selBank); load();
    } catch (err) {
      setImpMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Error' });
    } finally {
      setImportando(false);
    }
  }

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  return (
    <AppShell
      user={user}
      title="Bancos de preguntas"
      nav={adminNav(user.role, '/admin/bancos')}
    >
      <div className="grid grid-2">
        {/* Crear / editar */}
        <div className="card animate-in">
          <div className="card-header">
            <div className="card-title">{editingId ? 'Editar banco' : 'Nuevo banco'}</div>
            {editingId && <button className="btn btn-outline btn-small" onClick={resetForm}>Cancelar edición</button>}
          </div>
          {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}
          <form onSubmit={submitForm}>
            <div className="form-group">
              <label className="form-label" htmlFor="b-nombre">Nombre</label>
              <input id="b-nombre" className="form-input" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Si lo dejas vacío, se usará el nombre del archivo" />
              <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Opcional: al importar un archivo sin nombre puesto, el banco tomará el del archivo.
              </p>
            </div>

            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="form-select" value={kind} onChange={(e) => { setKind(e.target.value); setDim1(''); setDim2(''); }}>
                  <option value="rcp">RCP</option>
                  <option value="formativo">Formativo</option>
                  <option value="ope">OPE</option>
                  <option value="mir">MIR</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Año</label>
                <input className="form-input" type="number" value={anio} onChange={(e) => setAnio(e.target.value)} title="Año de publicación de la fuente usada" />
              </div>
            </div>

            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">{shape.d1}</label>
                {shape.o1 ? (
                  <select className="form-select" value={dim1} onChange={(e) => setDim1(e.target.value)}>
                    <option value="">—</option>
                    {shape.o1.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input className="form-input" value={dim1} onChange={(e) => setDim1(e.target.value)} />
                )}
              </div>
              <div className="form-group">
                <label className="form-label">{shape.d2}</label>
                {shape.o2Grupos ? (
                  /* Categorías sanitarias: agrupadas, porque la lista completa
                     sin agrupar es imposible de recorrer. */
                  <select className="form-select" value={dim2} onChange={(e) => setDim2(e.target.value)}>
                    <option value="">—</option>
                    {shape.o2Grupos.map((g) => (
                      <optgroup key={g.grupo} label={g.grupo}>
                        {g.opciones.map((o) => <option key={o} value={o}>{o}</option>)}
                      </optgroup>
                    ))}
                  </select>
                ) : shape.o2 ? (
                  <select className="form-select" value={dim2} onChange={(e) => setDim2(e.target.value)}>
                    <option value="">—</option>
                    {shape.o2.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input className="form-input" value={dim2} onChange={(e) => setDim2(e.target.value)} />
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Visibilidad</label>
              <select className="form-select" value={visibility} onChange={(e) => setVisibility(e.target.value as 'privado' | 'publico')}>
                <option value="privado">Privado — solo yo</option>
                <option value="publico">Público — otros profesores pueden usarlo como fuente (no descargarlo)</option>
              </select>
            </div>

            {shape.official && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, marginBottom: 12 }}>
                <input type="checkbox" checked={official} onChange={(e) => setOfficial(e.target.checked)} /> Preguntas oficiales (no pool)
              </label>
            )}

            {shape.sim && (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, margin: '4px 0 8px' }}>Simulacro (opcional, personalizado)</div>
                <div className="grid grid-3" style={{ gap: 10 }}>
                  <div className="form-group"><label className="form-label">Nº preguntas</label><input className="form-input" type="number" value={simQ} onChange={(e) => setSimQ(e.target.value)} placeholder="p.ej. 100" /></div>
                  <div className="form-group"><label className="form-label">Minutos</label><input className="form-input" type="number" value={simMin} onChange={(e) => setSimMin(e.target.value)} placeholder="p.ej. 120" /></div>
                  <div className="form-group"><label className="form-label">Corte %</label><input className="form-input" type="number" value={simPass} onChange={(e) => setSimPass(e.target.value)} placeholder="p.ej. 50" /></div>
                </div>
              </>
            )}

            <button className="btn btn-primary btn-full">{editingId ? 'Guardar cambios' : 'Crear banco'}</button>
          </form>
        </div>

        {/* Listado */}
        <div className="card animate-in">
          <div className="card-header"><div className="card-title">Bancos</div><div className="card-subtitle">{banks.length} de {total}</div></div>

          <BankFilters filtros={filtros} setFiltros={setFiltros} facetas={facetas} total={total} />
          <div className="table-responsive">
            <table>
              <thead><tr><th>Banco</th><th>Preguntas</th><th>Acciones</th></tr></thead>
              <tbody>
                {banks.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong>{b.name}</strong>
                      <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
                        {[
                          b.kind.toUpperCase(),
                          b.anio || null,
                          b.comunidad_autonoma,
                          b.categoria_profesional,
                          b.mine ? 'mío' : 'público',
                          b.visibility === 'privado' ? 'privado' : null,
                          b.official ? 'oficial' : null,
                          b.sim_questions ? `sim ${b.sim_questions}p/${b.sim_minutes ?? '∞'}min` : null,
                        ].filter(Boolean).join(' · ')}
                      </span>
                    </td>
                    <td>{b.questions}</td>
                    <td>
                      <div className="row-actions">
                        {b.canManage ? (
                          <>
                            <button className="link-action" onClick={() => setVerPreguntasDe(verPreguntasDe?.id === b.id ? null : b)} title="Ver y filtrar sus preguntas">Preguntas</button>
                            <button className="link-action" onClick={() => loadTemas(b.id)} title="Importar preguntas y ver temas">Importar</button>
                            <button className="link-action" onClick={() => startEdit(b)} title="Editar la ficha del banco">Editar</button>
                            <button className="link-action" onClick={() => download(b)} title="Descargar las preguntas en JSON">Descargar</button>
                            <button className="link-action danger" onClick={() => removeBank(b)} title="Borrar el banco y sus preguntas">Borrar</button>
                          </>
                        ) : (
                          <span className="muted" style={{ fontSize: 12 }} title="Puedes usarlo como fuente de preguntas en tus exámenes">
                            Solo como fuente
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {banks.length === 0 && <tr><td colSpan={3} className="muted">Sin bancos</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Preguntas del banco, con sus propios filtros */}
      {verPreguntasDe && <BankQuestionList bankId={verPreguntasDe.id} bankName={verPreguntasDe.name} />}

      {/* Importar preguntas al banco seleccionado */}
      {selBank && (
        <div className="card animate-in" style={{ marginTop: 24 }}>
          <div className="card-header">
            <div className="card-title">Importar preguntas (JSON)</div>
            <div className="card-subtitle">Cada pregunta: tema, text, options, correcta (A/B/C/D), explicacion</div>
          </div>
          {temas.length > 0 && <p style={{ fontSize: 13, marginBottom: 8 }}><strong>Temas actuales:</strong> {temas.map((t) => `${t.tema} (${t.questions})`).join(' · ')}</p>}
          {impMsg && <div className={`alert ${impMsg.ok ? 'alert-success' : 'alert-error'}`}>{impMsg.text}</div>}
          {/* Elegir archivo es lo normal; pegar el texto queda como alternativa
              para lotes pequeños. Un banco entero pegado a mano es inviable. */}
          <label className="btn btn-primary btn-full press" style={{ cursor: 'pointer', marginBottom: 10 }}>
            📂 Elegir archivo (.json)
            <input type="file" accept=".json,application/json" style={{ display: 'none' }}
              onChange={(e) => { cargarArchivo(e.target.files?.[0]); e.target.value = ''; }} />
          </label>

          {archivo && (
            <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
              Archivo: <strong>{archivo}</strong>
            </p>
          )}

          <details style={{ marginBottom: 8 }}>
            <summary className="link-action" style={{ fontSize: 13 }}>o pegar el contenido a mano</summary>
            <textarea className="form-input" style={{ height: 140, padding: 10, fontFamily: 'monospace', fontSize: 12, marginTop: 8 }}
              placeholder='[{"tema":"ICC","text":"...","options":["a","b","c"],"correcta":"B","explicacion":"..."}]'
              value={json} onChange={(e) => setJson(e.target.value)} />
          </details>

          <button className="btn btn-primary btn-small" onClick={importJson} disabled={!json.trim() || importando}>
            {importando ? 'Importando…' : 'Importar preguntas'}
          </button>
        </div>
      )}
    </AppShell>
  );
}
