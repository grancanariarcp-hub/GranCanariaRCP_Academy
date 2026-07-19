'use client';

import Link from 'next/link';
import { AppVersion } from '@/components/AppVersion';
import { PageNav } from '@/components/PageNav';

/**
 * Condiciones de uso. PLANTILLA BASE: completar datos fiscales del titular y
 * revisar con asesoría legal antes de vender cursos o suscripciones.
 */
export default function TerminosPage() {
  return (
    <div style={{ minHeight: '100vh', padding: '32px 16px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <PageNav />
        <div className="card animate-in">
          <h1 style={{ color: 'var(--primary-dark)', marginBottom: 6 }}>Condiciones de uso</h1>
          <p className="muted" style={{ marginBottom: 20 }}>Versión 1.0 · Última actualización: julio de 2026</p>

          <h3>1. Objeto y titular</h3>
          <p>Estas condiciones regulan el acceso y uso del campus de formación de <strong>Gran Canaria RCP</strong>.
            El uso de la plataforma implica su aceptación.</p>

          <h3>2. Cuentas de usuario</h3>
          <ul>
            <li>Debes facilitar datos veraces y mantenerlos actualizados.</li>
            <li>Eres responsable de la custodia de tu contraseña y de la actividad realizada con tu cuenta.</li>
            <li>Las cuentas son <strong>personales e intransferibles</strong>. Compartirlas puede suponer su cancelación
              y la invalidación de los certificados obtenidos.</li>
            <li>Las cuentas de profesorado requieren validación previa por parte de la organización.</li>
          </ul>

          <h3>3. Menores de edad</h3>
          <p>El acceso de menores se realiza exclusivamente mediante el <strong>código facilitado por su centro</strong>,
            con un seudónimo y su edad, sin recabar datos identificativos. Corresponde al centro educativo y a los
            titulares de la patria potestad autorizar dicha participación.</p>

          <h3>4. Uso correcto</h3>
          <p>No está permitido: copiar, descargar masivamente o redistribuir los contenidos y bancos de preguntas;
            manipular resultados o rankings; suplantar identidades; ni realizar acciones que comprometan la seguridad o
            la disponibilidad del servicio.</p>

          <h3>5. Propiedad intelectual</h3>
          <p>Los contenidos formativos, preguntas, materiales y marcas son titularidad de Gran Canaria RCP o de sus
            legítimos autores. Se cede al usuario un derecho de uso personal e intransferible con fines formativos.</p>

          <h3>6. Certificados</h3>
          <p>Los certificados se emiten únicamente a quienes superen la evaluación correspondiente y son
            <strong> verificables</strong> mediante el código y el QR que incorporan. La acreditación oficial, cuando
            proceda, se rige por los requisitos del organismo acreditador.</p>

          <h3>7. Rankings y desafíos</h3>
          <p>La aparición del nombre en los rankings públicos requiere <strong>consentimiento explícito</strong>. Sin él,
            la participación es igualmente posible bajo la identificación «Usuario anónimo». La organización puede
            excluir participaciones fraudulentas.</p>

          <h3>8. Pagos, cursos y desistimiento</h3>
          <p>El precio y las condiciones de cada curso se indican en su ficha antes de la matrícula. Como consumidor,
            dispones del derecho de desistimiento en los términos previstos por la normativa aplicable; al tratarse de
            contenido digital de acceso inmediato, dicho derecho puede decaer una vez iniciado el curso si así lo has
            aceptado expresamente.</p>

          <h3>9. Disponibilidad y responsabilidad</h3>
          <p>Trabajamos para mantener el servicio disponible, pero puede interrumpirse por mantenimiento o causas
            ajenas. La formación tiene finalidad educativa y <strong>no sustituye al juicio clínico profesional</strong>
            ni a la normativa asistencial vigente.</p>

          <h3>10. Baja</h3>
          <p>Puedes solicitar la baja y la supresión de tu cuenta en cualquier momento escribiendo a{' '}
            <a href="mailto:grancanariarcp@gmail.com">grancanariarcp@gmail.com</a>. Consulta también la{' '}
            <Link href="/privacidad">política de privacidad</Link>.</p>

          <h3>11. Legislación aplicable</h3>
          <p>Estas condiciones se rigen por la legislación española.</p>
        </div>
        <p style={{ textAlign: 'center', marginTop: 24 }}><AppVersion /></p>
      </div>
    </div>
  );
}
