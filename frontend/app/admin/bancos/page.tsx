'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { api, ApiError, downloadFile, uploadFile } from '@/lib/api';
import { adminNav } from '@/lib/nav';
import { BankFilters, FILTROS_VACIOS, type FiltrosBanco, type Facetas } from '@/components/BankFilters';
import { BankQuestionList } from '@/components/BankQuestionList';
import { BankPreview } from '@/components/BankPreview';
import { COMUNIDADES, CATEGORIAS } from '@/lib/sanidad';
import { useDebounced } from '@/hooks/useDebounced';

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
  visibility: 'privado' | 'publico' | 'restringido';
  course_id: string | null;
  course_title: string | null;
  mine: boolean;
  canManage: boolean;
}

interface CursoRef { id: string; title: string; codigo_curso: string | null }

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
  const [previewBank, setPreviewBank] = useState<Bank | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Formulario (sirve para crear y para editar)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('rcp');
  const [anio, setAnio] = useState('');
  const [dim1, setDim1] = useState('');
  const [dim2, setDim2] = useState('');
  const [official, setOfficial] = useState(false);
  const [visibility, setVisibility] = useState<'privado' | 'publico' | 'restringido'>('privado');
  // Curso al que se vincula el banco (opcional) y archivo a importar al crearlo.
  const [cursoId, setCursoId] = useState('');
  const [cursos, setCursos] = useState<CursoRef[]>([]);
  const [archivoNuevo, setArchivoNuevo] = useState<File | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null);
  const importCardRef = useRef<HTMLDivElement>(null);
  // Lista de acceso de un banco restringido (solo al editar uno que ya existe).
  const [accesoPersonas, setAccesoPersonas] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [accesoEmail, setAccesoEmail] = useState('');
  const [accesoMsg, setAccesoMsg] = useState<string | null>(null);
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
      if (filtros.cursoId) qs.set('courseId', filtros.cursoId);
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
  // Con retraso: el campo de texto cambia en cada tecla y sin esperar a que la
  // mano se detenga se lanzaba una petición por carácter.
  const filtrosEstables = useDebounced(filtros);
  useEffect(() => { if (user) load(); /* eslint-disable-next-line */ }, [user, filtrosEstables]);

  // Cursos del usuario, para vincular un banco y para el filtro por curso.
  useEffect(() => {
    if (!user) return;
    api<{ courses: CursoRef[] }>('/api/courses', { auth: true })
      .then((r) => setCursos(r.courses)).catch(() => {});
  }, [user]);

  function resetForm() {
    setEditingId(null); setName(''); setKind('rcp'); setAnio('');
    setDim1(''); setDim2(''); setOfficial(false); setSimQ(''); setSimMin(''); setSimPass('');
    setVisibility('privado'); setAccesoPersonas([]); setAccesoEmail(''); setAccesoMsg(null);
    setCursoId(''); setArchivoNuevo(null);
    if (archivoRef.current) archivoRef.current.value = '';
  }

  function startEdit(b: Bank) {
    setEditingId(b.id);
    setName(b.name); setKind(b.kind); setAnio(b.anio?.toString() ?? ''); setVisibility(b.visibility ?? 'privado');
    setDim1(b.comunidad_autonoma ?? ''); setDim2(b.categoria_profesional ?? '');
    setOfficial(b.official);
    setSimQ(b.sim_questions?.toString() ?? ''); setSimMin(b.sim_minutes?.toString() ?? ''); setSimPass(b.sim_pass_pct?.toString() ?? '');
    setCursoId(b.course_id ?? ''); setArchivoNuevo(null);
    setMsg(null); setAccesoMsg(null); setAccesoEmail('');
    if (b.visibility === 'restringido') cargarAcceso(b.id); else setAccesoPersonas([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- Lista de acceso de un banco restringido ---
  async function cargarAcceso(bankId: string) {
    try {
      const r = await api<{ personas: Array<{ id: string; name: string; email: string }> }>(`/api/banks/${bankId}/acceso`, { auth: true });
      setAccesoPersonas(r.personas);
    } catch { setAccesoPersonas([]); }
  }
  async function agregarAcceso() {
    if (!editingId || !accesoEmail.trim()) return;
    setAccesoMsg(null);
    try {
      await api(`/api/banks/${editingId}/acceso`, { method: 'POST', auth: true, body: JSON.stringify({ email: accesoEmail.trim() }) });
      setAccesoEmail('');
      cargarAcceso(editingId);
    } catch (err) {
      setAccesoMsg(err instanceof ApiError ? err.message : 'No se pudo añadir');
    }
  }
  async function quitarAcceso(userId: string) {
    if (!editingId) return;
    try {
      await api(`/api/banks/${editingId}/acceso/${userId}`, { method: 'DELETE', auth: true });
      cargarAcceso(editingId);
    } catch { /* ignore */ }
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const s = shapeFor(kind);
    // Si se adjunta archivo al crear y no hay nombre, se usa el del archivo.
    const nombreArchivo = archivoNuevo ? archivoNuevo.name.replace(/\.(json|xlsx?)$/i, '').replace(/[_-]+/g, ' ').trim() : '';
    // Los campos que no aplican a este tipo se envían en null para limpiarlos.
    const body = {
      name: name.trim() || nombreArchivo || 'Sin nombre',
      kind,
      anio: anio ? Number(anio) : null,
      comunidadAutonoma: dim1 || null,
      categoriaProfesional: dim2 || null,
      official: s.official ? official : false,
      simQuestions: s.sim && simQ ? Number(simQ) : null,
      simMinutes: s.sim && simMin ? Number(simMin) : null,
      simPassPct: s.sim && simPass ? Number(simPass) : null,
      visibility,
      courseId: cursoId || null,
    };
    try {
      // El banco destino: el que se edita, o uno nuevo.
      let bankId: string;
      if (editingId) {
        await api(`/api/banks/${editingId}`, { method: 'PATCH', auth: true, body: JSON.stringify(body) });
        bankId = editingId;
      } else {
        const r = await api<{ bank: { id: string } }>('/api/banks', { method: 'POST', auth: true, body: JSON.stringify(body) });
        bankId = r.bank.id;
      }
      const base = editingId ? 'Banco actualizado ✅' : 'Banco creado ✅';
      // Si se adjuntó un archivo, se SUMAN sus preguntas (al crear o al editar).
      // JSON → importador genérico del banco; Excel → plantilla RCP.
      if (archivoNuevo) {
        try {
          let imp: { created: number; total: number };
          if (/\.json$/i.test(archivoNuevo.name)) {
            const parsed = JSON.parse(await archivoNuevo.text());
            imp = await api<{ created: number; total: number }>(`/api/banks/${bankId}/import`,
              { method: 'POST', auth: true, body: JSON.stringify({ questions: parsed }) });
          } else {
            imp = await uploadFile<{ created: number; total: number }>('/api/questions/import', archivoNuevo, { bankId });
          }
          setMsg({ ok: true, text: `${base} · ${imp.created}/${imp.total} preguntas importadas` });
        } catch (e) {
          const motivo = e instanceof SyntaxError ? 'el JSON no es válido' : e instanceof ApiError ? e.message : 'error';
          setMsg({ ok: true, text: `${base}, pero el archivo no se pudo importar: ${motivo}. Usa «Importar» en su fila.` });
        }
      } else {
        setMsg({ ok: true, text: base });
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

  // Importa un archivo directamente al banco seleccionado (JSON → importador
  // genérico del banco; Excel → plantilla RCP). Un solo paso.
  async function importarDirecto(file: File | undefined) {
    if (!file || !selBank) return;
    setImpMsg(null); setImportando(true);
    try {
      let imp: { created: number; duplicadas?: number; total: number };
      if (/\.json$/i.test(file.name)) {
        const parsed = JSON.parse(await file.text());
        imp = await api(`/api/banks/${selBank}/import`, { method: 'POST', auth: true, body: JSON.stringify({ questions: parsed }) });
      } else {
        imp = await uploadFile(`/api/questions/import`, file, { bankId: selBank });
      }
      setArchivo(file.name);
      setImpMsg({ ok: true, text: `Importadas ${imp.created}/${imp.total}${imp.duplicadas ? ` · ${imp.duplicadas} duplicadas omitidas` : ''} ✅` });
      try { setTemas((await api<{ temas: Array<{ tema: string; questions: string }> }>(`/api/banks/${selBank}/temas`, { auth: true })).temas); } catch { /* ignore */ }
      load();
    } catch (e) {
      const motivo = e instanceof SyntaxError ? 'el JSON no es válido' : e instanceof ApiError ? e.message : 'error';
      setImpMsg({ ok: false, text: `No se pudo importar: ${motivo}` });
    } finally { setImportando(false); }
  }

  // Al abrir «Importar» de una fila, traer el panel a la vista (está más abajo).
  useEffect(() => {
    if (selBank && importCardRef.current) importCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selBank]);

  async function loadTemas(id: string) {
    setSelBank(id); setImpMsg(null);
    try {
      // Con sesión, no por la ruta pública: esta pantalla también abre bancos de
      // oposición, y la pública no los sirve por ser contenido de pago.
      setTemas((await api<{ temas: Array<{ tema: string; questions: string }> }>(
        `/api/banks/${id}/temas`, { auth: true })).temas);
    } catch { setTemas([]); }
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
      <div className="grid">
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
                  // Campo con sugerencias PERO libre: puedes elegir una de la lista
                  // o escribir la que quieras si no está.
                  <>
                    <input className="form-input" list="dim1-sugerencias" value={dim1}
                      onChange={(e) => setDim1(e.target.value)} placeholder="Elige o escribe la tuya" />
                    <datalist id="dim1-sugerencias">
                      {shape.o1.map((o) => <option key={o} value={o} />)}
                    </datalist>
                  </>
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
              <select className="form-select" value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)}>
                <option value="privado">Privado — solo yo</option>
                <option value="publico">Público — cualquier profesor puede usarlo como fuente (no descargarlo)</option>
                <option value="restringido">Restringido — solo los profesores que yo elija</option>
              </select>
            </div>

            {/* Lista de acceso: solo tiene sentido sobre un banco que ya existe. */}
            {visibility === 'restringido' && (
              <div className="info-box" style={{ marginBottom: 12 }}>
                {!editingId ? (
                  <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                    Guarda primero el banco y vuelve a abrirlo para elegir a qué profesores das acceso.
                  </p>
                ) : (
                  <>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Profesores con acceso</div>
                    {accesoPersonas.length === 0 ? (
                      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>Aún no has dado acceso a nadie. Solo tú lo ves.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                        {accesoPersonas.map((p) => (
                          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 13 }}>
                            <span>{p.name} <span className="muted">· {p.email}</span></span>
                            <button type="button" className="link-action danger" onClick={() => quitarAcceso(p.id)}>Quitar</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {accesoMsg && <div className="alert alert-error" style={{ fontSize: 13 }}>{accesoMsg}</div>}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input className="form-input" style={{ flex: 1 }} type="email" placeholder="email del profesor"
                        value={accesoEmail} onChange={(e) => setAccesoEmail(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarAcceso(); } }} />
                      <button type="button" className="btn btn-outline btn-small" onClick={agregarAcceso}>Añadir</button>
                    </div>
                  </>
                )}
              </div>
            )}

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

            <div className="form-group">
              <label className="form-label">Curso vinculado (opcional)</label>
              <select className="form-select" value={cursoId} onChange={(e) => setCursoId(e.target.value)}>
                <option value="">— Sin curso —</option>
                {cursos.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}{c.codigo_curso ? ` · ${c.codigo_curso}` : ''}</option>
                ))}
              </select>
              <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Sirve para filtrar tus bancos por curso. No obliga a nada: el banco puede usarse en cualquier examen.
              </p>
            </div>

            {/* Subir un archivo de preguntas desde el equipo (Excel o JSON), tanto
                al crear como al editar: al editar SUMA preguntas al banco. */}
            <div className="form-group">
              <label className="form-label">{editingId ? 'Sumar preguntas desde archivo (opcional)' : 'Preguntas desde archivo (opcional)'}</label>
              <input ref={archivoRef} className="form-input" type="file" accept=".xlsx,.json,application/json"
                onChange={(e) => setArchivoNuevo(e.target.files?.[0] ?? null)} />
              <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                <strong>JSON</strong> genérico (tema, text, options, correcta, explicacion) o <strong>Excel</strong> con la
                plantilla RCP. {editingId ? 'Se añaden a las que ya tiene.' : 'Se importan al crear el banco.'} {archivoNuevo && <strong>{archivoNuevo.name}</strong>}
              </p>
            </div>

            <button className="btn btn-primary btn-full">{editingId ? 'Guardar cambios' : 'Crear banco'}</button>
          </form>
        </div>

        {/* Listado */}
        <div className="card animate-in">
          <div className="card-header"><div className="card-title">Bancos</div><div className="card-subtitle">{banks.length} de {total}</div></div>

          <BankFilters filtros={filtros} setFiltros={setFiltros} facetas={facetas} total={total} cursos={cursos} />
          <div className="table-responsive">
            <table>
              <thead><tr><th>Banco</th><th>Preguntas</th><th>Acciones</th></tr></thead>
              <tbody>
                {banks.map((b) => (
                  <Fragment key={b.id}>
                  <tr>
                    <td>
                      <strong>{b.name}</strong>
                      <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
                        {[
                          b.kind.toUpperCase(),
                          b.anio || null,
                          b.comunidad_autonoma,
                          b.categoria_profesional,
                          b.course_title ? `📚 ${b.course_title}` : null,
                          b.mine ? 'mío' : null,
                          b.mine
                            ? (b.visibility === 'privado' ? 'privado' : b.visibility === 'restringido' ? 'restringido' : 'público')
                            : (b.visibility === 'restringido' ? 'compartido conmigo' : 'público'),
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
                            <button className="link-action" onClick={() => setPreviewBank(b)} title="Recorrer las preguntas como las ve el alumno">Vista previa</button>
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
                  {verPreguntasDe?.id === b.id && (
                    <tr>
                      <td colSpan={3} style={{ background: 'var(--gray-50)', padding: 12 }}>
                        {/* Las preguntas del banco, justo debajo de su fila. */}
                        <BankQuestionList bankId={b.id} bankName={b.name} />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
                {banks.length === 0 && <tr><td colSpan={3} className="muted">Sin bancos</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Importar preguntas al banco seleccionado */}
      {selBank && (
        <div ref={importCardRef} className="card animate-in" style={{ marginTop: 24 }}>
          <div className="card-header">
            <div className="card-title">Sumar preguntas a «{banks.find((b) => b.id === selBank)?.name ?? 'este banco'}»</div>
            <div className="card-subtitle">JSON genérico (tema, text, options, correcta, explicacion) o Excel con la plantilla RCP</div>
          </div>
          {temas.length > 0 && <p style={{ fontSize: 13, marginBottom: 8 }}><strong>Temas actuales:</strong> {temas.map((t) => `${t.tema} (${t.questions})`).join(' · ')}</p>}
          {impMsg && <div className={`alert ${impMsg.ok ? 'alert-success' : 'alert-error'}`}>{impMsg.text}</div>}
          {/* Elegir archivo IMPORTA directamente (un solo paso). */}
          <label className={`btn btn-primary btn-full press ${importando ? 'disabled' : ''}`} style={{ cursor: importando ? 'wait' : 'pointer', marginBottom: 10 }}>
            {importando ? 'Importando…' : '📂 Elegir archivo (.json o .xlsx) e importar'}
            <input type="file" accept=".json,application/json,.xlsx" style={{ display: 'none' }} disabled={importando}
              onChange={(e) => { importarDirecto(e.target.files?.[0]); e.target.value = ''; }} />
          </label>

          {archivo && !impMsg && (
            <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Archivo: <strong>{archivo}</strong></p>
          )}

          <details style={{ marginBottom: 8 }}>
            <summary className="link-action" style={{ fontSize: 13 }}>o pegar el JSON a mano</summary>
            <textarea className="form-input" style={{ height: 140, padding: 10, fontFamily: 'monospace', fontSize: 12, marginTop: 8 }}
              placeholder='[{"tema":"ICC","text":"...","options":["a","b","c"],"correcta":"B","explicacion":"..."}]'
              value={json} onChange={(e) => setJson(e.target.value)} />
            <button className="btn btn-primary btn-small" style={{ marginTop: 8 }} onClick={importJson} disabled={!json.trim() || importando}>
              {importando ? 'Importando…' : 'Importar lo pegado'}
            </button>
          </details>
        </div>
      )}

      {previewBank && (
        <BankPreview bankId={previewBank.id} bankName={previewBank.name} onClose={() => setPreviewBank(null)} />
      )}
    </AppShell>
  );
}
