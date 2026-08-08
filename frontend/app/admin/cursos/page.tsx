'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { api, ApiError } from '@/lib/api';
import { adminNav } from '@/lib/nav';

interface Course {
  id: string;
  title: string;
  tema: string | null;
  subtema: string | null;
  status: string;
  modality: string;
  modules: string;
  enrollment_open: boolean;
  ends_at: string | null;
  acta_closed_at: string | null;
  es_ope: boolean;
}

/** Un curso «pasado»: archivado o cuya fecha de fin ya quedó atrás. */
function esPasado(c: Course): boolean {
  return c.status === 'archivado' || (!!c.ends_at && c.ends_at < new Date().toISOString().slice(0, 10));
}
/** Terminó pero aún no se ha cerrado el acta: requiere acción del profesor. */
function pendienteActa(c: Course): boolean {
  return !c.es_ope && !c.acta_closed_at && esPasado(c);
}
interface Tax {
  id: string;
  label: string;
}

export default function CursosPage() {
  const user = useSession(['super_admin', 'profesor', 'auditor'], '/login/admin');
  const router = useRouter();

  const [courses, setCourses] = useState<Course[]>([]);
  const [temas, setTemas] = useState<Tax[]>([]);
  const [subtemas, setSubtemas] = useState<Tax[]>([]);
  const [publicos, setPublicos] = useState<Tax[]>([]);

  const [title, setTitle] = useState('');
  const [tema, setTema] = useState('');
  const [subtema, setSubtema] = useState('');
  const [durationHours, setDurationHours] = useState('');
  const [modality, setModality] = useState('online');
  const [publicoObjetivo, setPublicoObjetivo] = useState<string[]>([]);
  const [objetivoGeneral, setObjetivoGeneral] = useState('');
  const [objetivosEspecificos, setObjetivosEspecificos] = useState('');
  const [resumen, setResumen] = useState('');
  const [acreditacion, setAcreditacion] = useState('');
  const [cfc, setCfc] = useState('');
  const [cfcEnTramite, setCfcEnTramite] = useState(false);

  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [tipoNuevo, setTipoNuevo] = useState<'curso' | 'ope' | null>(null); // elección previa al crear
  const [paso, setPaso] = useState(0); // bloque visible del asistente
  const [vista, setVista] = useState<'activos' | 'pasados' | 'todos'>('activos');

  // Estado de cada bloque del asistente: verde cuando está completo, rojo cuando
  // le falta algo obligatorio. Solo el nombre es obligatorio para crear; el resto
  // se recomienda y se puede terminar después en la ficha.
  const bloques = [
    { titulo: 'Identificación', ok: title.trim().length >= 3, obligatorio: true, falta: 'el nombre del curso' },
    { titulo: 'Descripción', ok: resumen.trim().length > 0, obligatorio: false, falta: 'el resumen' },
    { titulo: 'Acreditación', ok: acreditacion.trim().length > 0, obligatorio: false, falta: 'la acreditación' },
  ];

  // Por defecto se ven los activos, pero los pendientes de acta se cuelan
  // siempre: son los que reclaman acción y no deben esconderse en «pasados».
  const cursosVisibles = courses.filter((c) => {
    if (vista === 'todos') return true;
    if (vista === 'pasados') return esPasado(c);
    return !esPasado(c) || pendienteActa(c);
  });
  const nPendientes = courses.filter(pendienteActa).length;

  async function load() {
    try {
      const [c, t] = await Promise.all([
        api<{ courses: Course[] }>('/api/courses', { auth: true }),
        api<{ temas: Tax[]; subtemas: Tax[]; publicos: Tax[] }>('/api/taxonomies', { auth: true }),
      ]);
      setCourses(c.courses);
      setTemas(t.temas);
      setSubtemas(t.subtemas);
      setPublicos(t.publicos);
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function togglePublico(label: string) {
    setPublicoObjetivo((prev) => (prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setSaving(true);
    try {
      const esOpe = tipoNuevo === 'ope';
      const created = await api<{ course: { id: string } }>('/api/courses', {
        method: 'POST',
        auth: true,
        body: JSON.stringify(esOpe ? { title, esOpe: true } : {
          title,
          tema: tema || undefined,
          subtema: subtema || undefined,
          durationHours: durationHours ? Number(durationHours) : undefined,
          modality,
          objetivoGeneral: objetivoGeneral || undefined,
          objetivosEspecificos: objetivosEspecificos || undefined,
          publicoObjetivo,
          resumen: resumen || undefined,
          acreditacion: acreditacion || undefined,
          cfc: cfc || undefined,
          cfcEnTramite,
        }),
      });
      // Ir directo a la edición: allí se sube la miniatura, se añaden imágenes y
      // contenido, y se publica/abre matrícula.
      router.push(`/admin/cursos/${created.course.id}`);
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Error al crear el curso' });
    } finally {
      setSaving(false);
    }
  }

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  const nav = adminNav(user.role, '/admin/cursos');

  return (
    <AppShell user={user} title="Cursos" nav={nav}>
      <div className="grid grid-2">
        {/* Crear */}
        <div className="card" data-tour="crear-curso-form">
          <div className="card-header">
            <div className="card-title">
              {tipoNuevo === null ? 'Crear nuevo' : tipoNuevo === 'ope' ? 'Nueva OPE' : 'Nuevo curso'}
            </div>
            <div className="card-subtitle">
              {tipoNuevo === 'ope'
                ? 'Generador de exámenes: sin temario, actas ni certificados'
                : tipoNuevo === 'curso'
                  ? 'Se crea en borrador con Bienvenida + Módulo 1'
                  : 'Elige qué quieres crear'}
            </div>
          </div>

          {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}

          {/* Elección previa e irreversible: un Curso y una OPE no comparten
              formulario. Se decide ANTES, no con una casilla a media página. */}
          {tipoNuevo === null && (
            <div style={{ display: 'grid', gap: 12 }}>
              <button type="button" className="card press" style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--gray-300)' }}
                onClick={() => setTipoNuevo('curso')}>
                <div style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>📘 Curso</div>
                <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                  Formación con temario, módulos, exámenes, asistencia y certificado. Puede solicitar CFC.
                </div>
              </button>
              <button type="button" className="card press" style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--gray-300)' }}
                onClick={() => setTipoNuevo('ope')}>
                <div style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>🎯 OPE / Simulacros</div>
                <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                  Generador de exámenes por bancos de preguntas, con estadísticas. Sin temario, actas ni certificados.
                </div>
              </button>
            </div>
          )}

          {tipoNuevo !== null && (
            <button type="button" className="link-action" style={{ marginBottom: 12 }} onClick={() => { setTipoNuevo(null); setMsg(null); }}>
              ← Cambiar tipo
            </button>
          )}

          {/* Formulario mínimo de OPE: el resto (bancos, precio, generador) se
              configura en su ficha tras crearla. */}
          {tipoNuevo === 'ope' && (
            <form onSubmit={onSubmit}>
              <div className="form-group">
                <label className="form-label">Nombre de la OPE *</label>
                <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="OPE Cardiología Canarias 2027" required autoFocus />
              </div>
              <button className="btn btn-primary btn-full" disabled={saving || title.trim().length < 3}>
                {saving ? 'Creando…' : 'Crear OPE'}
              </button>
              <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                Al crearla entrarás en su ficha: allí eliges sus bancos de preguntas, el precio y la configuración del generador de exámenes.
              </p>
            </form>
          )}

          {/* Asistente del Curso: pestañas verde/rojo, un bloque a la vez. */}
          {tipoNuevo === 'curso' && (
          <>
          <div className="wiz-tabs">
            {bloques.map((b, k) => {
              const estado = b.ok ? 'ok' : (b.obligatorio ? 'falta' : 'opc');
              return (
                <button type="button" key={b.titulo} onClick={() => setPaso(k)}
                  className={`wiz-tab ${paso === k ? 'sel' : ''} wiz-${estado}`}>
                  <span className="wiz-punto">{b.ok ? '✓' : b.obligatorio ? '✗' : '•'}</span>
                  {b.titulo}
                </button>
              );
            })}
          </div>

          <form onSubmit={onSubmit}>
            {paso === 0 && (
              <>
                <div className="form-group">
                  <label className="form-label">Nombre del curso *</label>
                  <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
                  {title.trim().length > 0 && title.trim().length < 3 && (
                    <p className="muted" style={{ fontSize: 12, marginTop: 4, color: 'var(--danger)' }}>Al menos 3 caracteres.</p>
                  )}
                </div>
                <div className="grid grid-2" style={{ gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Tema</label>
                    <select className="form-select" value={tema} onChange={(e) => setTema(e.target.value)}>
                      <option value="">—</option>
                      {temas.map((t) => <option key={t.id} value={t.label}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Subtema</label>
                    <select className="form-select" value={subtema} onChange={(e) => setSubtema(e.target.value)}>
                      <option value="">—</option>
                      {subtemas.map((t) => <option key={t.id} value={t.label}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-2" style={{ gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Duración (horas)</label>
                    <input className="form-input" type="number" min="0" step="0.5" value={durationHours} onChange={(e) => setDurationHours(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Modalidad</label>
                    <select className="form-select" value={modality} onChange={(e) => setModality(e.target.value)}>
                      <option value="online">Online</option>
                      <option value="mixto">Mixto</option>
                      <option value="presencial">Presencial</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {paso === 1 && (
              <>
                <div className="form-group">
                  <label className="form-label">Público objetivo</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {publicos.map((p) => (
                      <button type="button" key={p.id} onClick={() => togglePublico(p.label)}
                        className={`tab ${publicoObjetivo.includes(p.label) ? 'active' : ''}`}
                        style={{ flex: 'unset', padding: '8px 12px' }}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Resumen (para la ficha del curso)</label>
                  <textarea className="form-input" style={{ height: 70, padding: 10 }} placeholder="Qué se verá y por qué es relevante realizarlo" value={resumen} onChange={(e) => setResumen(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Objetivo general</label>
                  <textarea className="form-input" style={{ height: 60, padding: 10 }} value={objetivoGeneral} onChange={(e) => setObjetivoGeneral(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Objetivos específicos</label>
                  <textarea className="form-input" style={{ height: 60, padding: 10 }} value={objetivosEspecificos} onChange={(e) => setObjetivosEspecificos(e.target.value)} />
                </div>
              </>
            )}

            {paso === 2 && (
              <>
                <div className="grid grid-2" style={{ gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Acreditación</label>
                    <input className="form-input" placeholder="Institución que acredita" value={acreditacion} onChange={(e) => setAcreditacion(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">CFC</label>
                    <input className="form-input" placeholder="Ej.: 2,5 créditos (otorgados)" value={cfc} onChange={(e) => setCfc(e.target.value)} />
                  </div>
                </div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13.5, marginBottom: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={cfcEnTramite} onChange={(e) => setCfcEnTramite(e.target.checked)} style={{ marginTop: 3 }} />
                  <span>
                    <strong>Tramitar CFC</strong> — permite que la Comisión CFC vea este curso aunque aún no esté
                    publicado. Déjalo sin marcar si no está en trámite de acreditación.
                  </span>
                </label>
              </>
            )}

            {/* Navegación entre bloques + crear (habilitado en cuanto hay nombre válido) */}
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {paso > 0 && (
                <button type="button" className="btn btn-outline btn-small" onClick={() => setPaso(paso - 1)}>← Anterior</button>
              )}
              {paso < bloques.length - 1 && (
                <button type="button" className="btn btn-outline btn-small" onClick={() => setPaso(paso + 1)}>Siguiente →</button>
              )}
              <button className="btn btn-primary btn-small" style={{ marginLeft: 'auto' }} disabled={saving || !bloques[0].ok}>
                {saving ? 'Creando…' : 'Crear curso'}
              </button>
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              Solo el <strong>nombre</strong> es obligatorio para crear. Lo demás puedes completarlo ahora o después,
              en la ficha del curso, junto con la miniatura, el contenido y la publicación.
            </p>
          </form>
          </>
          )}
        </div>

        {/* Listado */}
        <div className="card" data-tour="lista-cursos">
          <div className="card-header">
            <div className="card-title">Mis cursos</div>
            <div className="card-subtitle">{cursosVisibles.length} cursos</div>
          </div>

          {nPendientes > 0 && (
            <div className="alert alert-error" style={{ fontSize: 13 }}>
              {nPendientes === 1 ? 'Hay 1 curso terminado sin cerrar el acta.' : `Hay ${nPendientes} cursos terminados sin cerrar el acta.`}
              {' '}Aparecen en rojo abajo.
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {([['activos', 'Activos'], ['pasados', 'Pasados'], ['todos', 'Todos']] as const).map(([v, label]) => (
              <button key={v} type="button" onClick={() => setVista(v)}
                className={`tab ${vista === v ? 'active' : ''}`} style={{ flex: 'unset', padding: '6px 14px' }}>
                {label}
              </button>
            ))}
          </div>

          <div className="table-responsive">
            <table>
              <thead>
                <tr><th>Curso</th><th>Tema</th><th>Módulos</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {cursosVisibles.map((c) => {
                  const rojo = pendienteActa(c);
                  return (
                    <tr key={c.id} style={rojo ? { background: '#fff5f5' } : undefined}>
                      <td style={rojo ? { borderLeft: '3px solid var(--danger)' } : undefined}>
                        {c.es_ope && <span className="badge badge-ope" style={{ marginRight: 6, fontSize: 10.5 }}>OPE</span>}
                        <Link href={`/admin/cursos/${c.id}`}>{c.title}</Link>
                        {rojo && <span className="badge badge-danger" style={{ marginLeft: 8, fontSize: 10.5 }}>Falta el acta</span>}
                      </td>
                      <td style={{ fontSize: 12 }}>{[c.tema, c.subtema].filter(Boolean).join(' · ') || '—'}</td>
                      <td>{c.modules}</td>
                      <td>
                        <span className={`badge ${c.status === 'publicado' ? 'badge-success' : c.status === 'archivado' ? '' : 'badge-warning'}`}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {cursosVisibles.length === 0 && (
                  <tr><td colSpan={4} className="muted">
                    {courses.length === 0 ? 'Aún no hay cursos' : 'No hay cursos en esta vista'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
