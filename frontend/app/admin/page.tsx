'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { api, ApiError } from '@/lib/api';
import { adminNav } from '@/lib/nav';
import { AnonPracticeStats } from '@/components/AnonPracticeStats';

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

  // New-institution form
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [formMsg, setFormMsg] = useState<string | null>(null);

  // Grupo de WhatsApp general de la plataforma
  const [waUrl, setWaUrl] = useState('');
  const [waMsg, setWaMsg] = useState<string | null>(null);

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

      {/* Captación por la zona gratuita: cuánta gente prueba y cuánta se queda */}
      <AnonPracticeStats />

      {/* KPIs */}
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
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
      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        <Kpi value="—" label="Suscriptores (con el módulo de pagos)" />
        <Kpi value="—" label="Facturación (con el módulo de pagos)" />
      </div>

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

      <div className="grid grid-2">
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
                      {i.name}
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
                      {i.status === 'pending' && (
                        <span style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-primary btn-small" onClick={() => setInstitutionStatus(i.id, 'approve')}>Aprobar</button>
                          <button className="btn btn-outline btn-small" onClick={() => setInstitutionStatus(i.id, 'reject')}>Rechazar</button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {institutions.length === 0 && (
                  <tr><td colSpan={4} className="muted">Sin instituciones</td></tr>
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

      {/* Audit logs */}
      <div className="card animate-in" style={{ marginTop: 24 }}>
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

      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <div className="card-title">Actividad reciente (auditoría)</div>
          <div className="card-subtitle">Últimos eventos de seguridad</div>
        </div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Actor</th>
                <th>Acción</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="muted">{new Date(l.created_at).toLocaleString('es-ES')}</td>
                  <td>{l.actor_type}</td>
                  <td><span className="badge badge-primary">{l.action}</span></td>
                  <td className="muted">{l.ip ?? '—'}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={4} className="muted">Sin eventos</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
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
