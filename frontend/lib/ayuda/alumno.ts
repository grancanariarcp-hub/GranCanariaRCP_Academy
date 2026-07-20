import type { Articulo } from './tipos';

/** Todo lo que necesita saber quien estudia: cursos y preparación de oposiciones. */
export const ALUMNO: Articulo[] = [
  {
    id: 'alumno-panel',
    titulo: 'Mi panel de alumno',
    resumen: 'Lo que ves al entrar: tus cursos en marcha y los que puedes matricular.',
    seccion: 'Para el alumno',
    para: ['student'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'Al entrar aterrizas en tu panel, dividido en dos partes. Arriba, **mis cursos**: aquellos en los que ya estás matriculado, con tu avance. Debajo, **cursos disponibles**: los que tienen la matrícula abierta y puedes empezar hoy.',
      },
      {
        tipo: 'texto',
        texto:
          'Pulsa sobre cualquiera de tus cursos para entrar en el aula. Si el curso está pendiente de pago, verás el aviso y el botón para pagarlo.',
      },
      {
        tipo: 'duda',
        pregunta: 'No veo ningún curso disponible.',
        respuesta:
          'Significa que ahora mismo no hay ninguna edición con la matrícula abierta. Puedes dejar tu correo en el formulario de aviso y te escribiremos en cuanto se abra la siguiente.',
      },
      {
        tipo: 'truco',
        texto:
          'Si preparas una oposición, tu sitio no es este panel sino [Oposiciones](/student/ope), que funciona de forma completamente distinta.',
      },
    ],
    relacionados: ['alumno-matricula', 'alumno-aula', 'ope-panel'],
  },

  {
    id: 'alumno-matricula',
    titulo: 'Matricularme y pagar',
    resumen: 'Cómo apuntarse a un curso y por qué hay que pagar antes de entrar.',
    seccion: 'Para el alumno',
    para: ['student', 'publico'],
    cuerpo: [
      {
        tipo: 'pasos',
        pasos: [
          'Abre la ficha del curso desde tu panel o desde el catálogo público.',
          'Lee el programa, las fechas y los créditos. Todo lo que necesitas decidir está ahí.',
          'Pulsa **Matricularme**.',
          'Si el curso es gratuito, ya estás dentro. Si es de pago, pasas a la pantalla de pago.',
        ],
      },
      { tipo: 'titulo', texto: 'El pago va antes que el contenido' },
      {
        tipo: 'texto',
        texto:
          'Mientras la matrícula esté sin pagar, el curso aparece como **pendiente de pago** y el contenido está cerrado. No es una restricción caprichosa: evita la situación incómoda de que alguien consuma el curso entero y luego no pague.',
      },
      { tipo: 'titulo', texto: 'Matrícula anticipada' },
      {
        tipo: 'texto',
        texto:
          'Muchos cursos tienen **precio anticipado**: si te matriculas antes de una fecha, pagas menos. Pasada esa fecha el precio sube automáticamente. La ficha del curso te dice siempre qué precio te corresponde hoy y hasta cuándo dura el anticipado.',
      },
      {
        tipo: 'aviso',
        texto:
          'El precio que se te aplica es el del **día en que pagas**, no el del día en que te matriculas. Si te matriculas dentro del plazo anticipado pero pagas después, se aplica el precio con recargo.',
      },
      {
        tipo: 'duda',
        pregunta: '¿Me dan factura?',
        respuesta:
          'Cada pago genera un justificante numerado que puedes descargar desde tu perfil. Las actividades docentes están exentas de IGIC e IVA, así que el justificante no desglosa impuestos.',
      },
    ],
    relacionados: ['alumno-aula', 'alumno-perfil'],
  },

  {
    id: 'alumno-aula',
    titulo: 'Dentro del curso',
    resumen: 'Módulos, material, foro y cómo se cuenta tu tiempo de estudio.',
    seccion: 'Para el alumno',
    para: ['student'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'El aula es donde ocurre todo. El curso está dividido en **módulos**, y cada módulo contiene actividades: documentos para leer, vídeos, tests de repaso y, al final, el examen.',
      },
      {
        tipo: 'texto',
        texto:
          'El primer módulo suele ser **Bienvenida**: léelo, porque ahí está lo concreto de esta edición (fechas, horarios, qué material hace falta, cómo se aprueba).',
      },
      { tipo: 'titulo', texto: 'El tiempo de estudio' },
      {
        tipo: 'texto',
        texto:
          'La plataforma mide cuánto tiempo dedicas realmente al curso. Solo cuenta mientras estás activo: si dejas la pestaña abierta y te vas a comer, ese rato no suma.',
      },
      {
        tipo: 'texto',
        texto:
          'Esto importa porque la formación acreditada tiene que justificar horas ante la Comisión. No es vigilancia: es lo que permite que tu certificado tenga créditos.',
      },
      { tipo: 'titulo', texto: 'El foro' },
      {
        tipo: 'texto',
        texto:
          'Cada curso tiene su foro de dudas. Pregunta ahí antes que por correo: la respuesta le sirve a más gente, y el profesorado la ve antes.',
      },
      {
        tipo: 'truco',
        texto:
          'Las actividades se marcan como completadas a medida que avanzas. Es la forma más rápida de saber por dónde ibas cuando vuelves al cabo de unos días.',
      },
    ],
    relacionados: ['alumno-examen', 'alumno-certificados', 'alumno-asistencia'],
  },

  {
    id: 'alumno-examen',
    titulo: 'Hacer el examen',
    resumen: 'La encuesta obligatoria previa, cómo se aprueba y qué pasa si suspendes.',
    seccion: 'Para el alumno',
    para: ['student'],
    cuerpo: [
      {
        tipo: 'aviso',
        texto:
          'Antes del **examen final** tienes que responder la encuesta de satisfacción del curso. Si intentas empezar sin haberla contestado, la plataforma te lo pedirá. Es un requisito de la acreditación, no un capricho: la valoración del alumnado forma parte del expediente.',
      },
      {
        tipo: 'pasos',
        pasos: [
          'Responde la encuesta de satisfacción si aún no lo has hecho.',
          'Entra en el examen desde el módulo correspondiente.',
          'Responde las preguntas. Si el examen tiene tiempo límite, lo verás en pantalla.',
          'Envía. Verás inmediatamente tu nota y si has aprobado.',
        ],
      },
      { tipo: 'titulo', texto: 'Los tests de repaso son otra cosa' },
      {
        tipo: 'texto',
        texto:
          'Dentro de los módulos hay tests de repaso que puedes repetir cuantas veces quieras: están para aprender, no para calificarte. El que cuenta para el certificado es el **examen final**.',
      },
      {
        tipo: 'duda',
        pregunta: 'He suspendido, ¿puedo repetir?',
        respuesta:
          'Depende de lo que haya decidido la dirección del curso para esa edición. Si no ves el botón para volver a intentarlo, escribe en el foro o contacta con tu profesor: es él quien puede habilitarte un nuevo intento.',
      },
      {
        tipo: 'duda',
        pregunta: 'Se me ha ido internet en mitad del examen.',
        respuesta:
          'Vuelve a entrar. Tus respuestas se van guardando conforme respondes, así que recuperarás el intento donde lo dejaste. Si el examen tenía tiempo, el reloj sigue corriendo mientras tanto.',
      },
    ],
    relacionados: ['alumno-certificados', 'alumno-aula'],
  },

  {
    id: 'alumno-asistencia',
    titulo: 'Fichar la asistencia con el QR',
    resumen: 'Cómo registrar entrada y salida en los cursos presenciales.',
    seccion: 'Para el alumno',
    para: ['student'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'En los cursos presenciales hay que dejar constancia de que estuviste. El profesor proyecta un **código QR** en la pantalla del aula y cada alumno lo escanea con su móvil.',
      },
      {
        tipo: 'pasos',
        pasos: [
          'Entra en **Mi perfil → Asistencia**, o abre el curso desde el móvil.',
          'Pulsa el botón de escanear en la jornada correspondiente. Se abre la cámara.',
          'Apunta al QR proyectado.',
          'Aparece un aviso: *"registraste tu entrada, ¿confirmas?"*. Confirma.',
        ],
      },
      {
        tipo: 'texto',
        texto:
          'Se ficha dos veces por jornada: al **entrar** y al **salir**. La segunda importa tanto como la primera, porque es la que acredita que hiciste las horas completas.',
      },
      {
        tipo: 'aviso',
        texto:
          'El QR proyectado **cambia cada pocos segundos**. Es a propósito: así una foto del código enviada por WhatsApp no sirve para fichar desde casa. Tienes que estar en la sala.',
      },
      {
        tipo: 'duda',
        pregunta: 'Mi móvil no abre la cámara al pulsar escanear.',
        respuesta:
          'Algunos navegadores antiguos no permiten leer códigos dentro de la web. En ese caso la plataforma te ofrece abrir la cámara normal del móvil: escanea con ella y el propio QR te traerá de vuelta a la pantalla de confirmación.',
      },
      {
        tipo: 'duda',
        pregunta: 'Llegué tarde y no pude fichar.',
        respuesta:
          'Díselo al profesor. Puede marcarte la asistencia a mano desde su panel, dejando registro de que fue un registro manual.',
      },
    ],
    relacionados: ['instalar-app', 'alumno-certificados'],
  },

  {
    id: 'alumno-certificados',
    titulo: 'Mis certificados y diplomas',
    resumen: 'Cuándo se consiguen, en qué se diferencian y cómo se descargan.',
    seccion: 'Para el alumno',
    para: ['student'],
    cuerpo: [
      { tipo: 'titulo', texto: 'Certificado del curso' },
      {
        tipo: 'texto',
        texto:
          'Es el documento acreditado, con créditos. Para descargarlo hacen falta dos cosas: haber **aprobado el examen final** y haber **respondido la encuesta** del curso.',
      },
      {
        tipo: 'texto',
        texto:
          'Se descarga desde el propio curso, en formato PDF listo para imprimir. Lleva un código de verificación y un QR con los que cualquiera puede comprobar que es auténtico.',
      },
      { tipo: 'titulo', texto: 'Diplomas de participación' },
      {
        tipo: 'texto',
        texto:
          'Son otra cosa: reconocen que has participado en un desafío de RCP o que has acumulado horas de práctica. Los recibe **todo el que participa**, no solo quien gana, y aparecen solos en tu perfil al alcanzar cada hito.',
      },
      {
        tipo: 'aviso',
        texto:
          'Un diploma de participación no da créditos ni sustituye a un certificado de formación. Están pensados para compartir y para reconocer el esfuerzo, y el propio documento lo deja claro.',
      },
      {
        tipo: 'duda',
        pregunta: 'Aprobé pero no me deja descargar el certificado.',
        respuesta:
          'Casi siempre falta la encuesta de satisfacción del curso. Respóndela y el botón se activa.',
      },
    ],
    relacionados: ['verificar', 'alumno-perfil'],
  },

  {
    id: 'alumno-perfil',
    titulo: 'Mi perfil',
    resumen: 'Datos, asistencia, diplomas, dispositivos y suscripción, todo en un sitio.',
    seccion: 'Para el alumno',
    para: ['student'],
    cuerpo: [
      {
        tipo: 'texto',
        texto: 'Tu perfil reúne todo lo que es tuyo y no de un curso concreto:',
      },
      {
        tipo: 'lista',
        items: [
          '**Datos personales.** Nombre, correo y contraseña. El nombre es el que se imprimirá en tus certificados: revísalo antes de acabar el curso.',
          '**Asistencia.** Tus jornadas presenciales y el botón de fichar.',
          '**Diplomas.** Los reconocimientos que has ido consiguiendo.',
          '**Mis dispositivos.** Dónde tienes la sesión abierta, y el botón para cerrar la que no reconozcas.',
          '**Suscripción.** Si preparas una oposición, su estado y la opción de cancelarla.',
        ],
      },
      {
        tipo: 'truco',
        texto:
          'Si tu nombre está mal escrito, corrígelo **antes** de descargar el certificado: el documento se genera con el nombre que haya en ese momento.',
      },
    ],
    relacionados: ['dispositivos', 'ope-suscripcion', 'alumno-certificados'],
  },

  // -------------------------------------------------------------------------
  // Preparación de oposiciones
  // -------------------------------------------------------------------------
  {
    id: 'ope-panel',
    titulo: 'El panel de oposiciones',
    resumen: 'Por qué preparar una OPE funciona distinto y qué significa la cobertura.',
    seccion: 'Preparar una oposición',
    para: ['student', 'super_admin'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'Preparar una oposición no se parece a hacer un curso. No hay temario que avanzar de principio a fin: hay un **banco de preguntas** enorme que hay que machacar hasta dominarlo. Por eso tienes un panel propio en [Oposiciones](/student/ope) en lugar del de cursos.',
      },
      { tipo: 'titulo', texto: 'Cobertura: el dato que de verdad importa' },
      {
        tipo: 'texto',
        texto:
          'De cada oposición ves tu **cobertura**: qué porcentaje de las preguntas del banco has visto **al menos una vez**. Es distinto de tu porcentaje de aciertos, y suele ser más revelador.',
      },
      {
        tipo: 'texto',
        texto:
          'Se puede llevar un 85 % de aciertos y solo un 40 % de cobertura. Eso significa que aciertas mucho... en las mismas preguntas de siempre, mientras más de la mitad del banco sigue sin salirte nunca. El día del examen esas son justamente las que caen.',
      },
      { tipo: 'titulo', texto: 'El simulacro' },
      {
        tipo: 'texto',
        texto:
          'Cuando la oposición lo tiene configurado, puedes hacer un **simulacro**: mismo número de preguntas, mismo tiempo y misma nota de corte que el examen real. Sirve para entrenar el reloj, que es donde más gente se deja puntos.',
      },
      {
        tipo: 'aviso',
        texto:
          'Solo verás las oposiciones a las que te dé derecho una convocatoria abierta o una suscripción vigente. Si esperabas ver una y no aparece, es que la suscripción ha caducado.',
      },
    ],
    relacionados: ['ope-test', 'ope-estadisticas', 'ope-suscripcion'],
  },

  {
    id: 'ope-test',
    titulo: 'Generar un test',
    resumen: 'El asistente paso a paso y los botones de generación rápida.',
    seccion: 'Preparar una oposición',
    para: ['student', 'super_admin'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'Tú decides qué test quieres hacer. El asistente te lleva por los pasos: qué bancos usar, cuántas preguntas, de qué materias, con qué criterio y si quieres tiempo límite.',
      },
      { tipo: 'titulo', texto: 'Generación rápida' },
      {
        tipo: 'texto',
        texto:
          'Casi nunca hace falta el asistente completo. Los botones de generación rápida cubren lo que se usa el 90 % de las veces:',
      },
      {
        tipo: 'lista',
        items: [
          '**Mis fallos.** Solo las preguntas que fallaste la última vez. Es el estudio más rentable que existe.',
          '**Las que no he visto.** Ataca directamente tu punto ciego de cobertura.',
          '**Las que más falla la gente.** Las preguntas difíciles de verdad, según los resultados de toda la comunidad.',
          '**Simulacro.** Condiciones del examen real.',
        ],
      },
      { tipo: 'titulo', texto: 'Los tests se pueden repetir' },
      {
        tipo: 'texto',
        texto:
          'Cualquier test que hayas hecho se puede volver a lanzar con las mismas preguntas, para comprobar si de verdad has aprendido o solo lo recordabas de hace cinco minutos.',
      },
      {
        tipo: 'aviso',
        texto:
          'El orden de las **preguntas** se baraja, pero el de las **opciones** dentro de cada pregunta nunca. En las oposiciones que publican el pool de preguntas, la opción A tiene que seguir siendo la A: si las barajáramos, estudiarías un examen distinto del que te vas a encontrar.',
      },
    ],
    relacionados: ['ope-estadisticas', 'ope-panel'],
  },

  {
    id: 'ope-estadisticas',
    titulo: 'Entender mis estadísticas',
    resumen: 'Aciertos por materia, el punto ciego y cómo te comparas con la comunidad.',
    seccion: 'Preparar una oposición',
    para: ['student', 'super_admin'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'La pantalla de estadísticas responde a tres preguntas: **qué se me atraganta**, **en qué materia fallo más** y **qué me queda por ver**.',
      },
      { tipo: 'titulo', texto: 'Por materia' },
      {
        tipo: 'texto',
        texto:
          'Cada materia muestra cuántas preguntas tiene, cuántas has visto y tu porcentaje de acierto. Ordena mentalmente por acierto ascendente: arriba está lo que tienes que estudiar esta semana.',
      },
      { tipo: 'titulo', texto: 'El aviso de punto ciego' },
      {
        tipo: 'texto',
        texto:
          'Si has dado más respuestas que preguntas tiene el banco y aun así quedan preguntas sin salirte nunca, aparece un aviso. Traducido: llevas horas repitiendo el mismo trozo del temario. El aviso te dice cuántas preguntas siguen vírgenes y te ofrece generar un test justo con ellas.',
      },
      { tipo: 'titulo', texto: 'Comparación con la comunidad' },
      {
        tipo: 'texto',
        texto:
          'De cada pregunta puedes ver qué porcentaje de opositores la acierta. Sirve para calibrar: si fallas una que acierta el 90 %, es tu laguna. Si fallas una que falla el 70 %, es que la pregunta es dura y no vas mal.',
      },
      {
        tipo: 'truco',
        texto:
          'Tus fallos alimentan automáticamente tu banco personal de fallos, y los fallos de todos alimentan el banco de preguntas difíciles de la comunidad. No tienes que marcar nada a mano.',
      },
    ],
    relacionados: ['ope-test', 'ope-panel'],
  },

  {
    id: 'ope-suscripcion',
    titulo: 'La suscripción a una oposición',
    resumen: 'Precios, qué pasa al cancelar y por qué no hay devoluciones.',
    seccion: 'Preparar una oposición',
    para: ['student', 'super_admin'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'El acceso a una convocatoria se paga por suscripción. Cuanto más largo el periodo que contratas, más barato sale el mes:',
      },
      {
        tipo: 'lista',
        items: [
          '**Mensual** — 10 € al mes.',
          '**Trimestral** — 9 € al mes (27 € por tres meses).',
          '**Semestral** — 8 € al mes (48 € por seis meses).',
          '**Anual** — 7 € al mes (84 € por doce meses).',
        ],
      },
      { tipo: 'titulo', texto: 'Se paga el periodo entero por adelantado' },
      {
        tipo: 'texto',
        texto:
          'Al contratar pagas el periodo completo. A cambio tienes el acceso garantizado hasta la fecha de fin, pase lo que pase.',
      },
      { tipo: 'titulo', texto: 'Qué ocurre si cancelas' },
      {
        tipo: 'texto',
        texto:
          '**Conservas el acceso hasta el final del periodo que ya pagaste.** Lo que se cancela es la renovación, no lo contratado. No se devuelve el importe del periodo en curso, porque el servicio ya está prestado y disponible.',
      },
      {
        tipo: 'texto',
        texto:
          'Puedes cancelar cuando quieras desde **Perfil → Suscripción**, con un clic y sin dar explicaciones. No hay plazo mínimo de preaviso.',
      },
      { tipo: 'titulo', texto: 'Derecho de desistimiento' },
      {
        tipo: 'texto',
        texto:
          'Como consumidor tienes **14 días naturales** para desistir. Ahora bien: si empiezas a usar el contenido dentro de ese plazo, y así lo aceptas al contratar, pierdes el derecho a la devolución. Es lo que la ley prevé para el contenido digital de acceso inmediato.',
      },
      {
        tipo: 'aviso',
        texto:
          'Antes de contratar se te muestra toda la información precontractual obligatoria: precio total, duración, condiciones de renovación y cómo cancelar. Léela; forma parte del contrato.',
      },
    ],
    relacionados: ['ope-panel', 'alumno-perfil', 'dispositivos'],
  },
];
