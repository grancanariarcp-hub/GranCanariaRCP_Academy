'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { adminNav } from '@/lib/nav';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

interface DocRow {
  id: string;
  title: string;
  kind: 'erc' | 'pnrcp' | 'otro';
  size_bytes: number | null;
  pages: number | null;
  has_file: boolean;
  created_at: string;
  valid_until: string | null;
  autor: string | null;
  cursos: number | string;
  visibility: 'privado' | 'publico' | 'restringido';
  /** Subido por mí: solo entonces se puede borrar. */
  mio?: boolean;
}

const KIND_LABEL = { erc: 'ERC 2025', pnrcp: 'PNRCP', otro: 'Otro' } as const;
const VIS_LABEL: Record<string, string> = { privado: 'privado', publico: 'público', restringido: 'restringido' };
const POR_PAGINA = 25;

function humanSize(bytes: number | null): string {
  if (!bytes) return '—';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

/** Estado de vigencia según la fecha de caducidad (o su ausencia). */
function estadoDoc(d: DocRow): 'sin-archivo' | 'caducado' | 'vigente' {
  if (!d.has_file) return 'sin-archivo';
  if (d.valid_until && d.valid_until.slice(0, 10) < new Date().toISOString().slice(0, 10)) return 'caducado';
  return 'vigente';
}
const ESTADO_BADGE: Record<string, { txt: string; cls: string }> = {
  'vigente': { txt: 'vigente', cls: 'badge-success' },
  'caducado': { txt: 'caducado', cls: 'badge-danger' },
  'sin-archivo': { txt: 'sin archivo', cls: 'badge-warning' },
};

export default function DocumentosPage() {
  const user = useSession(['super_admin', 'profesor'], '/login/admin');
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'erc' | 'pnrcp' | 'otro'>('erc');
  const [validUntil, setValidUntil] = useState('');
  const [visibility, setVisibility] = useState<'privado' | 'publico' | 'restringido'>('privado');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [cuota, setCuota] = useState<{ usadoBytes: number; limiteMb: number; ilimitada: boolean; pct: number } | null>(null);
  // Filtros del listado: serán muchos documentos en poco tiempo.
  const [q, setQ] = useState('');
  const [fKind, setFKind] = useState<'' | 'erc' | 'pnrcp' | 'otro'>('');
  const [fEstado, setFEstado] = useState<'' | 'vigente' | 'caducado' | 'sin-archivo'>('');
  const [fAutor, setFAutor] = useState('');
  const [soloMios, setSoloMios] = useState(false);
  const [pagina, setPagina] = useState(1);
  // Edición en línea de la caducidad de un documento propio.
  const [editId, setEditId] = useState<string | null>(null);
  const [editHasta, setEditHasta] = useState('');
  // Edición de visibilidad + lista de acceso de un documento propio.
  const [visDocId, setVisDocId] = useState<string | null>(null);
  const [visValor, setVisValor] = useState<'privado' | 'publico' | 'restringido'>('privado');
  const [visPersonas, setVisPersonas] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [visEmail, setVisEmail] = useState('');
  const [visMsg, setVisMsg] = useState<string | null>(null);

  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const autores = Array.from(new Set(docs.map((d) => d.autor).filter((a): a is string => !!a))).sort();
  const docsFiltrados = docs.filter((d) =>
    (fKind === '' || d.kind === fKind)
    && (fEstado === '' || estadoDoc(d) === fEstado)
    && (fAutor === '' || d.autor === fAutor)
    && (!soloMios || d.mio)
    && (q.trim() === '' || norm(d.title).includes(norm(q))));
  const totalPaginas = Math.max(1, Math.ceil(docsFiltrados.length / POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const docsPagina = docsFiltrados.slice((paginaSegura - 1) * POR_PAGINA, paginaSegura * POR_PAGINA);

  async function guardarCaducidad(d: DocRow) {
    try {
      await api(`/api/documents/${d.id}`, { method: 'PATCH', auth: true, body: JSON.stringify({ validUntil: editHasta }) });
      setEditId(null);
      loadDocs();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'No se pudo guardar la caducidad' });
    }
  }

  // --- Visibilidad + lista de acceso de un documento propio ---
  function abrirVis(d: DocRow) {
    setVisDocId(d.id); setVisValor(d.visibility); setVisEmail(''); setVisMsg(null); setVisPersonas([]);
    if (d.visibility === 'restringido') cargarVisAcceso(d.id);
  }
  async function cambiarVis(nueva: 'privado' | 'publico' | 'restringido') {
    if (!visDocId) return;
    setVisValor(nueva); setVisMsg(null);
    try {
      await api(`/api/documents/${visDocId}`, { method: 'PATCH', auth: true, body: JSON.stringify({ visibility: nueva }) });
      if (nueva === 'restringido') cargarVisAcceso(visDocId);
      loadDocs();
    } catch (e) {
      setVisMsg(e instanceof Error ? e.message : 'No se pudo cambiar la visibilidad');
    }
  }
  async function cargarVisAcceso(docId: string) {
    try {
      const r = await api<{ personas: Array<{ id: string; name: string; email: string }> }>(`/api/documents/${docId}/acceso`, { auth: true });
      setVisPersonas(r.personas);
    } catch { setVisPersonas([]); }
  }
  async function agregarVisAcceso() {
    if (!visDocId || !visEmail.trim()) return;
    setVisMsg(null);
    try {
      await api(`/api/documents/${visDocId}/acceso`, { method: 'POST', auth: true, body: JSON.stringify({ email: visEmail.trim() }) });
      setVisEmail(''); cargarVisAcceso(visDocId);
    } catch (e) {
      setVisMsg(e instanceof Error ? e.message : 'No se pudo añadir');
    }
  }
  async function quitarVisAcceso(userId: string) {
    if (!visDocId) return;
    try {
      await api(`/api/documents/${visDocId}/acceso/${userId}`, { method: 'DELETE', auth: true });
      cargarVisAcceso(visDocId);
    } catch { /* ignore */ }
  }

  async function borrar(d: DocRow) {
    if (!confirm(`¿Borrar «${d.title}»? Se liberará el espacio que ocupa.`)) return;
    try {
      await api(`/api/documents/${d.id}`, { method: 'DELETE', auth: true });
      loadDocs();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'No se pudo borrar' });
    }
  }
  async function loadDocs() {
    try {
      const r = await api<{ documents: DocRow[]; cuota: { usadoBytes: number; limiteMb: number; ilimitada: boolean; pct: number } }>('/api/documents', { auth: true });
      setDocs(r.documents);
      setCuota(r.cuota);
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    if (user) loadDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!file) {
      setMsg({ ok: false, text: 'Elige un archivo PDF' });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', title);
      fd.append('kind', kind);
      fd.append('visibility', visibility);
      if (validUntil) fd.append('validUntil', validUntil);
      const res = await fetch(`${API_URL}/api/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.error ?? `Error ${res.status}`);
      }
      setMsg({ ok: true, text: 'Documento subido correctamente ✅' });
      setTitle('');
      setValidUntil('');
      setVisibility('privado');
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      loadDocs();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Error al subir' });
    } finally {
      setUploading(false);
    }
  }

  async function view(id: string) {
    try {
      const r = await api<{ url: string }>(`/api/documents/${id}/url`, { auth: true });
      window.open(r.url, '_blank');
    } catch {
      alert('No se pudo abrir el documento');
    }
  }

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  return (
    <AppShell
      user={user}
      title="Documentos"
      nav={adminNav(user.role, '/admin/documentos')}
    >
      <div className="grid">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Subir guía / manual (PDF)</div>
            <div className="card-subtitle">ERC 2025, PNRCP… — se guardan en tu almacén R2, no en la base de datos</div>
          </div>
          {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}
          <form onSubmit={onUpload}>
            <div className="form-group">
              <label className="form-label">Título</label>
              <input className="form-input" placeholder="Guía ERC 2025 - SVB" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-select" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                <option value="erc">ERC 2025</option>
                <option value="pnrcp">Plan Nacional RCP (PNRCP)</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Caducidad <span className="muted" style={{ fontWeight: 400 }}>(opcional)</span></label>
              <input className="form-input" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
              <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>Cuándo deja de estar vigente esta versión (p. ej. al publicarse una guía nueva). En blanco = sin caducidad.</p>
            </div>
            <div className="form-group">
              <label className="form-label">Visibilidad</label>
              <select className="form-select" value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)}>
                <option value="privado">Privado — solo yo</option>
                <option value="publico">Público — cualquier profesor puede enlazarlo en sus cursos</option>
                <option value="restringido">Restringido — solo profesores que yo elija</option>
              </select>
              {visibility === 'restringido' && (
                <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>Tras subirlo, elige a qué profesores das acceso desde la columna «Visibilidad» de la lista.</p>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Archivo PDF</label>
              <input ref={fileRef} className="form-input" style={{ paddingTop: 8 }} type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
            </div>
            <button className="btn btn-primary btn-full" disabled={uploading}>
              {uploading ? 'Subiendo…' : 'Subir documento'}
            </button>
          </form>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Documentos subidos</div>
            <div className="card-subtitle">
              {docsFiltrados.length === docs.length ? `${docs.length} documentos` : `${docsFiltrados.length} de ${docs.length}`}
            </div>
          </div>

          {/* Filtros: el listado crecerá rápido y sin ellos deja de ser manejable. */}
          <div className="toolbar">
            <input className="form-input toolbar-buscar" placeholder="Buscar por título…"
              value={q} onChange={(e) => { setQ(e.target.value); setPagina(1); }} />
            <select className="form-select" value={fKind} onChange={(e) => { setFKind(e.target.value as typeof fKind); setPagina(1); }}>
              <option value="">Todos los tipos</option>
              <option value="erc">{KIND_LABEL.erc}</option>
              <option value="pnrcp">{KIND_LABEL.pnrcp}</option>
              <option value="otro">{KIND_LABEL.otro}</option>
            </select>
            <select className="form-select" style={{ width: 'auto' }} value={fEstado} onChange={(e) => { setFEstado(e.target.value as typeof fEstado); setPagina(1); }}>
              <option value="">Cualquier estado</option>
              <option value="vigente">Vigentes</option>
              <option value="caducado">Caducados</option>
              <option value="sin-archivo">Sin archivo</option>
            </select>
            {autores.length > 1 && (
              <select className="form-select" style={{ width: 'auto' }} value={fAutor} onChange={(e) => { setFAutor(e.target.value); setPagina(1); }}>
                <option value="">Cualquier autor</option>
                {autores.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            )}
            <label className="muted" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={soloMios} onChange={(e) => { setSoloMios(e.target.checked); setPagina(1); }} /> Solo los míos
            </label>
          </div>

          {/* Espacio consumido: el almacenamiento tiene coste real, así que
              conviene que se vea antes de agotarlo, no al fallar una subida. */}
          {cuota && !cuota.ilimitada && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                <span className="muted">Espacio usado</span>
                <span className={cuota.pct >= 90 ? 'badge badge-warning' : 'muted'}>
                  {humanSize(cuota.usadoBytes)} de {cuota.limiteMb} MB
                </span>
              </div>
              <div style={{ height: 7, background: 'var(--gray-200)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${cuota.pct}%`, transition: 'width .3s ease',
                  background: cuota.pct >= 90 ? 'var(--danger)' : cuota.pct >= 70 ? 'var(--warning)' : 'var(--success)',
                }} />
              </div>
              {cuota.pct >= 80 && (
                <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Te queda poco espacio. Borra documentos que ya no uses o solicita una ampliación.
                </p>
              )}
            </div>
          )}
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Caducidad</th>
                  <th>Visibilidad</th>
                  <th>Autor</th>
                  <th>Usos</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {docsPagina.map((d) => {
                  const est = estadoDoc(d);
                  const editando = editId === d.id;
                  return (
                  <tr key={d.id}>
                    <td style={{ fontSize: 13 }}>{d.title}<div className="muted" style={{ fontSize: 11 }}>{humanSize(d.size_bytes)}{d.pages ? ` · ${d.pages} pág.` : ''}</div></td>
                    <td>
                      <span className="badge badge-primary">{KIND_LABEL[d.kind]}</span>
                    </td>
                    <td><span className={`badge ${ESTADO_BADGE[est].cls}`}>{ESTADO_BADGE[est].txt}</span></td>
                    <td style={{ fontSize: 12 }}>
                      {editando ? (
                        <span style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                          <input className="form-input" type="date" style={{ width: 140, padding: '4px 6px' }} value={editHasta} onChange={(e) => setEditHasta(e.target.value)} />
                          <button className="link-action" onClick={() => guardarCaducidad(d)}>Guardar</button>
                          <button className="link-action" onClick={() => setEditId(null)}>Cancelar</button>
                        </span>
                      ) : (
                        <span className="muted">
                          {d.valid_until ? d.valid_until.slice(0, 10) : '—'}
                          {d.mio && (
                            <>{' '}<button className="link-action" onClick={() => { setEditId(d.id); setEditHasta(d.valid_until ? d.valid_until.slice(0, 10) : ''); }}>editar</button></>
                          )}
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      <span className="muted">{VIS_LABEL[d.visibility]}</span>
                      {d.mio && (
                        <>{' '}<button className="link-action" onClick={() => (visDocId === d.id ? setVisDocId(null) : abrirVis(d))}>editar</button></>
                      )}
                    </td>
                    <td className="muted" style={{ fontSize: 12 }}>{d.autor ?? '—'}</td>
                    <td className="muted" style={{ fontSize: 12, textAlign: 'center' }}>{Number(d.cursos) || 0}</td>
                    <td>
                      <span className="row-actions" style={{ whiteSpace: 'nowrap' }}>
                        {d.has_file && <button className="link-action" onClick={() => view(d.id)}>Ver</button>}
                        {d.mio && <>{d.has_file && ' · '}<button className="link-action danger" onClick={() => borrar(d)}>Borrar</button></>}
                      </span>
                    </td>
                  </tr>
                  );
                })}
                {visDocId && docsPagina.some((d) => d.id === visDocId) && (
                  <tr>
                    <td colSpan={8} style={{ background: 'var(--gray-50)' }}>
                      <div style={{ padding: '10px 6px' }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                          <strong style={{ fontSize: 13 }}>Visibilidad del documento</strong>
                          <select className="form-select" style={{ width: 'auto' }} value={visValor} onChange={(e) => cambiarVis(e.target.value as typeof visValor)}>
                            <option value="privado">Privado — solo yo</option>
                            <option value="publico">Público — cualquier profesor</option>
                            <option value="restringido">Restringido — solo quien yo elija</option>
                          </select>
                          <button className="link-action" onClick={() => setVisDocId(null)}>cerrar</button>
                        </div>
                        {visMsg && <div className="alert alert-error" style={{ fontSize: 13 }}>{visMsg}</div>}
                        {visValor === 'restringido' && (
                          <div style={{ maxWidth: 480 }}>
                            {visPersonas.length === 0 ? (
                              <p className="muted" style={{ fontSize: 13, margin: '0 0 8px' }}>Aún no has dado acceso a nadie. Solo tú lo ves.</p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                                {visPersonas.map((p) => (
                                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 13 }}>
                                    <span>{p.name} <span className="muted">· {p.email}</span></span>
                                    <button className="link-action danger" onClick={() => quitarVisAcceso(p.id)}>Quitar</button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: 6 }}>
                              <input className="form-input" style={{ flex: 1 }} type="email" placeholder="email del profesor"
                                value={visEmail} onChange={(e) => setVisEmail(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarVisAcceso(); } }} />
                              <button className="btn btn-outline btn-small" onClick={agregarVisAcceso}>Añadir</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                {docsFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <div style={{ padding: '14px 4px' }}>
                        <strong>Todavía no hay documentos disponibles.</strong>
                        <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                          Aún no se ha publicado material común de la plataforma. Puedes subir aquí tus propias
                          guías en PDF con el formulario de la izquierda: quedarán disponibles para enlazarlas
                          como actividades en tus cursos.
                          {cuota && !cuota.ilimitada && ` Dispones de ${cuota.limiteMb} MB gratuitos.`}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación: el listado puede crecer mucho; se muestran de 25 en 25. */}
          {totalPaginas > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 12 }}>
              <button className="btn btn-outline btn-small" disabled={paginaSegura <= 1} onClick={() => setPagina(paginaSegura - 1)}>← Anterior</button>
              <span className="muted" style={{ fontSize: 13 }}>Página {paginaSegura} de {totalPaginas}</span>
              <button className="btn btn-outline btn-small" disabled={paginaSegura >= totalPaginas} onClick={() => setPagina(paginaSegura + 1)}>Siguiente →</button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
