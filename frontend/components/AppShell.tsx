'use client';

import { useRouter } from 'next/navigation';
import { clearSession, type SessionUser } from '@/lib/auth';
import { api } from '@/lib/api';
import { AppVersion } from '@/components/AppVersion';

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
      <aside className="sidebar">
        <div className="brand">
          <img src="/logo-emblem.png" alt="" />
          Gran Canaria RCP
        </div>
        <nav>
          {nav.map((item) => (
            <a key={item.href} href={item.href} className={item.active ? 'active' : ''}>
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
          <h2>{title}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
    case 'profesor':
      return 'Profesor';
    default:
      return 'Alumno';
  }
}
