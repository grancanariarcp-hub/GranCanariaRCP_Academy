import type { Role } from '@/lib/auth';

/**
 * Guías paso a paso para las tareas del profesorado.
 *
 * Distinto de la visita guiada (Tour.tsx): el tour orienta en UNA pantalla («¿qué
 * es esto?»); una guía acompaña una TAREA que cruza varias pantallas («móntame un
 * curso de principio a fin»). Por eso su panel es acoplado y persiste al navegar,
 * en vez de un foco que se rompería al cambiar de página.
 *
 * Cada paso dice qué hacer y, cuando aplica, en qué pantalla (`ruta`) y qué
 * elemento resaltar (`target`, por data-guia). Si el paso ocurre en otra
 * pantalla, el panel ofrece un botón para ir a ella.
 */

export interface PasoGuia {
  titulo: string;
  /** Qué hacer. Admite **negrita**. */
  texto: string;
  /** Prefijo de ruta donde se realiza el paso. Si el usuario no está allí, se le ofrece ir. */
  ruta?: string;
  /** Ruta concreta a la que llevar (si difiere del prefijo, p. ej. lista de cursos). */
  irA?: string;
  /** Elemento a resaltar en esa pantalla (por su atributo data-tour). */
  target?: string;
}

export interface Guia {
  id: string;
  titulo: string;
  resumen: string;
  roles: Role[];
  pasos: PasoGuia[];
}

