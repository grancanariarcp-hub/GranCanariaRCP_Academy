'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { api, ApiError } from '@/lib/api';
import { adminNav } from '@/lib/nav';
import { AnonPracticeStats } from '@/components/AnonPracticeStats';
import { AdminPendientes } from '@/components/AdminPendientes';
import { PartnerBannerEditor } from '@/components/PartnerBannerEditor';

interface Stats {
  students: number;
  institutions: number;
  testResponses: number;
  institutionAdmins: number;
  averageScore: number | null;
}

interface Institution {
  id: string;
  name: string;
  code: string;
  contact_email: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  address: string | null;
  status: string;
  is_active: boolean;
  student_count: string;
}

interface Periodo { mes_anterior: string; mes_actual: string; anio: string; total: string }
interface Dash {
  personasRegistradas: Periodo; matriculas: Periodo; instituciones: Periodo; profesores: Periodo; bajas: Periodo;
  cursos: { publicados: string; matricula_abierta: string; total: string };
  desafios: { activos: string; total: string };
  actividad: { alumnos_con_curso: string; aprobados: string; horas: string };
  suscriptores: null; facturacion: null;
}

interface AuditLog {
  id: string;
  actor_type: string;
  action: string;
  entity: string | null;
  ip: string | null;
  created_at: string;
}

