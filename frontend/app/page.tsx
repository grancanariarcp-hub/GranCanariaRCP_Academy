import Link from 'next/link';
import { AppVersion } from '@/components/AppVersion';

export default function Home() {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/logo-horizontal.png" alt="Gran Canaria RCP" />
          <p>Plataforma de formación en reanimación cardiopulmonar</p>
        </div>

        <Link href="/login/student" className="btn btn-primary btn-full" style={{ marginBottom: 12 }}>
          Soy alumno
        </Link>
        <Link href="/login/admin" className="btn btn-outline btn-full">
          Acceso administración
        </Link>

        <p style={{ textAlign: 'center', marginTop: 20 }}>
          <AppVersion />
        </p>
      </div>
    </div>
  );
}