export const GUIAS: Guia[] = [
  {
    id: 'crear-curso',
    titulo: 'Crear un curso nuevo',
    resumen: 'Desde cero hasta tenerlo publicado y con matrícula abierta.',
    roles: ['profesor', 'super_admin'],
    pasos: [
      {
        titulo: 'Antes de nada: tu perfil docente',
        texto:
          'Para poder **publicar** un curso, tu perfil docente debe estar completo (titular, profesión y algo de CV). '
          + 'Si te falta, lo verás avisado en tu perfil. Puedes crear el curso igualmente e ir completándolo.',
        ruta: '/admin/perfil',
        irA: '/admin/perfil',
      },
      {
        titulo: 'Abre la pantalla de cursos',
        texto: 'Ve a **Cursos** en el menú. A la izquierda tienes el formulario para crear uno nuevo.',
        ruta: '/admin/cursos',
        irA: '/admin/cursos',
        target: '[data-tour="crear-curso-form"]',
      },
      {
        titulo: 'Rellena lo básico y crea',
        texto:
          'Solo el **título** es obligatorio; lo demás puedes completarlo después. Elige la **modalidad** '
          + '(online/híbrido/presencial) y pulsa **Crear curso**. Te llevará a la ficha del curso.',
        ruta: '/admin/cursos',
        target: '[data-tour="crear-curso-form"]',
      },
      {
        titulo: 'Completa la ficha',
        texto:
          'Ya en la ficha, rellena resumen, fechas, horas y acreditación. Es lo que ve el alumno antes de '
          + 'matricularse y lo que revisa la comisión. Si el curso tiene práctica presencial, marca su **tipo '
          + 'clínico** (SVA/SVB/SVI) para PÚLSAR.',
        ruta: '/admin/cursos/',
        target: '[data-tour="ficha"]',
      },
      {
        titulo: 'Publica y abre matrícula',
        texto:
          'Son **dos pasos**: primero **Publicar** (lo hace visible), después **Abrir matrícula** (permite '
          + 'inscribirse). Recuerda: un curso publicado no se edita; para cambiarlo, vuélvelo a borrador.',
        ruta: '/admin/cursos/',
        target: '[data-tour="estado"]',
      },
      {
        titulo: 'Listo',
        texto: 'Ya tienes el curso en marcha. Sigue con la guía **«Añadir contenido»** para montar sus módulos y actividades.',
      },
    ],
  },
  {
    id: 'modulos-actividades',
    titulo: 'Añadir contenido: módulos y actividades',
    resumen: 'Organiza el material, los vídeos, los tests y el examen.',
    roles: ['profesor', 'super_admin'],
    pasos: [
      {
        titulo: 'Sube antes tu material',
        texto:
          'Las actividades de tipo documento usan archivos que ya tengas en **Documentos**. Súbelos primero allí '
          + '(una vez, y los reutilizas en cualquier curso).',
        ruta: '/admin/documentos',
        irA: '/admin/documentos',
      },
      {
        titulo: 'Abre tu curso',
        texto: 'Entra en **Cursos** y pulsa el curso que quieres montar. El curso debe estar en **borrador** para editarlo.',
        ruta: '/admin/cursos',
        irA: '/admin/cursos',
        target: '[data-tour="lista-cursos"]',
      },
      {
        titulo: 'Crea los módulos',
        texto:
          'En **Contenido del curso**, crea un módulo por cada bloque (p. ej. «Bienvenida», «RCP básica», '
          + '«Examen final»). Los módulos ordenan el curso.',
        ruta: '/admin/cursos/',
        target: '[data-tour="contenido"]',
      },
      {
        titulo: 'Añade actividades a cada módulo',
        texto:
          'Dentro de un módulo, añade actividades: **documento**, **vídeo** (enlace a YouTube/Vimeo), **texto**, '
          + '**test** de repaso o **examen**. Para un documento, elígelo del desplegable con tus archivos ya subidos.',
        ruta: '/admin/cursos/',
        target: '[data-tour="contenido"]',
      },
      {
        titulo: 'Monta el examen final',
        texto:
          'El examen se **compone** desde tus bancos de preguntas: eliges de qué bancos salen y cuántas. '
          + 'Cada alumno recibe una combinación distinta. Configura la nota de corte y, si quieres, el tiempo.',
        ruta: '/admin/cursos/',
        target: '[data-tour="contenido"]',
      },
      {
        titulo: 'Listo',
        texto: 'Contenido montado. Cuando el curso termine, usa la guía **«Cerrar el curso y hacer el acta»**.',
      },
    ],
  },
  {
    id: 'cerrar-acta',
    titulo: 'Cerrar el curso y hacer el acta',
    resumen: 'Del final del curso al acta oficial y los certificados.',
    roles: ['profesor', 'super_admin'],
    pasos: [
      {
        titulo: 'Comprueba que todo está puesto',
        texto:
          'Antes de cerrar: todas las notas registradas y la asistencia completa. El acta congela estos datos, '
          + 'así que conviene que ya no vayan a cambiar.',
        ruta: '/admin/cursos/',
        target: '[data-tour="acta"]',
      },
      {
        titulo: 'Revisa el borrador del acta',
        texto:
          'En **Acta del curso**, genera el borrador cuantas veces quieras: se recalcula con los datos del momento. '
          + 'Comprueba aptos, no aptos y asistencia.',
        ruta: '/admin/cursos/',
        target: '[data-tour="acta"]',
      },
      {
        titulo: 'Si el curso tiene práctica, impórtala antes',
        texto:
          'Si es un curso con fase presencial en PÚLSAR, **importa primero los resultados** (guía «Exportar e '
          + 'importar con PÚLSAR»): el acta necesita la nota práctica para decidir quién es apto.',
        ruta: '/admin/cursos/',
        target: '[data-tour="pulsar"]',
      },
      {
        titulo: 'Cierra el acta',
        texto:
          'Cuando esté todo correcto, **cierra el acta**: los datos se congelan y se les calcula una huella que '
          + 'detecta cualquier alteración posterior. Un acta cerrada no se modifica; si hay error, se emite otra versión.',
        ruta: '/admin/cursos/',
        target: '[data-tour="acta"]',
      },
      {
        titulo: 'Los certificados salen solos',
        texto:
          'No tienes que emitirlos uno a uno: cada alumno descarga el suyo en cuanto **aprueba el examen** y '
          + '**responde la encuesta**. Tu parte era dejar la ficha y el acta correctas.',
      },
    ],
  },
  {
    id: 'exportar-pulsar',
    titulo: 'Exportar e importar con PÚLSAR (práctica)',
    resumen: 'Solo para cursos con fase presencial: llevar los alumnos y traer las notas.',
    roles: ['profesor', 'super_admin'],
    pasos: [
      {
        titulo: 'Requisito: todos con documento',
        texto:
          'La nota práctica se cruza por **documento (DNI/NIE/pasaporte)**. Si algún alumno no lo tiene, no podrás '
          + 'exportarlo. El panel te avisa de quién falta.',
        ruta: '/admin/cursos/',
        target: '[data-tour="pulsar"]',
      },
      {
        titulo: 'Forma los subgrupos (opcional)',
        texto:
          'Si vas a trabajar por subgrupos de color (Rojo, Azul…), créalos aquí antes de exportar: automáticos '
          + '(reparto equilibrado) o manuales. Viajarán en el archivo.',
        ruta: '/admin/cursos/',
        target: '[data-tour="pulsar"]',
      },
      {
        titulo: 'Exporta el curso',
        texto:
          'Pulsa **Exportar para PÚLSAR**: descarga un archivo `curso-academia.json` con el curso, sus alumnos y '
          + 'los subgrupos. Ese archivo se importa en PÚLSAR para la práctica.',
        ruta: '/admin/cursos/',
        target: '[data-tour="pulsar"]',
      },
      {
        titulo: 'Tras la práctica, importa los resultados',
        texto:
          'PÚLSAR genera un `resultados-pulsar.json`. Súbelo aquí: primero verás una **vista previa** de a quién '
          + 'casa por documento y a quién no, antes de aplicar nada.',
        ruta: '/admin/cursos/',
        target: '[data-tour="pulsar"]',
      },
      {
        titulo: 'Y a cerrar el acta',
        texto:
          'Con la nota práctica ya dentro, el acta puede decidir quién es apto (teoría + práctica). Sigue con la '
          + 'guía **«Cerrar el curso y hacer el acta»**.',
      },
    ],
  },
];

export function guiasDe(rol: Role): Guia[] {
  return GUIAS.filter((g) => g.roles.includes(rol));
}

export function guiaPorId(id: string): Guia | undefined {
  return GUIAS.find((g) => g.id === id);
}
