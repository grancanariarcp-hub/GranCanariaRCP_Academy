'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearSession, type SessionUser } from '@/lib/auth';
import { api } from '@/lib/api';
import { AppVersion } from '@/components/AppVersion';
import { NotificationBell } from '@/components/NotificationBell';

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
        <nav>
          {nav.map((item) => (
            <a key={item.href} href={item.href} className={item.active ? 'active' : ''} onClick={() => setMenuOpen(false)}>
              {item.label}
            </a>
          ))}
        </nav>
        <div style={{ marginTop: 24, paddingLeft: 12 }}>
          <AppVersion style={{ color: 'rgba(255,255,255,0.6)' }} />
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <button className="menu-toggle" aria-label="Menú" onClick={() => setMenuOpen((v) => !v)}>☰</button>
            <h2>{title}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <NotificationBell />
            <span className="muted" style={{ fontSize: 13 }}>
              {user.name} · <span className="badge badge-primary">{roleLabel(user.role)}</span>
            </span>
            <button className="btn btn-outline btn-small" onClick={logout}>
              Salir
            </button>
          </div>
        </div>
        <div className="container">{children}</div>
      </div>
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
