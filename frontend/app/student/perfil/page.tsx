'use client';

import { useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { AppShell } from '@/components/AppShell';
import { ProfilePanel } from '@/components/ProfilePanel';
import { MyRecognitions } from '@/components/MyRecognitions';
import { MySessions } from '@/components/MySessions';
import { MisDatos } from '@/components/MisDatos';
import { MisDatosPersonales } from '@/components/MisDatosPersonales';
import { MisCalificaciones } from '@/components/MisCalificaciones';

export default function StudentProfilePage() {
  const user = useSession(['student'], '/login/menor');
  const [tab, setTab] = useState('perfil');
  if (!user) return <div style={{ padding: 40 }}>Cargando…</div>;

  // El perfil apilaba cinco bloques pesados; se reparten en pestañas para no
  // tener que hacer scroll hasta abajo.
  const TABS: Array<[string, string]> = [
    ['perfil', 'Perfil'], ['calificaciones', 'Calificaciones'], ['datos', 'Mis datos'], ['reconocimientos', 'Reconocimientos'], ['sesiones', 'Sesiones'],
  ];

  return (
    <AppShell
      user={user}
      title="Perfil"
      nav={[
        { label: 'Inicio', href: '/student' },
        { label: 'Perfil', href: '/student/perfil', active: true },
      ]}
    >
      <div className="ficha-tabs">
        {TABS.map(([id, label]) => (
          <button key={id} className={`ficha-tab ${tab === id ? 'ficha-tab-on' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'perfil' && <ProfilePanel user={user} />}
      {tab === 'calificaciones' && <MisCalificaciones />}
      {tab === 'datos' && <><MisDatosPersonales /><MisDatos esAlumno={true} /></>}
      {tab === 'reconocimientos' && <MyRecognitions />}
      {tab === 'sesiones' && <MySessions />}
    </AppShell>
  );
}
