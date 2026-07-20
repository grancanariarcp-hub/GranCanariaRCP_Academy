'use client';

import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { ProfilePanel } from '@/components/ProfilePanel';
import { adminNav } from '@/lib/nav';
import { PerfilDocenteAviso } from '@/components/PerfilDocenteAviso';
import { PerfilDocenteEditor } from '@/components/PerfilDocenteEditor';

export default function AdminProfilePage() {
  const user = useSession(['super_admin', 'institution_admin', 'profesor'], '/login');
  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  const nav = adminNav(user.role, '/admin/perfil');

  return (
    <AppShell user={user} title="Perfil" nav={nav}>
      {user.role === 'profesor' && <PerfilDocenteAviso />}
      {user.role === 'profesor' && <PerfilDocenteEditor />}
      <ProfilePanel user={user} />
    </AppShell>
  );
}
