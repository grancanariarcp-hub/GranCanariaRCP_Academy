'use client';

/**
 * Datos de contacto.
 *
 * Van visibles en todas las páginas públicas: quien duda antes de matricularse
 * o de publicar sus cursos quiere hablar con alguien, y esconder el contacto
 * detrás de un botón que abre el gestor de correo cuesta consultas. Se muestran
 * el correo y el número, además de enlazarlos.
 */

export const CONTACTO = {
  email: 'grancanariarcp@gmail.com',
  telefonoTexto: '+34 624 707 295',
  telefonoEnlace: '34624707295',
};

export const mailtoCon = (asunto: string) =>
  `mailto:${CONTACTO.email}?subject=${encodeURIComponent(asunto)}`;

export const whatsappCon = (texto: string) =>
  `https://wa.me/${CONTACTO.telefonoEnlace}?text=${encodeURIComponent(texto)}`;

/** Bloque de contacto para el pie de las páginas públicas. */
export function Contacto({ claro = false }: { claro?: boolean }) {
  const color = claro ? 'rgba(255,255,255,0.9)' : 'var(--gray-700)';
  const enlace = claro ? '#fff' : 'var(--secondary-dark)';

  return (
    <div style={{ textAlign: 'center', fontSize: 13.5, color, lineHeight: 1.9 }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>¿Tienes dudas? Escríbenos</div>
      <div>
        <a href={mailtoCon('Consulta desde la web')} style={{ color: enlace }}>{CONTACTO.email}</a>
        {' · '}
        <a href={whatsappCon('Hola, tengo una consulta sobre la formación')} target="_blank" rel="noreferrer"
          style={{ color: enlace }}>
          {CONTACTO.telefonoTexto}
        </a>
      </div>
    </div>
  );
}
