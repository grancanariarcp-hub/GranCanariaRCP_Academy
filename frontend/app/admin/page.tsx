'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { api, ApiError } from '@/lib/api';

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
  is_active: boolean;
  student_count: string;
}

interface AuditLog {
  id: string;
  actor_type: string;
  action: string;
  ip: string | null;
  created_at: string;
}

export default function AdminDashboard() {
  const user = useSession(['super_admin', 'institution_admin'], '/login/admin');
  const [stats, setStats] = useState<Stats | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  // New-institution form
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [formMsg, setFormMsg] = useState<string | null>(null);

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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error cargando datos');
    }
  }

  useEffect(() => {
    if (user) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
      nav={[
        { label: 'Resumen', href: '/admin', active: true },
        { label: 'Instituciones', href: '/admin' },
        { label: 'Administradores', href: '/admin' },
        { label: 'Auditoría', href: '/admin' },
      ]}
    >
      {error && <div className="alert alert-error">{error}</div>}

      {/* KPIs */}
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <Kpi value={stats?.students ?? '—'} label="Alumnos activos" />
        <Kpi value={stats?.institutions ?? '—'} label="Instituciones" />
        <Kpi value={stats?.testResponses ?? '—'} label="Respuestas de test" />
        <Kpi value={stats?.averageScore != null ? `${stats.averageScore}%` : '—'} label="Promedio global" />
      </div>

      <div className="grid grid-2">
        {/* Institutions table */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Instituciones</div>
            <div className="card-subtitle">{institutions.length} registradas</div>
          </div>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Código</th>
                  <th>Alumnos</th>
                </tr>
              </thead>
              <tbody>
                {institutions.map((i) => (
                  <tr key={i.id}>
                    <td>{i.name}</td>
                    <td><span className="badge badge-primary">{i.code}</span></td>
                    <td>{i.student_count}</td>
                  </tr>
                ))}
                {institutions.length === 0 && (
                  <tr><td colSpan={3} className="muted">Sin instituciones</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create institution (super_admin only) */}
        <div className="card">
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
