import type { Role } from '@/lib/auth';

/**
 * Visita guiada de primera vez.
 *
 * La ayuda contextual (el botón «?» de cada sección) resuelve la duda concreta
 * cuando surge; el tour resuelve la primera: «¿qué es todo esto y por dónde
 * empiezo?». Se lanza solo la primera vez y se puede repetir cuando se quiera.
 *
 * Cada paso apunta a un elemento por su atributo `data-tour`, no por su estilo,
 * para que un cambio de diseño no rompa la visita. Un paso sin `target` se
 * muestra centrado (bienvenida y cierre). Si el elemento no está en la pantalla
 * actual, el paso se salta solo en vez de dejar la visita colgada.
 *
 * Subir VERSION obliga a que la visita vuelva a ofrecerse a todos: hazlo solo
 * cuando el recorrido cambie de verdad, no en cada retoque de texto.
 */
export const VERSION = 1;

export interface PasoTour {
  /** Selector del elemento a resaltar (por data-tour). Sin él, paso centrado. */
  target?: string;
  titulo: string;
  texto: string;
}

const CIERRE: PasoTour = {
  titulo: 'Y ya está',
  texto:
    'Eso es lo esencial. Recuerda: el botón **?** de cada sección te explica esa parte en detalle, '
    + 'y puedes repetir esta visita cuando quieras desde **Visita guiada**, en el menú de la izquierda.',
};

const AYUDA: PasoTour = {
  target: '[data-tour="ayuda"]',
  titulo: 'Nunca te quedas sin guía',
  texto:
    'En cada pantalla, este botón **Ayuda** te explica exactamente qué puedes hacer en ella. '
    + 'Y junto a cada sección verás un **?** con la ayuda de esa parte concreta.',
};

const NAV: PasoTour = {
  target: '[data-tour="nav"]',
  titulo: 'Tu menú',
  texto: 'Desde aquí llegas a todo. La sección en la que estás aparece resaltada.',
};

const TOURS: Record<Role, PasoTour[]> = {
  student: [
    {
      titulo: '¡Bienvenido a Gran Canaria RCP!',
      texto: 'Te enseño en medio minuto lo que necesitas para aprovechar el campus. Puedes salir cuando quieras.',
    },
    NAV,
    {
      target: '[data-tour="mis-cursos"]',
      titulo: 'Tus cursos',
      texto: 'Aquí están los cursos en los que ya estás matriculado, con tu avance. Pulsa uno para entrar al aula.',
    },
    {
      target: '[data-tour="cursos-disponibles"]',
      titulo: 'Matricularte en cursos nuevos',
      texto: 'Los cursos con matrícula abierta. Entras en su ficha, ves el programa y te matriculas.',
    },
    AYUDA,
    CIERRE,
  ],
  profesor: [
    {
      titulo: '¡Bienvenido! Vamos a lo importante',
      texto: 'Un recorrido rápido por tu zona de trabajo para que puedas empezar a montar tu curso.',
    },
    NAV,
    {
      target: '[data-tour="lista-cursos"]',
      titulo: 'Tus cursos',
      texto: 'Aquí creas y diriges tus cursos. Recuerda: un curso solo se edita mientras está en borrador.',
    },
    {
      target: '[data-tour="ayuda"]',
      titulo: 'La guía completa',
      texto:
        'Antes de nada, completa tu **perfil docente**: sin él no podrás publicar. Este botón **Ayuda**, '
        + 'y el **?** de cada sección, te acompañan en cada paso.',
    },
    CIERRE,
  ],
  super_admin: [
    {
      titulo: 'Bienvenido al panel de administración',
      texto: 'Un vistazo rápido a lo que tienes a mano. Como super admin, lo ves y lo decides todo.',
    },
    NAV,
    {
      target: '[data-tour="resumen"]',
      titulo: 'El pulso de la plataforma',
      texto: 'Métricas, avisos pendientes y el estado de la pasarela de pago, de un vistazo.',
    },
    AYUDA,
    CIERRE,
  ],
  // Roles con panel propio: una bienvenida y el cierre bastan; su pantalla es simple.
  institution_admin: [
    { titulo: 'Bienvenido', texto: 'Desde aquí gestionas tu centro y das de alta a tus maestros.' },
    NAV,
    AYUDA,
    CIERRE,
  ],
  institution_teacher: [
    { titulo: 'Bienvenido', texto: 'Aquí creas tus clases y los códigos con los que entran tus alumnos, sin que den datos personales.' },
    NAV,
    AYUDA,
    CIERRE,
  ],
  auditor: [
    {
      titulo: 'Acceso de la Comisión CFC',
      texto: 'Tu acceso es de solo lectura: puedes revisar cursos, exámenes y bancos, pero no modificar ni descargar.',
    },
    NAV,
    CIERRE,
  ],
};

export function tourDe(rol: Role): PasoTour[] {
  return TOURS[rol] ?? [];
}

/** Clave de «ya vista» por rol y versión: al subir VERSION se vuelve a ofrecer. */
export function claveVista(rol: Role): string {
  return `tour_visto_${rol}_v${VERSION}`;
}
