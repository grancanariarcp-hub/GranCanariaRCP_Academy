'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';

/**
 * Aviso de apertura de matrícula.
 *
 * Ocupa el hueco del catálogo vacío: quien llega con intención de matricularse
 * y no encuentra nada se marcha sin dejar rastro. De paso mide qué demanda real
 * hay antes de producir cada curso.
 */
export function LeadCapture({ origen = 'campus', temas = [] }: { origen?: string; temas?: string[] }) {
  const [email, setEmail] = useState('');
  const [interes, setInteres] = useState('');
  const [acepta, setAcepta] = useState(false);
  const [hecho, setHecho] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await api('/api/public/leads', {
        method: 'POST',
        body: JSON.stringify({ email, interes: interes || undefined, origen, aceptaPrivacidad: acepta }),
      });
      setHecho(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo completar la suscripción');
    } finally {
      setEnviando(false);
    }
  }

  if (hecho) {
    return (
      <div className="card animate-pop" style={{ maxWidth: 560, margin: '0 auto 44px', textAlign: 'center', borderTop: '4px solid var(--success)' }}>
        <h3 style={{ marginBottom: 8 }}>Apuntado ✓</h3>
        <p className="muted" style={{ margin: 0 }}>
          Te escribiremos en cuanto abramos las matrículas. Serás de los primeros en saberlo.
        </p>
      </div>
    );
  }

  return (
    <div className="card animate-pop" style={{ maxWidth: 560, margin: '0 auto 44px', borderTop: '4px solid var(--secondary-dark)' }}>
      <h3 style={{ marginBottom: 6, textAlign: 'center' }}>Sé el primero en enterarte</h3>
      <p className="muted" style={{ fontSize: 14, textAlign: 'center', marginBottom: 16 }}>
        Estamos preparando los primeros cursos acreditados. Déjanos tu correo y te avisamos
        <strong> en exclusiva</strong> cuando abramos las matrículas.
      </p>

      {error && <p className="alert alert-error">{error}</p>}

      <form onSubmit={enviar}>
        <div className="form-group">
          <label className="form-label" htmlFor="lead-email">Tu correo</label>
          <input id="lead-email" type="email" required className="form-input" placeholder="nombre@correo.com"
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        {temas.length > 0 && (
          <div className="form-group">
            <label className="form-label" htmlFor="lead-interes">¿Qué formación te interesa?</label>
            <select id="lead-interes" className="form-select" value={interes} onChange={(e) => setInteres(e.target.value)}>
              <option value="">Cualquiera</option>
              {temas.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}

        {/* Consentimiento expreso y para una finalidad concreta. */}
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, marginBottom: 14 }}>
          <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} style={{ marginTop: 3 }} />
          <span>
            Acepto que se guarde mi correo con la única finalidad de avisarme de la apertura de matrículas.
            Consulta la <Link href="/privacidad">política de privacidad</Link>. Puedes darte de baja cuando quieras.
          </span>
        </label>

        <button className="btn btn-primary btn-full press" disabled={enviando || !acepta}>
          {enviando ? 'Enviando…' : 'Avisadme cuando abran las matrículas'}
        </button>
      </form>
    </div>
  );
}
