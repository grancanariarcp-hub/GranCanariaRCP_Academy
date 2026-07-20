import type { Articulo } from './tipos';

/** Administración de la plataforma, centros educativos y auditoría CFC. */
export const ADMIN: Articulo[] = [
  {
    id: 'admin-resumen',
    titulo: 'El panel de resumen',
    resumen: 'Qué mide cada bloque de la portada de administración.',
    seccion: 'Administración',
    para: ['super_admin'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'El resumen reúne el pulso de la plataforma: cuánta gente hay, qué cursos están en marcha, qué instituciones participan y qué está esperando una decisión tuya.',
      },
      {
        tipo: 'lista',
        items: [
          '**Métricas generales.** Alumnos, cursos y actividad reciente.',
          '**Práctica sin registro.** Cuánta gente prueba la zona gratuita y cuántos acaban registrándose. Es tu medida de si la divulgación convierte.',
          '**Pendientes.** Avisos de apertura, indicios de uso compartido y estado de la pasarela.',
          '**Instituciones.** Centros dados de alta y su actividad.',
          '**Ajustes.** Configuración general, como los grupos de WhatsApp.',
        ],
      },
      {
        tipo: 'truco',
        texto:
          'El bloque de práctica sin registro es el más útil para decidir dónde invertir esfuerzo: te dice si la zona gratuita atrae gente y si esa gente acaba entrando al campus de pago.',
      },
    ],
    relacionados: ['admin-pendientes', 'admin-profesores'],
  },

  {
    id: 'admin-pendientes',
    titulo: 'Avisos, uso compartido y pasarela',
    resumen: 'Las tres cosas que la plataforma recoge y necesitan tu criterio.',
    seccion: 'Administración',
    para: ['super_admin'],
    cuerpo: [
      { tipo: 'titulo', texto: 'Avisos de apertura' },
      {
        tipo: 'texto',
        texto:
          'Los correos de quien pidió que le avisáramos cuando se abra matrícula. Aparecen aquí porque son gente que ya levantó la mano: es la lista más caliente que tienes.',
      },
      {
        tipo: 'aviso',
        texto:
          'Dieron su consentimiento **solo** para avisarles de la apertura de matrícula. Usarlos para una campaña distinta sería tratar sus datos para una finalidad que no consintieron.',
      },
      { tipo: 'titulo', texto: 'Posible uso compartido' },
      {
        tipo: 'texto',
        texto:
          'Cuentas con un número llamativo de dispositivos o conexiones en los últimos catorce días. Sirve para detectar una suscripción repartida entre media plantilla.',
      },
      {
        tipo: 'aviso',
        texto:
          'Es un **indicio, no una prueba**. Quien estudia desde el hospital, su casa y la biblioteca, y cambia de móvil, sale exactamente igual en esta lista. Mira el caso antes de actuar; el límite de dos sesiones simultáneas ya hace casi todo el trabajo por sí solo.',
      },
      { tipo: 'titulo', texto: 'Pasarela de pago' },
      {
        tipo: 'texto',
        texto:
          'Muestra si Stripe está en pruebas o en producción, si el webhook está configurado y si los cobros están habilitados. Míralo antes de abrir matrícula de un curso de pago: en modo pruebas nadie te pagará de verdad.',
      },
    ],
    relacionados: ['admin-resumen', 'profesor-pagos', 'dispositivos'],
  },

  {
    id: 'admin-profesores',
    titulo: 'Validar profesores',
    resumen: 'Por qué las cuentas de profesor no se activan solas.',
    seccion: 'Administración',
    para: ['super_admin'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'Cuando alguien se registra como profesor, su cuenta queda **pendiente** y no puede entrar hasta que tú la validas. En formación sanitaria acreditada, quién enseña no puede ser una casilla que cualquiera marque.',
      },
      {
        tipo: 'pasos',
        pasos: [
          'Entra en **Profesores**.',
          'Revisa la solicitud: quién es y qué dice ejercer.',
          'Valida o rechaza.',
          'Al validar, la persona ya puede entrar y empezar a preparar su curso.',
        ],
      },
      {
        tipo: 'truco',
        texto:
          'Validar la cuenta no publica nada. Antes de poder publicar un curso, el profesor tendrá que completar su perfil docente, que es donde de verdad acredita su currículum.',
      },
    ],
    relacionados: ['profesor-perfil', 'admin-resumen'],
  },

  {
    id: 'admin-convocatorias',
    titulo: 'Crear una convocatoria de oposición',
    resumen: 'El flujo completo: convocatoria, bancos, ficha y publicación.',
    seccion: 'Administración',
    para: ['super_admin'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'Una convocatoria es una oposición concreta —comunidad, categoría y año— a la que se suscriben los opositores. Por debajo **es un curso**, así que hereda todo lo que ya sabe hacer la plataforma: matrícula, cobro y ficha.',
      },
      {
        tipo: 'pasos',
        pasos: [
          'En **Convocatorias**, créala eligiendo comunidad autónoma, categoría y año.',
          'La plataforma crea sola la ficha del curso y su módulo de Bienvenida. No tienes que montar nada.',
          'Asígnale los **bancos de preguntas** que dan derecho a practicar.',
          'Configura los precios de suscripción.',
          'Publica y abre matrícula.',
        ],
      },
      { tipo: 'titulo', texto: 'Comunidades y categorías' },
      {
        tipo: 'texto',
        texto:
          'Las comunidades autónomas se eligen de un desplegable, para que no acaben escritas de cinco formas distintas. Entre las categorías están las sanitarias habituales y también **MIR, EIR y FIR**.',
      },
      {
        tipo: 'aviso',
        texto:
          'Los bancos que asignes son exactamente lo que el opositor podrá practicar. Un banco sin asignar a ninguna convocatoria no lo ve nadie, por mucho que esté publicado.',
      },
      {
        tipo: 'truco',
        texto:
          'Aprovecha la Bienvenida generada automáticamente para explicar qué entra en esa oposición y cómo se ha construido el banco. Es lo primero que abre quien se suscribe.',
      },
    ],
    relacionados: ['profesor-bancos', 'ope-suscripcion', 'ope-panel'],
  },

  {
    id: 'admin-desafios',
    titulo: 'Gestionar los desafíos',
    resumen: 'Crear, editar y publicar los retos abiertos de RCP.',
    seccion: 'Administración',
    para: ['super_admin'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'Los desafíos son la puerta de entrada de la gente que aún no te conoce. Desde **Desafíos** los creas y los editas: título, presentación, preguntas y si está activo.',
      },
      {
        tipo: 'truco',
        texto:
          'Un desafío corto se termina; uno largo se abandona. Diez o quince preguntas bien elegidas convierten mucho mejor que cuarenta.',
      },
      {
        tipo: 'texto',
        texto:
          'Todo participante recibe un diploma de agradecimiento, y los resultados alimentan el ranking individual y el de instituciones. Ese ranking es lo que engancha a los centros educativos.',
      },
    ],
    relacionados: ['desafios-publico', 'admin-diplomas'],
  },

  {
    id: 'admin-diplomas',
    titulo: 'Plantillas de diplomas',
    resumen: 'Los reconocimientos por participación y por horas de práctica.',
    seccion: 'Administración',
    para: ['super_admin'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'Los diplomas se emiten solos cuando alguien alcanza un hito: participar en un desafío, acumular horas de práctica. Aquí defines qué hitos existen y qué dice cada diploma.',
      },
      {
        tipo: 'texto',
        texto:
          'El texto agradece la participación —*«Gran Canaria RCP agradece a … por participar en el Desafío RCP y contribuir a que nuestra sociedad esté realmente cardioprotegida»*— porque el objetivo es reconocer, no calificar.',
      },
      {
        tipo: 'texto',
        texto:
          'Puedes asignar a cada plantilla una **imagen de fondo** propia. Sin ella el diploma sale correcto pero sobrio.',
      },
      {
        tipo: 'aviso',
        texto:
          'Cada diploma advierte de que no es formación acreditada. No lo quites: es lo que impide que se confunda con un certificado con créditos.',
      },
    ],
    relacionados: ['admin-desafios', 'alumno-certificados'],
  },

  {
    id: 'admin-cfc',
    titulo: 'Accesos de la Comisión CFC',
    resumen: 'Crear cuentas de auditoría y qué puede hacer cada una.',
    seccion: 'Administración',
    para: ['super_admin'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'Para acreditar la formación, la Comisión necesita poder mirar dentro de la plataforma. Desde **Comisión CFC** creas cuentas de auditor con **fecha de caducidad**.',
      },
      { tipo: 'titulo', texto: 'Qué puede hacer un auditor' },
      {
        tipo: 'lista',
        items: [
          '**Ve** los cursos completos: módulos, material, exámenes y bancos de preguntas.',
          '**No descarga** nada.',
          '**No ve** calificaciones nominales de alumnos.',
          '**No aparece** en las actas: no es alumno ni profesor de nada.',
          'Cada cosa que consulta **queda registrada** en la auditoría.',
        ],
      },
      {
        tipo: 'aviso',
        texto:
          'Crea una cuenta **por persona**, no una compartida para toda la comisión. Con una cuenta común, el registro de auditoría no distingue quién miró qué, que es justamente para lo que sirve.',
      },
      {
        tipo: 'truco',
        texto:
          'Pon la caducidad al final del periodo de evaluación. Un acceso que expira solo es un acceso que no se te olvida cerrar.',
      },
    ],
    relacionados: ['auditor-guia', 'profesor-acta'],
  },

  // -------------------------------------------------------------------------
  {
    id: 'institucion-panel',
    titulo: 'Gestionar mi institución',
    resumen: 'Datos del centro y alta de maestros.',
    seccion: 'Centros educativos',
    para: ['institution_admin', 'super_admin'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'Desde el panel de la institución mantienes los datos del centro y das de alta a los **maestros** que trabajarán con sus clases.',
      },
      {
        tipo: 'pasos',
        pasos: [
          'Revisa los datos del centro: son los que aparecen en el ranking de instituciones.',
          'Da de alta a cada maestro con su nombre y correo.',
          'El maestro recibe su acceso y ya puede crear sus clases.',
        ],
      },
      {
        tipo: 'texto',
        texto:
          'La participación de tus alumnos en los desafíos suma al ranking del centro. Es lo que convierte la formación en RCP en un proyecto de colegio y no en una actividad suelta.',
      },
    ],
    relacionados: ['maestro-clases', 'desafios-publico'],
  },

  {
    id: 'maestro-clases',
    titulo: 'Clases y códigos para menores',
    resumen: 'Cómo entran los alumnos menores sin dar datos personales.',
    seccion: 'Centros educativos',
    para: ['institution_teacher', 'institution_admin', 'super_admin'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'Un menor no debería tener que dar su correo para hacer un desafío de RCP en clase. Por eso los alumnos entran con un **código de clase**, sin cuenta de correo ni datos personales.',
      },
      {
        tipo: 'pasos',
        pasos: [
          'En **Mis clases**, crea la clase (por ejemplo, «3.º B»).',
          'La plataforma genera un **código** y su QR.',
          'Proyecta el QR o reparte el código.',
          'Cada alumno entra por [acceso con código](/login/menor) y elige un seudónimo.',
          'Desde el detalle de la clase sigues quién participa y sus resultados.',
        ],
      },
      {
        tipo: 'texto',
        texto:
          'El seudónimo es **único dentro de la clase**: no puede haber dos «Rayo». Así tú sabes quién es quién sin que la plataforma guarde el nombre real de un menor.',
      },
      {
        tipo: 'truco',
        texto:
          'Proyecta el QR en la pizarra digital: treinta alumnos entran en menos de un minuto, sin teclear nada.',
      },
    ],
    relacionados: ['institucion-panel', 'desafios-publico'],
  },

  // -------------------------------------------------------------------------
  {
    id: 'auditor-guia',
    titulo: 'Guía para la Comisión CFC',
    resumen: 'Qué puede consultar un auditor y qué límites tiene el acceso.',
    seccion: 'Comisión CFC',
    para: ['auditor', 'super_admin'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'Su acceso está pensado para **evaluar la formación**, con todo lo necesario para hacerlo y nada más. En el menú lateral tiene lo que puede revisar.',
      },
      { tipo: 'titulo', texto: 'Qué puede consultar' },
      {
        tipo: 'lista',
        items: [
          '**Cursos.** La ficha completa, los módulos y todo el material didáctico.',
          '**Exámenes.** Las preguntas y su configuración.',
          '**Bancos de preguntas.** El contenido íntegro del que salen los exámenes.',
        ],
      },
      { tipo: 'titulo', texto: 'Límites del acceso' },
      {
        tipo: 'lista',
        items: [
          'No se pueden **descargar** documentos ni certificados. La consulta es en pantalla.',
          'No se ven **calificaciones nominales**: la evaluación es de la formación, no de los alumnos.',
          'La cuenta **no figura** en las actas de los cursos.',
          'Toda consulta queda **registrada**, con fecha y qué se miró.',
        ],
      },
      {
        tipo: 'texto',
        texto:
          'El registro de accesos no es desconfianza: es la garantía, para ambas partes, de que el acceso se usó para lo que se concedió. Y las cuentas caducan solas al terminar el periodo de evaluación.',
      },
    ],
    relacionados: ['admin-cfc', 'verificar'],
  },
];
