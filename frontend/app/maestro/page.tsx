'use client';

import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';

export default function MaestroPage() {
  const user = useSession(['institution_teacher'], '/login');
  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  return (
    <AppShell user={user} title="Panel del maestro" nav={[{ label: 'Mis clases', href: '/maestro', active: true }]}>
      <div className="card animate-in">
        <div className="card-header"><div className="card-title">Mis clases</div></div>
        <div className="info-box">Muy pronto podrás <strong>crear clases</strong> y generar <strong>códigos/QR</strong> para que tus alumnos participen en los desafíos representando a tu institución.</div>
      </div>
    </AppShell>
  );
}
