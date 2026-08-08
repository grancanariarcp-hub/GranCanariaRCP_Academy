'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearSession, homeForRole, type SessionUser } from '@/lib/auth';
import { api } from '@/lib/api';
import { AppVersion } from '@/components/AppVersion';
import { NotificationBell } from '@/components/NotificationBell';
import { Ayuda } from '@/components/ayuda/Ayuda';
import { Tour } from '@/components/Tour';
import { GuiaPanel } from '@/components/GuiaPanel';

interface NavItem {
  label: string;
  href: string;
  active?: boolean;
}

export function AppShell({
  user,
  nav,
  title,
  children,
}: {
  user: SessionUser;
  nav: NavItem[];
  title: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const home = homeForRole(user.role);

  // Vuelve a la pantalla anterior real; si se llegó por enlace directo (sin
  // historial) cae al inicio del rol para no quedar en un callejón sin salida.
  function goBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push(home);
  }

  async function logout() {
    try {
      await api('/api/auth/logout', { method: 'POST', auth: true });
    } catch {
      /* ignore network errors on logout */
    }
    clearSession();
    router.push('/');
  }

  return (
    <div className="shell">
      {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <img src="/logo-emblem.png" alt="" />
          Gran Canaria RCP
        </div>
        <nav data-tour="nav">
          {nav.map((item) => (
            <a key={item.href} href={item.href} className={item.active ? 'active' : ''} onClick={() => setMenuOpen(false)}>
              {item.label}
            </a>
          ))}
          {/* El manual se añade aquí y no en cada menú: así lo tienen todos los
              roles sin que haya que acordarse de incluirlo al crear una página. */}
          <a href="/ayuda" onClick={() => setMenuOpen(false)} style={{ marginTop: 10, opacity: 0.85 }}>
            Manual de uso
          </a>
          {/* Repite la visita guiada de primera vez cuando se quiera. */}
          <button
            type="button"
            className="tour-lanzar"
            onClick={() => { setMenuOpen(false); window.dispatchEvent(new Event('iniciar-tour')); }}
          >
            🧭 Visita guiada
          </button>
          {/* Guías paso a paso de tareas (crear curso, acta, PÚLSAR): solo staff. */}
          {(user.role === 'profesor' || user.role === 'super_admin') && (
            <button
              type="button"
              className="tour-lanzar"
              onClick={() => { setMenuOpen(false); window.dispatchEvent(new Event('abrir-guias')); }}
            >
              📋 Guías paso a paso
            </button>
          )}
        </nav>
        <div style={{ marginTop: 24, paddingLeft: 12 }}>
          <AppVersion style={{ color: 'rgba(255,255,255,0.6)' }} />
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div className="topbar-left">
            <button className="menu-toggle" aria-label="Menú" onClick={() => setMenuOpen((v) => !v)}>☰</button>
            <button type="button" className="btn btn-outline btn-small topbar-nav-btn" onClick={goBack} title="Volver a la pantalla anterior">← <span className="nav-txt">Atrás</span></button>
            <a href={home} className="btn btn-outline btn-small topbar-nav-btn" title="Ir al inicio">⌂ <span className="nav-txt">Inicio</span></a>
            <h2>{title}</h2>
          </div>
          <div className="topbar-actions">
            {/* Ayuda de la pantalla actual: se resuelve sola por la ruta. */}
            <span data-tour="ayuda"><Ayuda variante="boton" /></span>
            <NotificationBell />
            <span className="topbar-user muted" style={{ fontSize: 13 }}>
              {user.name} · <span className="badge badge-primary">{roleLabel(user.role)}</span>
            </span>
            <button className="btn btn-outline btn-small" onClick={logout}>
              Salir
            </button>
          </div>
        </div>
        <div className="container">{children}</div>
      </div>
      <Tour />
      <GuiaPanel />
    </div>
  );
}

function roleLabel(role: SessionUser['role']): string {
  switch (role) {
    case 'super_admin':
      return 'Super Admin';
    case 'institution_admin':
      return 'Admin institución';
    case 'institution_teacher':
      return 'Maestro';
    case 'profesor':
      return 'Profesor';
    case 'auditor':
      return 'Comisión CFC';
    default:
      return 'Alumno';
  }
}
