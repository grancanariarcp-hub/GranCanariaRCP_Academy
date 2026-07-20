import type { Role } from '@/lib/auth';

/**
 * Menú lateral del área de gestión, en un único sitio.
 *
 * El profesorado tiene las mismas secciones de trabajo que el super admin
 * (cursos, preguntas y documentos), porque gestiona SU material; lo que no ve
 * es la administración de la plataforma (resumen global y alta de profesores).
 * Antes su menú solo tenía "Mis cursos" y "Perfil", de modo que no podía
 * siquiera llegar a la pantalla de documentos para subir el material.
 */
export function adminNav(role: Role, activeHref?: string) {
  // El auditor solo consulta: se le ofrece lo que puede revisar, sin las
  // secciones de gestión que no podría usar.
  if (role === 'auditor') {
    return [
      { label: 'Cursos', href: '/admin/cursos' },
      { label: 'Bancos', href: '/admin/bancos' },
      { label: 'Perfil', href: '/admin/perfil' },
    ].map((i) => ({ ...i, active: i.href === activeHref }));
  }

  const items =
    role === 'super_admin'
      ? [
          { label: 'Resumen', href: '/admin' },
          { label: 'Cursos', href: '/admin/cursos' },
          { label: 'Preguntas', href: '/admin/preguntas' },
          { label: 'Bancos', href: '/admin/bancos' },
          { label: 'Convocatorias', href: '/admin/convocatorias' },
          { label: 'Documentos', href: '/admin/documentos' },
          { label: 'Desafíos', href: '/admin/desafios' },
          { label: 'Diplomas', href: '/admin/reconocimientos' },
          { label: 'Profesores', href: '/admin/profesores' },
          { label: 'Comisión CFC', href: '/admin/auditores' },
          { label: 'Perfil', href: '/admin/perfil' },
        ]
      : [
          { label: 'Mis cursos', href: '/admin/cursos' },
          { label: 'Mis preguntas', href: '/admin/preguntas' },
          { label: 'Mis bancos', href: '/admin/bancos' },
          { label: 'Documentos', href: '/admin/documentos' },
          { label: 'Perfil', href: '/admin/perfil' },
        ];

  return items.map((i) => ({ ...i, active: i.href === activeHref }));
}
