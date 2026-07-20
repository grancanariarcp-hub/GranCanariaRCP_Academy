'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Ayuda } from '@/components/ayuda/Ayuda';

/**
 * Tres cosas que la plataforma recoge y que hasta ahora no se veían en ninguna
 * parte: los correos de quien pide aviso de apertura, las cuentas con indicios
 * de uso compartido y el estado de la pasarela de pago.
 *
 * Recoger datos que nadie mira es peor que no recogerlos: da la falsa sensación
 * de estar midiendo algo.
 */

interface Lead { id: string; email: string; interes: string | null; origen: string; consent_at: string; notified_at: string | null }
interface Cuenta { subject_id: string; nombre: string | null; email: string | null; conexiones: number; dispositivos: number; sesiones: number; ultima: string }
interface Stripe {
  configurado: boolean; webhookConfigurado: boolean; modo: string; webhookValido: boolean;
  cuenta: { id: string; chargesEnabled: boolean; pais: string | null } | null;
  errorCuenta: string | null;
  clave: { prefijo: string; tipo: string; teniaEspacios: boolean };
}

export function AdminPendientes() {
  const [leads, setLeads] = useState<{ leads: Lead[]; totales: { total: number; esteMes: number } } | null>(null);
  const [compartido, setCompartido] = useState<Cuenta[]>([]);
  const [stripe, setStripe] = useState<Stripe | null>(null);

  useEffect(() => {
    api<typeof leads>('/api/admin/leads', { auth: true }).then(setLeads).catch(() => {});
    api<{ cuentas: Cuenta[] }>('/api/admin/uso-compartido?dias=14', { auth: true })
      .then((r) => setCompartido(r.cuentas)).catch(() => {});
    api<Stripe>('/api/admin/stripe-status', { auth: true }).then(setStripe).catch(() => {});
  }, []);

  return (
    <div className="grid grid-2" style={{ gap: 16, marginBottom: 24 }}>
      {/* Interesados en la apertura de matrículas */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Avisos de apertura</div>
          <div className="card-subtitle">
            {leads ? `${leads.totales.total} interesados · ${leads.totales.esteMes} este mes` : 'Cargando…'}
          </div>
        </div>
        {!leads || leads.leads.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
            Nadie ha pedido aviso todavía. El formulario aparece en el campus cuando no hay cursos con
            matrícula abierta.
          </p>
        ) : (
          <>
            <div className="table-responsive" style={{ maxHeight: 240 }}>
              <table className="table-plain">
                <thead><tr><th>Correo</th><th>Interés</th><th>Fecha</th></tr></thead>
                <tbody>
                  {leads.leads.slice(0, 30).map((l) => (
                    <tr key={l.id}>
                      <td style={{ fontSize: 13 }}>{l.email}</td>
                      <td className="muted" style={{ fontSize: 12.5 }}>{l.interes ?? '—'}</td>
                      <td className="muted" style={{ fontSize: 12.5 }}>
                        {new Date(l.consent_at).toLocaleDateString('es-ES')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              Dieron su consentimiento solo para avisarles de la apertura: no los uses para otra cosa.
            </p>
          </>
        )}
      </div>

      {/* Indicios de credenciales compartidas */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Posible uso compartido <Ayuda tema="admin-pendientes" /></div>
          <div className="card-subtitle">Cuentas con muchos dispositivos o conexiones en 14 días</div>
        </div>
        {compartido.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
            Ninguna cuenta da señales de estar repartida. El límite de dos sesiones simultáneas hace el
            trabajo por sí solo.
          </p>
        ) : (
          <>
            <div className="table-responsive" style={{ maxHeight: 240 }}>
              <table className="table-plain">
                <thead><tr><th>Cuenta</th><th>Dispositivos</th><th>Conexiones</th></tr></thead>
                <tbody>
                  {compartido.map((c) => (
                    <tr key={c.subject_id}>
                      <td style={{ fontSize: 13 }}>
                        {c.nombre ?? 'Sin nombre'}
                        <div className="muted" style={{ fontSize: 11.5 }}>{c.email ?? '—'}</div>
                      </td>
                      <td><strong>{c.dispositivos}</strong></td>
                      <td>{c.conexiones}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              Es un indicio, no una prueba: quien estudia desde el hospital, casa y la biblioteca sale igual.
              Revísalo antes de actuar.
            </p>
          </>
        )}
      </div>

      {/* Estado de la pasarela */}
      {stripe && (
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <div className="card-title">Pasarela de pago</div>
            <div className="card-subtitle">Estado de la conexión con Stripe</div>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 14 }}>
            <span>
              Modo:{' '}
              <span className={`badge ${stripe.modo === 'produccion' ? 'badge-success' : stripe.modo === 'pruebas' ? 'badge-warning' : ''}`}>
                {stripe.modo}
              </span>
            </span>
            <span>Webhook: {stripe.webhookConfigurado ? '✅ configurado' : '❌ sin configurar'}</span>
            {stripe.cuenta && (
              <span>Cobros: {stripe.cuenta.chargesEnabled ? '✅ habilitados' : '⚠️ pendientes de activar en Stripe'}</span>
            )}
          </div>
          {/* Cuando el modo no es el esperado, decir POR QUÉ ahorra probar a
              ciegas: casi siempre es la clave publicable, un espacio pegado de
              más o un despliegue que aún no ha recogido el cambio. */}
          {stripe.modo !== 'produccion' && stripe.clave && (
            <div className="alert alert-error" style={{ fontSize: 13, marginTop: 12 }}>
              <div>
                Clave puesta: <code>{stripe.clave.prefijo}…</code> — {stripe.clave.tipo}
              </div>
              {stripe.clave.teniaEspacios && (
                <div style={{ marginTop: 6 }}>
                  Se coló un espacio o un salto de línea al pegarla. Se ignora al usarla, pero conviene
                  dejarla limpia en Render.
                </div>
              )}
              {stripe.clave.prefijo.startsWith('sk_test_') && (
                <div style={{ marginTop: 6 }}>
                  Sigue siendo la de pruebas. Si ya pegaste la de producción, es que Render aún no ha
                  terminado de desplegar: espera a que ponga <strong>Live</strong> y recarga.
                </div>
              )}
              {stripe.clave.prefijo.startsWith('pk_') && (
                <div style={{ marginTop: 6 }}>
                  Esa es la clave <strong>publicable</strong>, la que Stripe enseña a la vista. La que hace
                  falta está debajo, oculta tras <em>Revelar</em>, y empieza por <code>sk_live_</code>.
                </div>
              )}
            </div>
          )}
          {stripe.errorCuenta && (
            <div className="alert alert-error" style={{ fontSize: 13, marginTop: 8 }}>
              No se ha podido leer la cuenta de Stripe: {stripe.errorCuenta}
              <div style={{ marginTop: 6 }}>
                Con una clave restringida esto suele significar que le falta permiso de lectura sobre
                <strong> Account</strong>. No impide cobrar, pero deja el panel a ciegas.
              </div>
            </div>
          )}
          {stripe.webhookConfigurado && !stripe.webhookValido && (
            <div className="alert alert-error" style={{ fontSize: 13, marginTop: 8 }}>
              El secreto del webhook no empieza por <code>whsec_</code>: no es el secreto de firma.
            </div>
          )}
          {stripe.modo === 'pruebas' && (
            <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
              En pruebas no se mueve dinero real.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
