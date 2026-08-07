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
  /** Subido por mí: solo entonces se puede borrar. */
  mio?: boolean;
}

const KIND_LABEL = { erc: 'ERC 2025', pnrcp: 'PNRCP', otro: 'Otro' } as const;
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
      <div className="grid grid-2">
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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <input className="form-input" style={{ flex: 1, minWidth: 180 }} placeholder="Buscar por título…"
              value={q} onChange={(e) => { setQ(e.target.value); setPagina(1); }} />
            <select className="form-select" style={{ width: 'auto' }} value={fKind} onChange={(e) => { setFKind(e.target.value as typeof fKind); setPagina(1); }}>
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
                {docsFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={7}>
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
