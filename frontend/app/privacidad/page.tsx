'use client';

import Link from 'next/link';
import { AppVersion } from '@/components/AppVersion';

/**
 * Política de privacidad (RGPD + LOPDGDD). PLANTILLA BASE: los datos
 * identificativos del responsable deben completarse y el texto debe ser
 * revisado por un asesor legal antes de operar comercialmente.
 */
export default function PrivacidadPage() {
  return (
    <div style={{ minHeight: '100vh', padding: '32px 16px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <p style={{ marginBottom: 16 }}><Link href="/">← Inicio</Link></p>
        <div className="card animate-in">
          <h1 style={{ color: 'var(--primary-dark)', marginBottom: 6 }}>Política de privacidad</h1>
          <p className="muted" style={{ marginBottom: 20 }}>Versión 1.0 · Última actualización: julio de 2026</p>

          <h3>1. Responsable del tratamiento</h3>
          <p>Gran Canaria RCP (en adelante, «la plataforma»). Contacto:{' '}
            <a href="mailto:grancanariarcp@gmail.com">grancanariarcp@gmail.com</a>.</p>

          <h3>2. ¿Qué datos tratamos?</h3>
          <ul>
            <li><strong>Personas registradas</strong>: nombre, correo electrónico, contraseña cifrada y, si lo indicas,
              la institución a la que representas.</li>
            <li><strong>Uso de la plataforma</strong>: cursos en los que te matriculas, respuestas a tests y exámenes,
              resultados, tiempo de estudio y participación en desafíos.</li>
            <li><strong>Menores de edad</strong>: no solicitamos nombre ni correo. Únicamente un <strong>seudónimo</strong>
              elegido por el propio menor y su <strong>edad</strong>, junto al código facilitado por su maestro. No es
              posible identificar al menor a partir de estos datos.</li>
            <li><strong>Datos técnicos</strong>: dirección IP y registros de acceso, por seguridad.</li>
          </ul>

          <h3>3. ¿Para qué y con qué legitimación?</h3>
          <ul>
            <li>Gestionar tu cuenta y prestarte el servicio formativo — ejecución de la relación contractual.</li>
            <li>Emitir certificados y acreditar tu formación — ejecución de la relación e interés legítimo.</li>
            <li>Mostrar tu nombre en los <strong>rankings públicos</strong> — <strong>tu consentimiento explícito</strong>.
              Si no lo otorgas, participas igualmente pero apareces como «Usuario anónimo».</li>
            <li>Enviarte información sobre cursos y novedades — <strong>tu consentimiento</strong>, revocable en
              cualquier momento.</li>
            <li>Seguridad y prevención del fraude — interés legítimo.</li>
          </ul>

          <h3>4. Conservación</h3>
          <p>Conservamos tus datos mientras mantengas tu cuenta activa. Tras su supresión, se conservan bloqueados
            únicamente durante los plazos legalmente exigibles (fiscales y de acreditación formativa) y después se
            eliminan.</p>

          <h3>5. Destinatarios</h3>
          <p>No cedemos tus datos a terceros con fines comerciales. Utilizamos proveedores tecnológicos que actúan como
            encargados del tratamiento (alojamiento de la aplicación y de la base de datos, almacenamiento de archivos y
            envío de correos), con contratos que garantizan un nivel de protección adecuado.</p>

          <h3>6. Tus derechos</h3>
          <p>Puedes ejercer los derechos de <strong>acceso, rectificación, supresión, oposición, limitación del
            tratamiento y portabilidad</strong>, así como <strong>retirar tu consentimiento</strong> en cualquier momento
            (sin que ello afecte a la licitud del tratamiento previo), escribiendo a{' '}
            <a href="mailto:grancanariarcp@gmail.com">grancanariarcp@gmail.com</a>. Los consentimientos de ranking y de
            comunicaciones puedes cambiarlos tú mismo desde tu perfil en cualquier momento.</p>
          <p>Si consideras que no hemos atendido correctamente tu solicitud, puedes reclamar ante la{' '}
            <a href="https://www.aepd.es" target="_blank" rel="noreferrer">Agencia Española de Protección de Datos
            (www.aepd.es)</a>.</p>

          <h3>7. Seguridad</h3>
          <p>Las contraseñas se almacenan cifradas (nunca en claro), la comunicación viaja siempre por conexión segura
            (HTTPS) y el acceso a los datos está restringido por roles.</p>

          <h3>8. Cambios</h3>
          <p>Si modificamos esta política, publicaremos la nueva versión aquí y, cuando el cambio sea sustancial, te
            pediremos de nuevo tu aceptación.</p>
        </div>
        <p style={{ textAlign: 'center', marginTop: 24 }}><AppVersion /></p>
      </div>
    </div>
  );
}
