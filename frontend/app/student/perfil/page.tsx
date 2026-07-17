'use client';

import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { ProfilePanel } from '@/components/ProfilePanel';

export default function StudentProfilePage() {
  const user = useSession(['student'], '/login/menor');
  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  return (
    <AppShell
      user={user}
      title="Perfil"
      nav={[
        { label: 'Inicio', href: '/student' },
        { label: 'Perfil', href: '/student/perfil', active: true },
      ]}
    >
      <ProfilePanel user={user} />
    </AppShell>
  );
}
