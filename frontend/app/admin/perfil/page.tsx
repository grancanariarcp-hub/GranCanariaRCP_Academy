'use client';

import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { ProfilePanel } from '@/components/ProfilePanel';

export default function AdminProfilePage() {
  const user = useSession(['super_admin', 'institution_admin', 'profesor'], '/login');
  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  const nav =
    user.role === 'super_admin'
      ? [
          { label: 'Resumen', href: '/admin' },
          { label: 'Cursos', href: '/admin/cursos' },
          { label: 'Preguntas', href: '/admin/preguntas' },
          { label: 'Documentos', href: '/admin/documentos' },
          { label: 'Profesores', href: '/admin/profesores' },
          { label: 'Perfil', href: '/admin/perfil', active: true },
        ]
      : [
          { label: 'Mis cursos', href: '/admin/cursos' },
          { label: 'Perfil', href: '/admin/perfil', active: true },
        ];

  return (
    <AppShell user={user} title="Perfil" nav={nav}>
      <ProfilePanel user={user} />
    </AppShell>
  );
}
