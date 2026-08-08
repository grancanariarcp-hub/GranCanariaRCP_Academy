'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useSession } from '@/hooks/useSession';
import { adminNav } from '@/lib/nav';
import { api, ApiError, downloadFile } from '@/lib/api';
import { COMUNIDADES, CATEGORIAS } from '@/lib/sanidad';

/**
 * Convocatorias de oposición.
 *
 * Agrupan los bancos que corresponden a UNA oposición concreta, para que el
 * opositor vea solo lo suyo y no todo el catálogo de la plataforma.
 */

interface Banco { id: string; name: string; kind: string; preguntas?: number }
interface Convocatoria {
  id: string; name: string; comunidad: string | null; categoria: string | null;
  anio: number | null; descripcion: string | null; is_active: boolean;
  course_id: string | null; curso_titulo: string | null;
  curso_estado: string | null; curso_matricula: boolean | null;
  organismo: string | null; plazas: number | null; fecha_publicacion: string | null;
  plazo_desde: string | null; plazo_hasta: string | null; requisitos: string | null;
  bases_url: string | null; boletin_ref: string | null;
  bancos: Array<{ id: string; name: string; preguntas: number }>;
}
interface Curso { id: string; title: string; status: string }

const VACIA = {
  name: '', comunidad: '', categoria: '', anio: '', descripcion: '', courseId: '',
  organismo: '', plazas: '', fechaPublicacion: '', plazoDesde: '', plazoHasta: '',
  requisitos: '', basesUrl: '', boletinRef: '',
};
const soloFecha = (v: string | null) => (v ? String(v).slice(0, 10) : '');

