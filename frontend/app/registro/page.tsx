'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { saveSession, type SessionUser } from '@/lib/auth';
import { AppVersion } from '@/components/AppVersion';

type Role = 'alumno' | 'profesor' | 'institucion';

export default function RegistroPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>('alumno');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // comunes
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // profesor
  const [headline, setHeadline] = useState('');
  // alumno
  const [institutions, setInstitutions] = useState<Array<{ id: string; name: string }>>([]);
  const [institutionId, setInstitutionId] = useState('');
  // institución
  const [instName, setInstName] = useState('');
  const [instAddress, setInstAddress] = useState('');
  const [instContactName, setInstContactName] = useState('');
  const [instPhone, setInstPhone] = useState('');

  // RGPD: aceptación obligatoria + consentimientos opcionales y separados.
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [rankingConsent, setRankingConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  useEffect(() => {
    api<{ institutions: Array<{ id: string; name: string }> }>('/api/public/institutions')
      .then((r) => setInstitutions(r.institutions)).catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setDone(null); setLoading(true);
    try {
      if (role === 'profesor') {
        await api('/api/auth/professor/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password, headline: headline || undefined, acceptTerms, rankingConsent, marketingConsent }),
        });
        setDone('✅ Solicitud enviada. Un administrador validará tu cuenta de profesor. Después podrás acceder.');
      } else if (role === 'institucion') {
        await api('/api/auth/institution/register', {
          method: 'POST',
          body: JSON.stringify({
            name: instName, address: instAddress || undefined, contactName: instContactName || undefined,
            contactEmail: email, contactPhone: instPhone || undefined,
            adminName: name, adminEmail: email, adminPassword: password,
            acceptTerms, rankingConsent, marketingConsent,
          }),
        });
        setDone('✅ Institución registrada. La validaremos y podrás entrar con tu email para crear maestros y clases.');
      } else {
        const res = await api<{ token: string; user: SessionUser }>('/api/auth/student/register-public', {
          method: 'POST',
          body: JSON.stringify({ name, email, password, institutionId: institutionId || undefined, acceptTerms, rankingConsent, marketingConsent }),
        });
        saveSession(res.token, res.user);
        router.push('/student');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/logo-horizontal.png" alt="Gran Canaria RCP" />
          <h1>Crear cuenta</h1>
          <p>Elige cómo quieres registrarte</p>
        </div>

        <div className="tabs">
          <button type="button" className={`tab ${role === 'alumno' ? 'active' : ''}`} onClick={() => { setRole('alumno'); setDone(null); }}>Persona</button>
          <button type="button" className={`tab ${role === 'profesor' ? 'active' : ''}`} onClick={() => { setRole('profesor'); setDone(null); }}>Profesor</button>
          <button type="button" className={`tab ${role === 'institucion' ? 'active' : ''}`} onClick={() => { setRole('institucion'); setDone(null); }}>Institución</button>
        </div>

        {role === 'alumno' && <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>Participa en desafíos y práctica. Puedes representar a una institución.</p>}
        {role === 'profesor' && <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>Docente sanitario que imparte cursos en la plataforma (lo valida un administrador).</p>}
        {role === 'institucion' && <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>Colegio/instituto/academia. Podrás dar de alta <strong>maestros</strong> que crean clases de menores.</p>}

        {error && <div className="alert alert-error">{error}</div>}
        {done ? (
          <div className="alert alert-success">{done}</div>
        ) : (
          <form onSubmit={onSubmit}>
            {role === 'institucion' && (
              <>
                <div className="form-group">
                  <label className="form-label">Nombre de la institución</label>
                  <input className="form-input" value={instName} onChange={(e) => setInstName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Dirección</label>
                  <input className="form-input" value={instAddress} onChange={(e) => setInstAddress(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Persona de contacto</label>
                  <input className="form-input" value={instContactName} onChange={(e) => setInstContactName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Móvil de contacto</label>
                  <input className="form-input" value={instPhone} onChange={(e) => setInstPhone(e.target.value)} />
                </div>
                <div style={{ borderTop: '1px solid var(--gray-300)', margin: '4px 0 12px' }} />
                <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Cuenta de administrador de la institución:</p>
              </>
            )}

            <div className="form-group">
              <label className="form-label">{role === 'institucion' ? 'Nombre del administrador' : 'Nombre y apellidos'}</label>
              <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            {role === 'profesor' && (
              <div className="form-group">
                <label className="form-label">Profesión sanitaria</label>
                <input className="form-input" placeholder="Ej.: Médico intensivista, Enfermero/a…" value={headline} onChange={(e) => setHeadline(e.target.value)} required />
              </div>
            )}

            {role === 'alumno' && institutions.length > 0 && (
              <div className="form-group">
                <label className="form-label">Participaré por la institución (opcional)</label>
                <select className="form-select" value={institutionId} onChange={(e) => setInstitutionId(e.target.value)}>
                  <option value="">Independiente (ninguna)</option>
                  {institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email {role === 'institucion' && '(será tu acceso)'}</label>
              <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Contraseña (mín. 8)</label>
              <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            {/* RGPD: información básica + consentimientos separados */}
            <div className="info-box" style={{ fontSize: 11.5, lineHeight: 1.5, marginBottom: 12 }}>
              <strong>Protección de datos.</strong> Responsable: <strong>Gran Canaria RCP</strong>. Finalidad: gestionar tu
              cuenta, tu formación y tu participación en la plataforma. Legitimación: ejecución de la relación y tu
              consentimiento. Conservación: mientras mantengas la cuenta. Destinatarios: proveedores tecnológicos
              necesarios (alojamiento), sin cesiones a terceros. Derechos: acceso, rectificación, supresión, oposición,
              limitación y portabilidad, escribiendo a{' '}
              <a href="mailto:grancanariarcp@gmail.com">grancanariarcp@gmail.com</a>. Más información en la{' '}
              <Link href="/privacidad" target="_blank">política de privacidad</Link>.
            </div>

            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, marginBottom: 8 }}>
              <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} required style={{ marginTop: 3 }} />
              <span>He leído y acepto la <Link href="/privacidad" target="_blank">política de privacidad</Link> y las{' '}
                <Link href="/terminos" target="_blank">condiciones de uso</Link>. <span style={{ color: 'var(--danger)' }}>*</span></span>
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, marginBottom: 8 }}>
              <input type="checkbox" checked={rankingConsent} onChange={(e) => setRankingConsent(e.target.checked)} style={{ marginTop: 3 }} />
              <span>Autorizo que mi nombre aparezca en los <strong>rankings públicos</strong>. Si no lo autorizas,
                participarás igualmente pero aparecerás como <em>«Usuario anónimo»</em>.</span>
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, marginBottom: 14 }}>
              <input type="checkbox" checked={marketingConsent} onChange={(e) => setMarketingConsent(e.target.checked)} style={{ marginTop: 3 }} />
              <span>Quiero recibir información sobre cursos y novedades. Puedes retirarlo cuando quieras desde tu perfil.</span>
            </label>

            <button className="btn btn-primary btn-full" disabled={loading || !acceptTerms}>
              {loading ? 'Enviando…' : role === 'profesor' ? 'Solicitar cuenta de profesor' : role === 'institucion' ? 'Registrar institución' : 'Crear cuenta'}
            </button>
          </form>
        )}

        <p className="muted" style={{ textAlign: 'center', fontSize: 13, marginTop: 18 }}>
          ¿Ya tienes cuenta? <Link href="/login">Acceso</Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: 8 }}><AppVersion /></p>
      </div>
    </div>
  );
}
