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
  const items =
    role === 'super_admin'
      ? [
          { label: 'Resumen', href: '/admin' },
          { label: 'Cursos', href: '/admin/cursos' },
          { label: 'Preguntas', href: '/admin/preguntas' },
          { label: 'Documentos', href: '/admin/documentos' },
          { label: 'Desafíos', href: '/admin/desafios' },
          { label: 'Profesores', href: '/admin/profesores' },
          { label: 'Perfil', href: '/admin/perfil' },
        ]
      : [
          { label: 'Mis cursos', href: '/admin/cursos' },
          { label: 'Mis preguntas', href: '/admin/preguntas' },
          { label: 'Documentos', href: '/admin/documentos' },
          { label: 'Perfil', href: '/admin/perfil' },
        ];

  return items.map((i) => ({ ...i, active: i.href === activeHref }));
}