export default function ConvocatoriasPage() {
  const user = useSession(['super_admin'], '/login/admin');
  const [items, setItems] = useState<Convocatoria[]>([]);
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [form, setForm] = useState({ ...VACIA });
  const [editando, setEditando] = useState<string | null>(null);
  const [asignando, setAsignando] = useState<string | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [c, b, cu] = await Promise.all([
        api<{ convocatorias: Convocatoria[] }>('/api/admin/convocatorias', { auth: true }),
        api<{ banks: Banco[] }>('/api/banks', { auth: true }),
        api<{ courses: Curso[] }>('/api/courses', { auth: true }),
      ]);
      setItems(c.convocatorias);
      setCursos(cu.courses);
      // Solo tienen sentido los bancos de oposición.
      setBancos(b.banks.filter((x) => x.kind === 'ope' || x.kind === 'mir'));
    } catch { /* la pantalla avisa al guardar */ }
  }, []);

  useEffect(() => { if (user) cargar(); }, [user, cargar]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const cuerpo = {
      name: form.name,
      comunidad: form.comunidad || null,
      categoria: form.categoria || null,
      anio: form.anio ? Number(form.anio) : null,
      descripcion: form.descripcion || null,
      courseId: form.courseId || null,
      organismo: form.organismo || null,
      plazas: form.plazas ? Number(form.plazas) : null,
      fechaPublicacion: form.fechaPublicacion || null,
      plazoDesde: form.plazoDesde || null,
      plazoHasta: form.plazoHasta || null,
      requisitos: form.requisitos || null,
      basesUrl: form.basesUrl || null,
      boletinRef: form.boletinRef || null,
    };
    try {
      if (editando) {
        await api(`/api/admin/convocatorias/${editando}`, { method: 'PATCH', auth: true, body: JSON.stringify(cuerpo) });
        setMsg({ ok: true, text: '✅ Convocatoria guardada' });
      } else {
        const r = await api<{ id: string; courseId: string; cursoCreado: boolean }>(
          '/api/admin/convocatorias', { method: 'POST', auth: true, body: JSON.stringify(cuerpo) },
        );
        setMsg({
          ok: true,
          text: r.cursoCreado
            ? '✅ Convocatoria creada junto a su curso, con la ficha y los precios listos. Asígnale los bancos y publícalo.'
            : '✅ Convocatoria guardada',
        });
      }
      setForm({ ...VACIA });
      setEditando(null);
      cargar();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'No se pudo guardar' });
    }
  }

  async function guardarBancos(id: string) {
    try {
      await api(`/api/admin/convocatorias/${id}/banks`, { method: 'PUT', auth: true, body: JSON.stringify({ bankIds: sel }) });
      setMsg({ ok: true, text: `✅ ${sel.length} banco(s) asignado(s)` });
      setAsignando(null);
      cargar();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'No se pudo asignar' });
    }
  }

  async function borrar(c: Convocatoria) {
    if (!confirm(`¿Eliminar «${c.name}»? Los bancos y sus preguntas no se borran.`)) return;
    await api(`/api/admin/convocatorias/${c.id}`, { method: 'DELETE', auth: true });
    cargar();
  }

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  return (
    <AppShell user={user} title="Convocatorias de oposición" nav={adminNav(user.role, '/admin/convocatorias')}>

      {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}

      <div className="grid">
        <div className="card">
          <div className="card-header">
            <div className="card-title">{editando ? 'Editar convocatoria' : 'Nueva convocatoria'}</div>
            {editando && (
              <button className="btn btn-outline btn-small" onClick={() => { setEditando(null); setForm({ ...VACIA }); }}>
                Cancelar
              </button>
            )}
          </div>
          <form onSubmit={guardar}>
            <div className="form-group">
              <label className="form-label" htmlFor="c-name">Nombre</label>
              <input id="c-name" className="form-input" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="OPE Servicio Canario de la Salud" />
            </div>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="c-com">Comunidad</label>
                <select id="c-com" className="form-select" value={form.comunidad}
                  onChange={(e) => setForm({ ...form, comunidad: e.target.value })}>
                  <option value="">Sin especificar</option>
                  {COMUNIDADES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="c-cat">Categoría</label>
                {/* Agrupadas: la lista completa sin agrupar es inmanejable. */}
                <select id="c-cat" className="form-select" value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                  <option value="">Sin especificar</option>
                  {CATEGORIAS.map((g) => (
                    <optgroup key={g.grupo} label={g.grupo}>
                      {g.opciones.map((o) => <option key={o} value={o}>{o}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="c-anio">Año</label>
              <input id="c-anio" className="form-input" type="number" value={form.anio}
                onChange={(e) => setForm({ ...form, anio: e.target.value })} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="c-curso">Curso que da acceso</label>
              <select id="c-curso" className="form-select" value={form.courseId}
                onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
                <option value="">Crear su curso automáticamente (recomendado)</option>
                {cursos.map((c) => <option key={c.id} value={c.id}>Usar «{c.title}» ({c.status})</option>)}
              </select>
              <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Dejándolo así se crea el curso con su ficha, su módulo de bienvenida y la escala de precios
                por suscripción (10 · 9 · 8 · 7 €/mes). Solo te quedará <strong>asignar los bancos</strong> y
                <strong> publicarlo</strong> desde su ficha.
              </p>
            </div>

            {/* Datos del documento de convocatoria (todos opcionales). */}
            <details style={{ marginBottom: 14 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                Documento de convocatoria <span className="muted" style={{ fontWeight: 400, fontSize: 12.5 }}>· datos para el PDF (opcional)</span>
              </summary>
              <div style={{ marginTop: 12 }}>
                <div className="form-group">
                  <label className="form-label">Organismo convocante</label>
                  <input className="form-input" value={form.organismo}
                    onChange={(e) => setForm({ ...form, organismo: e.target.value })}
                    placeholder="Servicio Canario de la Salud" />
                </div>
                <div className="grid grid-2" style={{ gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Plazas</label>
                    <input className="form-input" type="number" min={0} value={form.plazas}
                      onChange={(e) => setForm({ ...form, plazas: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Fecha de publicación</label>
                    <input className="form-input" type="date" value={form.fechaPublicacion}
                      onChange={(e) => setForm({ ...form, fechaPublicacion: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Plazo: desde</label>
                    <input className="form-input" type="date" value={form.plazoDesde}
                      onChange={(e) => setForm({ ...form, plazoDesde: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Plazo: hasta</label>
                    <input className="form-input" type="date" value={form.plazoHasta}
                      onChange={(e) => setForm({ ...form, plazoHasta: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Requisitos</label>
                  <textarea className="form-input" style={{ height: 70, padding: 10 }} value={form.requisitos}
                    onChange={(e) => setForm({ ...form, requisitos: e.target.value })}
                    placeholder="Titulación exigida, requisitos generales…" />
                </div>
                <div className="form-group">
                  <label className="form-label">Descripción</label>
                  <textarea className="form-input" style={{ height: 60, padding: 10 }} value={form.descripcion}
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
                </div>
                <div className="grid grid-2" style={{ gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Referencia del boletín</label>
                    <input className="form-input" value={form.boletinRef}
                      onChange={(e) => setForm({ ...form, boletinRef: e.target.value })}
                      placeholder="BOC nº 123, 01/03/2026" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Enlace a las bases</label>
                    <input className="form-input" value={form.basesUrl}
                      onChange={(e) => setForm({ ...form, basesUrl: e.target.value })}
                      placeholder="https://…" />
                  </div>
                </div>
                <p className="muted" style={{ fontSize: 12 }}>
                  El temario del PDF se genera solo, a partir de las materias de los bancos asignados.
                </p>
              </div>
            </details>

            <button className="btn btn-primary btn-full">{editando ? 'Guardar cambios' : 'Crear convocatoria'}</button>
          </form>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Convocatorias</div>
            <div className="card-subtitle">{items.length} publicadas</div>
          </div>

          {items.length === 0 ? (
            <p className="muted">
              Aún no hay convocatorias. Crea una y asígnale los bancos que la componen: el opositor solo verá
              esos.
            </p>
          ) : items.map((c) => (
            <div key={c.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--gray-100)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <strong>{c.name}</strong>
                  {!c.is_active && <span className="badge" style={{ marginLeft: 6 }}>inactiva</span>}
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    {[c.comunidad, c.categoria, c.anio].filter(Boolean).join(' · ') || 'sin datos'}
                  </div>
                </div>
                <div className="row-actions" style={{ whiteSpace: 'nowrap' }}>
                  <button className="link-action" onClick={() => {
                    setAsignando(asignando === c.id ? null : c.id);
                    setSel(c.bancos.map((b) => b.id));
                  }}>Bancos</button>{' · '}
                  <button className="link-action" onClick={() => {
                    setEditando(c.id);
                    setForm({
                      name: c.name, comunidad: c.comunidad ?? '', categoria: c.categoria ?? '',
                      anio: c.anio ? String(c.anio) : '', descripcion: c.descripcion ?? '',
                      courseId: c.course_id ?? '',
                      organismo: c.organismo ?? '', plazas: c.plazas != null ? String(c.plazas) : '',
                      fechaPublicacion: soloFecha(c.fecha_publicacion), plazoDesde: soloFecha(c.plazo_desde),
                      plazoHasta: soloFecha(c.plazo_hasta), requisitos: c.requisitos ?? '',
                      basesUrl: c.bases_url ?? '', boletinRef: c.boletin_ref ?? '',
                    });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}>Editar</button>{' · '}
                  <button className="link-action" onClick={() => downloadFile(`/api/admin/convocatorias/${c.id}/documento.pdf`, `convocatoria-${c.name}.pdf`)} title="Descargar el documento de convocatoria (PDF)">📄 Documento</button>{' · '}
                  <button className="link-action danger" onClick={() => borrar(c)}>Borrar</button>
                </div>
              </div>

              <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                {c.bancos.length === 0
                  ? '⚠️ Sin bancos asignados: el opositor no verá nada'
                  : `${c.bancos.length} banco(s) · ${c.bancos.reduce((s, b) => s + Number(b.preguntas), 0)} preguntas`}
              </div>

              {/* Dónde se publica y se cobra: en el curso, no aquí. */}
              <div style={{ fontSize: 12.5, marginTop: 4 }}>
                {!c.course_id ? (
                  <span className="muted">Abierta · sin curso asociado, cualquier usuario registrado la ve</span>
                ) : (
                  <>
                    Curso: <a className="link-action" href={`/admin/cursos/${c.course_id}`}>{c.curso_titulo}</a>
                    {' · '}
                    <span className={`badge ${c.curso_estado === 'publicado' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 11 }}>
                      {c.curso_estado}
                    </span>
                    {c.curso_estado === 'publicado' && (
                      <span className={`badge ${c.curso_matricula ? 'badge-success' : ''}`} style={{ fontSize: 11, marginLeft: 4 }}>
                        {c.curso_matricula ? 'matrícula abierta' : 'matrícula cerrada'}
                      </span>
                    )}
                    {c.curso_estado !== 'publicado' && (
                      <div className="muted" style={{ marginTop: 2 }}>
                        ⚠️ El curso está en borrador: publícalo desde su ficha para que aparezca en la oferta.
                      </div>
                    )}
                  </>
                )}
              </div>

              {asignando === c.id && (
                <div style={{ marginTop: 10, padding: 12, background: 'var(--gray-100)', borderRadius: 10 }}>
                  {bancos.length === 0 ? (
                    <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                      No hay bancos de tipo OPE o MIR. Créalos primero en Bancos de preguntas.
                    </p>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
                        {bancos.map((b) => (
                          <label key={b.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5 }}>
                            <input type="checkbox" checked={sel.includes(b.id)}
                              onChange={() => setSel(sel.includes(b.id) ? sel.filter((x) => x !== b.id) : [...sel, b.id])} />
                            {b.name}
                          </label>
                        ))}
                      </div>
                      <button className="btn btn-primary btn-small" onClick={() => guardarBancos(c.id)}>
                        Guardar asignación
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
