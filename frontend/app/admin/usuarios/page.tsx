'use client';

import { useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { api, ApiError } from '@/lib/api';
import { adminNav } from '@/lib/nav';
import { Ayuda } from '@/components/ayuda/Ayuda';

/**
 * Buscador de cuentas para el super admin: llegar a cualquiera que se registre
 * y restablecerle la contraseña. El reseteo devuelve una clave temporal de un
 * solo uso que el super admin comunica a la persona; al entrar, ella define la
 * suya. (El envío automático por correo llegará cuando Resend esté verificado.)
 */

interface Cuenta {
  id: string;
  tipo: 'user' | 'student';
  nombre: string;
  email: string | null;
  detalle: string | null;
  es_menor: boolean;
}

const ROL_LABEL: Record<string, string> = {
  super_admin: 'Super admin', institution_admin: 'Admin institución', profesor: 'Profesor',
  institution_teacher: 'Maestro', auditor: 'Comisión CFC',
};

export default function UsuariosPage() {
  const user = useSession(['super_admin'], '/login/admin');
  const [q, setQ] = useState('');
  const [cuentas, setCuentas] = useState<Cuenta[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [reset, setReset] = useState<{ id: string; nombre: string; tempPassword: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function buscar(e?: React.FormEvent) {
    e?.preventDefault();
    if (q.trim().length < 2) { setMsg('Escribe al menos 2 letras'); return; }
    setMsg(null); setBuscando(true); setReset(null);
    try {
      const r = await api<{ accounts: Cuenta[] }>(`/api/admin/accounts?q=${encodeURIComponent(q.trim())}`, { auth: true });
      setCuentas(r.accounts);
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'No se pudo buscar');
    } finally {
      setBuscando(false);
    }
  }

  async function resetear(c: Cuenta) {
    if (c.es_menor) return;
    if (!confirm(`¿Restablecer la contraseña de ${c.nombre}? Se generará una clave temporal para dársela.`)) return;
    setMsg(null);
    try {
      const r = await api<{ tempPassword: string }>(`/api/admin/reset-password/${c.tipo}/${c.id}`, { method: 'POST', auth: true });
      setReset({ id: c.id, nombre: c.nombre, tempPassword: r.tempPassword });
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'No se pudo restablecer');
    }
  }

  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  return (
    <AppShell user={user} title="Usuarios" nav={adminNav(user.role, '/admin/usuarios')}>
      <div className="card" style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="card-header">
          <div className="card-title">Buscar cuentas <Ayuda tema="admin-usuarios" /></div>
          <div className="card-subtitle">Profesores, alumnos e instituciones. Busca por nombre, correo o documento.</div>
        </div>

        <form onSubmit={buscar} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input className="form-input" style={{ flex: 1 }} placeholder="Nombre, correo o DNI…"
            value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <button className="btn btn-primary" disabled={buscando}>{buscando ? 'Buscando…' : 'Buscar'}</button>
        </form>

        {msg && <div className="alert alert-error" style={{ fontSize: 13 }}>{msg}</div>}

        {reset && (
          <div className="alert alert-success" style={{ fontSize: 14 }}>
            <strong>Contraseña temporal de {reset.nombre}:</strong>{' '}
            <code style={{ fontSize: 16, background: '#fff', padding: '2px 8px', borderRadius: 5 }}>{reset.tempPassword}</code>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
              Dásela a la persona: al entrar con ella tendrá que definir su contraseña definitiva. Solo se muestra
              esta vez. (El envío automático por correo se activará cuando el email esté configurado.)
            </div>
          </div>
        )}

        {cuentas !== null && (
          cuentas.length === 0 ? (
            <p className="muted" style={{ fontSize: 14 }}>Nadie coincide con esa búsqueda.</p>
          ) : (
            <div className="table-responsive">
              <table className="table-plain">
                <thead><tr><th>Nombre</th><th>Correo</th><th>Tipo</th><th></th></tr></thead>
                <tbody>
                  {cuentas.map((c) => (
                    <tr key={`${c.tipo}-${c.id}`}>
                      <td>
                        {c.nombre}
                        {c.detalle && c.tipo === 'student' && <div className="muted" style={{ fontSize: 11.5 }}>{c.detalle}</div>}
                      </td>
                      <td className="muted" style={{ fontSize: 12.5 }}>{c.email ?? '—'}</td>
                      <td>
                        <span className="badge badge-primary">
                          {c.tipo === 'user' ? (ROL_LABEL[c.detalle ?? ''] ?? 'Staff') : c.es_menor ? 'Alumno (menor)' : 'Alumno'}
                        </span>
                      </td>
                      <td>
                        {c.es_menor ? (
                          <span className="muted" style={{ fontSize: 12 }}>entra con código</span>
                        ) : (
                          <button className="btn btn-outline btn-small" onClick={() => resetear(c)}>Restablecer contraseña</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </AppShell>
  );
}
