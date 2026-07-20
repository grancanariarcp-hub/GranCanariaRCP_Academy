import type { Articulo } from './tipos';

/** Primeros pasos y zona pública: lo que sirve a cualquiera, tenga o no cuenta. */
export const GENERAL: Articulo[] = [
  {
    id: 'que-es',
    titulo: 'Qué es esta plataforma y cómo está organizada',
    resumen: 'El mapa general: campus de pago, zona gratuita y quién es quién.',
    seccion: 'Primeros pasos',
    para: ['publico', 'student', 'profesor', 'super_admin', 'institution_admin', 'institution_teacher', 'auditor'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'Gran Canaria RCP Academy es el campus de formación en reanimación cardiopulmonar. Conviven en él cuatro cosas distintas, y entender la diferencia ahorra casi todas las dudas:',
      },
      {
        tipo: 'lista',
        items: [
          '**Cursos acreditados.** Formación reglada, con matrícula, exámenes, asistencia y certificado con créditos. Es la parte seria y la que se audita.',
          '**Preparación de oposiciones (OPE).** No es un curso con temario: son bancos de preguntas que se practican por suscripción, con estadísticas de tu avance.',
          '**Desafíos y práctica libre.** Abiertos a cualquiera, sin pagar. Sirven para divulgar y para que la gente descubra que sabe menos RCP de lo que creía.',
          '**Diplomas de participación.** Un agradecimiento por participar en los desafíos o por horas de práctica. No son formación acreditada y así se dice en el propio diploma.',
        ],
      },
      { tipo: 'titulo', texto: 'Las dos direcciones web' },
      {
        tipo: 'texto',
        texto:
          '`campus.grancanariarcp.es` es el campus de pago, con los cursos acreditados. `campus.grancanariarcp.es/desafioRCP` es la zona gratuita y divulgativa. Son la misma plataforma; simplemente entran por puertas distintas según a quién quieras dirigir.',
      },
      { tipo: 'titulo', texto: 'Quién es quién' },
      {
        tipo: 'lista',
        items: [
          '**Alumno.** Se matricula, estudia, hace exámenes y recoge su certificado.',
          '**Profesor.** Crea y dirige cursos, sube material, escribe preguntas y firma actas.',
          '**Administrador de institución.** Gestiona un centro y da de alta a sus maestros.',
          '**Maestro.** Crea clases y códigos para que sus alumnos menores de edad entren sin dar datos personales.',
          '**Super admin (tú).** Lo ve todo y decide qué se publica.',
          '**Comisión CFC.** Acceso de solo lectura para auditar la formación acreditada.',
        ],
      },
      {
        tipo: 'truco',
        texto:
          'En cada pantalla verás un botón **?** junto a los títulos. Ábrelo: te explica exactamente esa pantalla, sin que tengas que buscar en el manual.',
      },
    ],
    relacionados: ['acceder', 'ayuda-como-funciona'],
  },

  {
    id: 'ayuda-como-funciona',
    titulo: 'Cómo usar la ayuda',
    resumen: 'Dónde está el botón de ayuda y cómo encontrar lo que buscas.',
    seccion: 'Primeros pasos',
    para: ['publico', 'student', 'profesor', 'super_admin', 'institution_admin', 'institution_teacher', 'auditor'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'La ayuda está pensada para consultarse **sin salir de lo que estabas haciendo**. Tienes tres formas de llegar a ella:',
      },
      {
        tipo: 'lista',
        items: [
          'El botón **?** junto al título de una sección explica esa sección concreta.',
          'El botón **Ayuda** de la barra superior explica **la pantalla entera** en la que estás.',
          'El [manual completo](/ayuda) reúne todo, con buscador, y se puede imprimir.',
        ],
      },
      {
        tipo: 'texto',
        texto:
          'La ayuda se abre en un panel lateral: la pantalla sigue detrás, así puedes leer e ir haciendo. Se cierra con la **X**, con la tecla **Esc** o pulsando fuera.',
      },
      {
        tipo: 'truco',
        texto:
          'El manual solo te muestra lo que corresponde a tu papel en la plataforma. Si eres alumno no te aparecerán las instrucciones para dirigir un curso, para que no te distraigan.',
      },
    ],
    relacionados: ['que-es'],
  },

  {
    id: 'acceder',
    titulo: 'Entrar en la plataforma',
    resumen: 'Las distintas puertas de acceso y qué hacer si no puedes entrar.',
    seccion: 'Primeros pasos',
    para: ['publico', 'student', 'profesor', 'super_admin', 'institution_admin', 'institution_teacher', 'auditor'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'Hay varias puertas porque hay públicos muy distintos, pero todas llevan al mismo sitio. Si te equivocas de puerta, no pasa nada: la plataforma te lleva a tu panel igualmente.',
      },
      {
        tipo: 'lista',
        items: [
          '[Acceso de alumnos](/login/student) — con tu correo y contraseña.',
          '[Acceso con código de clase](/login/menor) — para alumnos menores de edad, sin correo.',
          '[Acceso de gestión](/login/admin) — profesorado, instituciones y administración.',
        ],
      },
      { tipo: 'titulo', texto: 'Si no tienes cuenta todavía' },
      {
        tipo: 'texto',
        texto:
          'Ve a [registro](/registro). Verás tres pestañas: **persona** (te das de alta y ya puedes matricularte), **profesor** (tu solicitud queda pendiente hasta que la valide un administrador) e **institución** (para dar de alta un centro).',
      },
      { tipo: 'titulo', texto: 'Problemas al entrar' },
      {
        tipo: 'duda',
        pregunta: 'Me dice que la contraseña no es correcta y estoy seguro de que sí lo es.',
        respuesta:
          'Comprueba que no tienes activado el bloqueo de mayúsculas y que no se ha colado un espacio al pegarla. Si has fallado muchas veces seguidas, la plataforma bloquea los intentos unos minutos para protegerte de quien intente adivinarla: espera un poco y vuelve a probar.',
      },
      {
        tipo: 'duda',
        pregunta: 'Me registré como profesor y no puedo entrar.',
        respuesta:
          'Las cuentas de profesor las valida una persona antes de activarse. Hasta entonces el acceso está cerrado. Es a propósito: quien enseña formación acreditada tiene que estar comprobado.',
      },
      {
        tipo: 'duda',
        pregunta: 'Al pulsar "volver" me parece que se cierra mi sesión.',
        respuesta:
          'No se cierra. Todas las páginas tienen arriba una flecha **Volver** y un enlace **Inicio** que te devuelven a tu panel con la sesión intacta. La única forma de cerrar sesión es el botón **Salir**.',
      },
    ],
    relacionados: ['dispositivos', 'instalar-app'],
  },

  {
    id: 'dispositivos',
    titulo: 'Cuántos dispositivos puedo usar',
    resumen: 'El límite de sesiones abiertas y por qué existe.',
    seccion: 'Primeros pasos',
    para: ['student', 'profesor', 'super_admin'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'Tu cuenta puede estar abierta en **dos dispositivos a la vez**. Suficiente para el móvil y el ordenador, que es como estudia casi todo el mundo.',
      },
      {
        tipo: 'texto',
        texto:
          'Si entras en un tercero, se cierra automáticamente la sesión más antigua. No pierdes nada: lo que estuvieras haciendo queda guardado.',
      },
      {
        tipo: 'texto',
        texto:
          'En **Perfil → Mis dispositivos** ves cuáles tienes abiertos y puedes cerrar el que no reconozcas.',
      },
      {
        tipo: 'aviso',
        texto:
          'El límite existe para que una suscripción no se reparta entre diez personas. No te penaliza por cambiar de móvil ni por estudiar desde el hospital, casa y la biblioteca: puedes entrar desde donde quieras, solo no desde muchos sitios **al mismo tiempo**.',
      },
    ],
    relacionados: ['acceder', 'ope-suscripcion'],
  },

  {
    id: 'instalar-app',
    titulo: 'Instalar el campus en el móvil',
    resumen: 'Tenerlo como una app, con su icono, sin pasar por ninguna tienda.',
    seccion: 'Primeros pasos',
    para: ['publico', 'student', 'profesor', 'super_admin', 'institution_admin', 'institution_teacher'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'El campus se puede instalar como una aplicación: icono propio en la pantalla de inicio y sin la barra del navegador estorbando. No hay que descargar nada de ninguna tienda.',
      },
      {
        tipo: 'pasos',
        pasos: [
          'Abre el campus en el navegador del móvil.',
          'En **Android (Chrome)**: aparece un botón **Instalar app** abajo; si no lo ves, usa el menú ⋮ → *Añadir a pantalla de inicio*.',
          'En **iPhone (Safari)**: pulsa el botón de compartir (el cuadrado con la flecha) → *Añadir a pantalla de inicio*.',
        ],
      },
      {
        tipo: 'truco',
        texto:
          'Instalado es mucho más cómodo para fichar la asistencia con el QR en los cursos presenciales: se abre la cámara directamente sin dar rodeos.',
      },
    ],
    relacionados: ['alumno-asistencia'],
  },

  {
    id: 'mis-datos',
    titulo: 'Mis datos y darme de baja',
    resumen: 'Qué guardamos de ti, cómo llevártelo y cómo cerrar tu cuenta.',
    seccion: 'Primeros pasos',
    para: ['student', 'profesor', 'super_admin', 'institution_admin', 'institution_teacher'],
    cuerpo: [
      { tipo: 'titulo', texto: 'Llevarte tus datos' },
      {
        tipo: 'texto',
        texto:
          'Desde tu perfil puedes descargar un documento con todo lo que consta a tu nombre: tus datos, tus cursos y tus resultados. Se genera en el momento y no se guarda en ninguna parte.',
      },
      { tipo: 'titulo', texto: 'Permisos que has dado' },
      {
        tipo: 'lista',
        items: [
          '**Aparecer en los rankings públicos.** Si lo desactivas sigues participando y conservas tus diplomas: solo dejas de salir en la clasificación.',
          '**Recibir avisos de nuevos cursos.** Nunca hace falta para usar la plataforma y se puede quitar cuando quieras.',
        ],
      },
      { tipo: 'titulo', texto: 'Darte de baja' },
      {
        tipo: 'texto',
        texto:
          'Cierra tu cuenta y borra tus datos personales. Se te pedirá la contraseña para confirmar, porque no es una acción que se pueda deshacer.',
      },
      {
        tipo: 'aviso',
        texto:
          'Tus **certificados y las actas de los cursos se conservan**. Acreditan formación, otras personas pueden tener que verificarlos años después y la ley obliga a mantenerlos. Lo que desaparece es quién eras: dejan de estar asociados a tu nombre en la plataforma.',
      },
      {
        tipo: 'duda',
        pregunta: 'Me he dado de baja por error, ¿puedo recuperar la cuenta?',
        respuesta:
          'No desde la plataforma. Escríbenos: el expediente académico sigue existiendo, pero recuperar el acceso requiere intervención manual.',
      },
    ],
    relacionados: ['alumno-perfil', 'dispositivos'],
  },
  {
    id: 'desafios-publico',
    titulo: 'Los desafíos de RCP',
    resumen: 'Qué son, cómo se participa y cómo funciona el ranking.',
    seccion: 'Zona pública',
    para: ['publico', 'student', 'super_admin'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'Un desafío es un cuestionario corto y abierto a cualquiera, del tipo *"¿qué tanto sabes de RCP?"*. No hay que pagar ni, para muchos de ellos, registrarse. Su objetivo no es evaluar: es que la gente descubra sus lagunas y quiera cerrarlas.',
      },
      {
        tipo: 'pasos',
        pasos: [
          'Entra en [Desafíos](/desafios) y elige uno.',
          'Responde. Al terminar ves tu nota y qué has fallado.',
          'Si has entrado con tu cuenta, el resultado se guarda y suma al [ranking](/rankings).',
        ],
      },
      { tipo: 'titulo', texto: 'El ranking' },
      {
        tipo: 'texto',
        texto:
          'Hay dos clasificaciones: **individual** y **por institución**. La de instituciones es la interesante para los centros educativos, porque convierte la formación en RCP en algo colectivo: un colegio entero compite por estar arriba.',
      },
      {
        tipo: 'texto',
        texto:
          'Todo el que participa recibe un **diploma de agradecimiento**, no solo quien gana. La idea es reconocer la participación, que es lo que de verdad cardioprotege a una sociedad.',
      },
      {
        tipo: 'aviso',
        texto:
          'Un diploma de participación **no es** formación acreditada y no da créditos. El propio diploma lo dice, para que nadie lo confunda con un certificado de curso.',
      },
    ],
    relacionados: ['practica-libre', 'verificar'],
  },

  {
    id: 'practica-libre',
    titulo: 'La práctica libre',
    resumen: 'Un test gratuito sin registrarse, y qué pasa después.',
    seccion: 'Zona pública',
    para: ['publico', 'student', 'super_admin'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'En [Práctica RCP básico](/practica) cualquiera puede hacer **un test completo sin registrarse**: sin formulario, sin correo, sin nada. Se responde y se ve la nota.',
      },
      {
        tipo: 'texto',
        texto:
          'Al terminar ese primer test aparece la invitación a crear una cuenta para seguir practicando. Es deliberado: primero se demuestra que el contenido vale, y solo entonces se pide algo a cambio.',
      },
      {
        tipo: 'texto',
        texto:
          'Con cuenta, además, se guarda tu historial: qué has fallado, cuánto has mejorado y qué te queda por ver.',
      },
    ],
    relacionados: ['desafios-publico', 'alumno-panel'],
  },

  {
    id: 'verificar',
    titulo: 'Verificar un certificado, un acta o un diploma',
    resumen: 'Comprobar que un documento es auténtico sin tener cuenta.',
    seccion: 'Zona pública',
    para: ['publico', 'student', 'profesor', 'super_admin', 'auditor'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'Todo documento que emite la plataforma lleva un **código de verificación** y un QR. Cualquiera —una empresa, un tribunal de oposición, la propia Comisión— puede comprobar que es auténtico sin necesidad de cuenta.',
      },
      {
        tipo: 'pasos',
        pasos: [
          'Escanea el QR del documento, o teclea la dirección que aparece impresa.',
          'La página muestra los datos reales guardados en la plataforma.',
          'Si el código no existe o fue anulado, lo dice claramente.',
        ],
      },
      {
        tipo: 'texto',
        texto:
          'Hay tres tipos de verificación: **certificado** (formación acreditada de una persona), **acta** (el resultado global de una edición del curso) y **diploma** (participación en desafíos o prácticas).',
      },
      {
        tipo: 'aviso',
        texto:
          'La verificación de un acta muestra solo datos agregados —cuántos aprobaron, qué curso, qué fechas—, nunca la lista nominal de alumnos. Publicar nombres de participantes en una página abierta sería una cesión de datos personales sin base legal.',
      },
    ],
    relacionados: ['alumno-certificados', 'profesor-acta'],
  },
];