export default function AdminDashboard() {
  const user = useSession(['super_admin'], '/login/admin');
  const [stats, setStats] = useState<Stats | null>(null);
  const [dash, setDash] = useState<Dash | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pestana, setPestana] = useState('resumen'); // pestaña visible del panel

  // New-institution form
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [formMsg, setFormMsg] = useState<string | null>(null);
  // Ficha editable de una institución (modal)
  const [editInst, setEditInst] = useState<Institution | null>(null);
  const [editMsg, setEditMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [guardandoInst, setGuardandoInst] = useState(false);

  // Grupo de WhatsApp general de la plataforma
  const [waUrl, setWaUrl] = useState('');
  const [waMsg, setWaMsg] = useState<string | null>(null);
  // Prueba de correo saliente (Resend)
  const [mailMsg, setMailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [mailProbando, setMailProbando] = useState(false);
  // Filtros del registro de auditoría (pestaña Seguridad)
  const A_POR_PAGINA = 25;
  const [aq, setAq] = useState('');
  const [aActor, setAActor] = useState('');
  const [aAction, setAAction] = useState('');
  const [aDesde, setADesde] = useState('');
  const [aHasta, setAHasta] = useState('');
  const [aCurso, setACurso] = useState('');
  const [aPagina, setAPagina] = useState(1);
  const [logsTotal, setLogsTotal] = useState(0);
  const [acciones, setAcciones] = useState<string[]>([]);
  const [actores, setActores] = useState<string[]>([]);

  async function loadLogs() {
    const qs = new URLSearchParams();
    if (aq) qs.set('q', aq);
    if (aActor) qs.set('actorType', aActor);
    if (aAction) qs.set('action', aAction);
    if (aDesde) qs.set('desde', aDesde);
    if (aHasta) qs.set('hasta', aHasta);
    if (aCurso) qs.set('curso', aCurso);
    qs.set('limit', String(A_POR_PAGINA));
    qs.set('offset', String((aPagina - 1) * A_POR_PAGINA));
    try {
      const r = await api<{ logs: AuditLog[]; total: number; acciones: string[]; actores: string[] }>(
        `/api/admin/audit-logs?${qs.toString()}`, { auth: true },
      );
      setLogs(r.logs); setLogsTotal(r.total); setAcciones(r.acciones); setActores(r.actores);
    } catch { /* ignore */ }
  }
  // Carga con filtros al abrir Seguridad o cambiarlos (con retraso para el texto).
  useEffect(() => {
    if (!user || pestana !== 'seguridad') return;
    const t = setTimeout(loadLogs, aq ? 350 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pestana, aq, aActor, aAction, aDesde, aHasta, aCurso, aPagina]);

  async function loadAll() {
    try {
      const [s, inst, audit] = await Promise.all([
        api<Stats>('/api/admin/stats', { auth: true }),
        api<{ institutions: Institution[] }>('/api/admin/institutions', { auth: true }),
        api<{ logs: AuditLog[] }>('/api/admin/audit-logs?limit=8', { auth: true }),
      ]);
      setStats(s);
      setInstitutions(inst.institutions);
      setLogs(audit.logs);
      api<Dash>('/api/admin/dashboard', { auth: true }).then(setDash).catch(() => {});
      api<{ url: string | null }>('/api/admin/whatsapp', { auth: true })
        .then((r) => setWaUrl(r.url ?? '')).catch(() => {});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error cargando datos');
    }
  }

  useEffect(() => {
    if (user) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function guardarInstitucion(e: React.FormEvent) {
    e.preventDefault();
    if (!editInst) return;
    setEditMsg(null);
    setGuardandoInst(true);
    try {
      await api(`/api/admin/institutions/${editInst.id}`, {
        method: 'PATCH', auth: true,
        body: JSON.stringify({
          name: editInst.name,
          contactName: editInst.contact_name ?? '',
          contactEmail: editInst.contact_email ?? '',
          contactPhone: editInst.contact_phone ?? '',
          address: editInst.address ?? '',
        }),
      });
      setEditInst(null);
      loadAll();
    } catch (err) {
      setEditMsg({ ok: false, text: err instanceof ApiError ? err.message : 'No se pudo guardar' });
    } finally {
      setGuardandoInst(false);
    }
  }

  async function setInstitutionStatus(id: string, action: 'approve' | 'reject') {
    try {
      await api(`/api/admin/institutions/${id}/${action}`, { method: 'POST', auth: true });
      loadAll();
    } catch (err) {
      setFormMsg(err instanceof ApiError ? err.message : 'Error');
    }
  }

  async function saveWhatsapp(e: React.FormEvent) {
    e.preventDefault();
    setWaMsg(null);
    try {
      await api('/api/admin/whatsapp', { method: 'POST', auth: true, body: JSON.stringify({ url: waUrl }) });
      setWaMsg('Enlace guardado ✅');
    } catch (err) {
      setWaMsg(err instanceof ApiError ? err.message : 'Error');
    }
  }

  async function probarCorreo() {
    setMailMsg(null);
    setMailProbando(true);
    try {
      const r = await api<{ configurado: boolean; enviado: boolean; to?: string; mensaje?: string; error?: string }>(
        '/api/admin/email-test', { method: 'POST', auth: true },
      );
      if (!r.configurado) setMailMsg({ ok: false, text: r.mensaje ?? 'El correo no está configurado en el servidor todavía.' });
      else if (r.enviado) setMailMsg({ ok: true, text: `Enviado a ${r.to}. Revisa tu bandeja (y spam).` });
      else setMailMsg({ ok: false, text: `Resend rechazó el envío. Motivo: ${r.error ?? 'desconocido'}` });
    } catch (err) {
      setMailMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Error' });
    } finally {
      setMailProbando(false);
    }
  }

  async function createInstitution(e: React.FormEvent) {
    e.preventDefault();
    setFormMsg(null);
    setCreating(true);
    try {
      await api('/api/admin/institutions', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ name, code }),
      });
      setName('');
      setCode('');
      setFormMsg('Institución creada ✅');
      loadAll();
    } catch (err) {
      setFormMsg(err instanceof ApiError ? err.message : 'Error al crear');
    } finally {
      setCreating(false);
    }
  }

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  return (
    <AppShell
      user={user}
      title="Dashboard"
      nav={adminNav(user.role, '/admin')}
    >
      {error && <div className="alert alert-error">{error}</div>}

      {/* Pestañas del panel: se reparte el contenido para no hacer scroll */}
      <div className="ficha-tabs">
        {([
          ['resumen', 'Resumen'], ['captacion', 'Captación'], ['instituciones', 'Instituciones'],
          ['comunidad', 'Comunidad'], ['seguridad', 'Seguridad'],
        ] as Array<[string, string]>).map(([id, label]) => (
          <button key={id} className={`ficha-tab ${pestana === id ? 'ficha-tab-on' : ''}`} onClick={() => setPestana(id)}>
            {label}
          </button>
        ))}
      </div>

      {/* Captación por la zona gratuita: cuánta gente prueba y cuánta se queda */}
      {pestana === 'captacion' && <AnonPracticeStats />}

      {/* Venta cruzada con PÚLSAR (marketing, no toca cursos ni matrículas). */}
      {pestana === 'captacion' && <PartnerBannerEditor />}

      {/* KPIs */}
      {pestana === 'resumen' && (<>
      <div className="grid grid-4" data-tour="resumen" style={{ marginBottom: 16 }}>
        <Kpi value={dash?.personasRegistradas.total ?? '—'} label="Personas registradas" />
        <Kpi value={dash?.actividad.alumnos_con_curso ?? '—'} label="Alumnos matriculados" />
        <Kpi value={dash?.instituciones.total ?? '—'} label="Instituciones" />
        <Kpi value={dash?.profesores.total ?? '—'} label="Profesores" />
      </div>
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <Kpi value={dash ? `${dash.cursos.publicados}/${dash.cursos.total}` : '—'} label="Cursos activos / históricos" />
        <Kpi value={dash?.desafios.activos ?? '—'} label="Desafíos activos" />
        <Kpi value={dash?.actividad.horas ?? '—'} label="Horas de estudio" />
        <Kpi value={dash?.actividad.aprobados ?? '—'} label="Alumnos aprobados" />
      </div>
      {/* Suscriptores y facturación se mostrarán al activar el módulo de pagos;
          hasta entonces no se pintan dos tarjetas vacías con «—». */}
      <p className="muted" style={{ fontSize: 12.5, margin: '0 0 20px' }}>
        Suscriptores y facturación aparecerán aquí al activar el cobro.
      </p>

      {/* Lo que hay que mirar: interesados, uso compartido y pasarela (bajo los KPIs) */}
      <AdminPendientes />

      {/* Evolución por periodos */}
      <div className="card animate-in" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">Altas y bajas por periodo</div>
          <div className="card-subtitle">Meses naturales · «este mes» va del día 1 a hoy</div>
        </div>
        <div className="table-responsive">
          <table>
            <thead><tr><th></th><th>Mes anterior</th><th>Este mes</th><th>Este año</th><th>Total</th></tr></thead>
            <tbody>
              {([
                ['Personas registradas', dash?.personasRegistradas],
                ['Matrículas en cursos', dash?.matriculas],
                ['Instituciones', dash?.instituciones],
                ['Profesores', dash?.profesores],
                ['Bajas (cuentas borradas)', dash?.bajas],
              ] as Array<[string, Periodo | undefined]>).map(([label, p]) => (
                <tr key={label}>
                  <td><strong>{label}</strong></td>
                  <td>{p?.mes_anterior ?? '—'}</td>
                  <td><strong>{p?.mes_actual ?? '—'}</strong></td>
                  <td>{p?.anio ?? '—'}</td>
                  <td className="muted">{p?.total ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          Las cancelaciones de suscripción se sumarán a «bajas» cuando activemos el módulo de pagos.
        </p>
      </div>
      </>)}

      {pestana === 'instituciones' && (
      <div className="grid">
        {/* Institutions table */}
        <div className="card animate-in">
          <div className="card-header">
            <div className="card-title">Instituciones</div>
            <div className="card-subtitle">{institutions.length} registradas</div>
          </div>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Estado</th>
                  <th>Alumnos</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {institutions.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <button className="link-action" style={{ fontWeight: 600 }} onClick={() => { setEditInst(i); setEditMsg(null); }} title="Abrir ficha para editar">
                        {i.name}
                      </button>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {i.code}{i.contact_name ? ` · ${i.contact_name}` : ''}{i.contact_phone ? ` · ${i.contact_phone}` : ''}{i.contact_email ? ` · ${i.contact_email}` : ''}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${i.status === 'active' ? 'badge-success' : i.status === 'pending' ? 'badge-warning' : 'badge-danger'}`}>
                        {i.status === 'active' ? 'activa' : i.status === 'pending' ? 'pendiente' : 'rechazada'}
                      </span>
                    </td>
                    <td>{i.student_count}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {i.status === 'pending' && (
                          <>
                            <button className="btn btn-primary btn-small" onClick={() => setInstitutionStatus(i.id, 'approve')}>Aprobar</button>
                            <button className="btn btn-outline btn-small" onClick={() => setInstitutionStatus(i.id, 'reject')}>Rechazar</button>
                          </>
                        )}
                        <button className="btn btn-outline btn-small" onClick={() => { setEditInst(i); setEditMsg(null); }}>Editar</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {institutions.length === 0 && (
                  <tr><td colSpan={4} className="empty-state">Aún no hay instituciones registradas.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create institution (super_admin only) */}
        <div className="card animate-in">
          <div className="card-header">
            <div className="card-title">Nueva institución</div>
            <div className="card-subtitle">Solo Super Admin</div>
          </div>
          {user.role === 'super_admin' ? (
            <form onSubmit={createInstitution}>
              {formMsg && (
                <div className={`alert ${formMsg.includes('✅') ? 'alert-success' : 'alert-error'}`}>{formMsg}</div>
              )}
              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Código</label>
                <input className="form-input" placeholder="IES-GC-03" value={code} onChange={(e) => setCode(e.target.value)} required />
              </div>
              <button className="btn btn-primary btn-full" disabled={creating}>
                {creating ? 'Creando…' : 'Crear institución'}
              </button>
            </form>
          ) : (
            <div className="info-box">Necesitas rol Super Admin para crear instituciones.</div>
          )}
        </div>
      </div>
      )}

      {/* Ficha editable de institución */}
      {editInst && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setEditInst(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="card-header" style={{ marginBottom: 12 }}>
              <div className="card-title">Ficha de {editInst.name}</div>
            </div>
            {editMsg && <div className={`alert ${editMsg.ok ? 'alert-success' : 'alert-error'}`}>{editMsg.text}</div>}
            <form onSubmit={guardarInstitucion}>
              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input className="form-input" value={editInst.name} onChange={(e) => setEditInst({ ...editInst, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Código <span className="muted" style={{ fontWeight: 400 }}>· no editable</span></label>
                <input className="form-input" value={editInst.code} disabled />
              </div>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Persona de contacto</label>
                  <input className="form-input" value={editInst.contact_name ?? ''} onChange={(e) => setEditInst({ ...editInst, contact_name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input className="form-input" value={editInst.contact_phone ?? ''} onChange={(e) => setEditInst({ ...editInst, contact_phone: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Correo de contacto</label>
                <input className="form-input" type="email" value={editInst.contact_email ?? ''} onChange={(e) => setEditInst({ ...editInst, contact_email: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Dirección</label>
                <input className="form-input" value={editInst.address ?? ''} onChange={(e) => setEditInst({ ...editInst, address: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setEditInst(null)}>Cancelar</button>
                <button className="btn btn-primary" disabled={guardandoInst}>{guardandoInst ? 'Guardando…' : 'Guardar cambios'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grupo de WhatsApp de la comunidad */}
      {pestana === 'comunidad' && (
      <div className="card animate-in">
        <div className="card-header">
          <div className="card-title">Grupo de WhatsApp de la comunidad</div>
          <div className="card-subtitle">Se ofrece a los alumnos al entrar; unirse es voluntario</div>
        </div>
        {waMsg && <div className={`alert ${waMsg.includes('✅') ? 'alert-success' : 'alert-error'}`}>{waMsg}</div>}
        <form onSubmit={saveWhatsapp} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="form-input" style={{ flex: 1, minWidth: 260 }} placeholder="https://chat.whatsapp.com/..." value={waUrl} onChange={(e) => setWaUrl(e.target.value)} />
          <button className="btn btn-primary">Guardar</button>
        </form>
      </div>
      )}

      {/* Prueba de correo saliente: se envía a ti mismo, no molesta a alumnos */}
      {pestana === 'comunidad' && (
      <div className="card animate-in" style={{ marginTop: 24 }}>
        <div className="card-header">
          <div className="card-title">Correo saliente</div>
          <div className="card-subtitle">Comprueba que los emails salen (recordatorios, avisos…) sin molestar a nadie</div>
        </div>
        {mailMsg && <div className={`alert ${mailMsg.ok ? 'alert-success' : 'alert-error'}`}>{mailMsg.text}</div>}
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>Se enviará un correo de prueba a tu propia dirección.</p>
        <button className="btn btn-outline btn-small" onClick={probarCorreo} disabled={mailProbando}>
          {mailProbando ? 'Enviando…' : 'Enviar correo de prueba'}
        </button>
      </div>
      )}

      {/* Auditoría / seguridad */}
      {pestana === 'seguridad' && (
      <div className="card">
        <div className="card-header">
          <div className="card-title">Registro de auditoría</div>
          <div className="card-subtitle">{logsTotal} eventos · busca y filtra</div>
        </div>

        {/* Buscador + filtros del registro */}
        <div className="toolbar">
          <input className="form-input toolbar-buscar" placeholder="Buscar (acción, entidad, IP…)"
            value={aq} onChange={(e) => { setAq(e.target.value); setAPagina(1); }} />
          <select className="form-select" value={aActor} onChange={(e) => { setAActor(e.target.value); setAPagina(1); }}>
            <option value="">Cualquier actor</option>
            {actores.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select className="form-select" value={aAction} onChange={(e) => { setAAction(e.target.value); setAPagina(1); }}>
            <option value="">Cualquier acción</option>
            {acciones.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <input className="form-input" style={{ width: 'auto' }} type="date" title="Desde" value={aDesde} onChange={(e) => { setADesde(e.target.value); setAPagina(1); }} />
          <input className="form-input" style={{ width: 'auto' }} type="date" title="Hasta" value={aHasta} onChange={(e) => { setAHasta(e.target.value); setAPagina(1); }} />
          <input className="form-input" style={{ width: 150 }} placeholder="Código de curso" value={aCurso} onChange={(e) => { setACurso(e.target.value); setAPagina(1); }} />
          {(aq || aActor || aAction || aDesde || aHasta || aCurso) && (
            <button className="btn btn-outline btn-small" onClick={() => { setAq(''); setAActor(''); setAAction(''); setADesde(''); setAHasta(''); setACurso(''); setAPagina(1); }}>Limpiar</button>
          )}
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Actor</th>
                <th>Acción</th>
                <th>Entidad</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="muted" style={{ fontSize: 12 }}>{new Date(l.created_at).toLocaleString('es-ES')}</td>
                  <td>{l.actor_type}</td>
                  <td><span className="badge badge-primary">{l.action}</span></td>
                  <td className="muted" style={{ fontSize: 12 }}>{l.entity ?? '—'}</td>
                  <td className="muted" style={{ fontSize: 12 }}>{l.ip ?? '—'}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={5} className="muted">Sin eventos que coincidan</td></tr>}
            </tbody>
          </table>
        </div>

        {logsTotal > A_POR_PAGINA && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 12 }}>
            <button className="btn btn-outline btn-small" disabled={aPagina <= 1} onClick={() => setAPagina(aPagina - 1)}>← Anterior</button>
            <span className="muted" style={{ fontSize: 13 }}>Página {aPagina} de {Math.max(1, Math.ceil(logsTotal / A_POR_PAGINA))}</span>
            <button className="btn btn-outline btn-small" disabled={aPagina >= Math.ceil(logsTotal / A_POR_PAGINA)} onClick={() => setAPagina(aPagina + 1)}>Siguiente →</button>
          </div>
        )}
      </div>
      )}
    </AppShell>
  );
}

function Kpi({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
