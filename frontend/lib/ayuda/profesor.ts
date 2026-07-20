import type { Articulo } from './tipos';

/** Guía del profesorado: desde el alta hasta el acta firmada. */
export const PROFESOR: Articulo[] = [
  {
    id: 'profesor-empezar',
    titulo: 'Primeros pasos como profesor',
    resumen: 'El recorrido completo, del alta al certificado, en un vistazo.',
    seccion: 'Para el profesorado',
    para: ['profesor', 'super_admin'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'Dirigir un curso tiene muchas piezas, pero siempre en el mismo orden. Este es el recorrido completo; cada paso tiene su propia ayuda detallada.',
      },
      {
        tipo: 'pasos',
        pasos: [
          '**Completa tu perfil docente.** Sin él no podrás publicar. Es lo primero por una razón: si lo dejas para el final, te bloqueará el día que quieras abrir matrícula.',
          '**Sube tu material** a Documentos: guías, protocolos, presentaciones.',
          '**Escribe preguntas** y agrúpalas en bancos.',
          '**Crea el curso** y rellena su ficha: título, fechas, horas, créditos.',
          '**Monta los módulos** y sus actividades con el material y los tests.',
          '**Configura el examen** final eligiendo de qué bancos salen las preguntas.',
          '**Pon el precio** de matrícula, con precio anticipado si quieres.',
          '**Publica y abre matrícula.**',
          '**Durante el curso:** pasa lista, responde el foro.',
          '**Al terminar:** cierra el acta y emite los certificados.',
        ],
      },
      {
        tipo: 'truco',
        texto:
          'Un curso solo se puede editar cuando está en **borrador**. Si ya lo publicaste y necesitas cambiar algo, devuélvelo a borrador, edítalo y vuelve a publicarlo.',
      },
    ],
    relacionados: ['profesor-perfil', 'profesor-curso-crear', 'profesor-documentos'],
  },

  {
    id: 'profesor-perfil',
    titulo: 'Completar mi perfil docente',
    resumen: 'Los cuatro requisitos y por qué son obligatorios para publicar.',
    seccion: 'Para el profesorado',
    para: ['profesor', 'super_admin'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'En formación sanitaria, el alumno tiene derecho a saber quién le enseña. Por eso el perfil docente es obligatorio **para publicar un curso** — no para registrarte.',
      },
      { tipo: 'titulo', texto: 'Los cuatro requisitos' },
      {
        tipo: 'lista',
        items: [
          '**Titular profesional.** Una línea que te describa: *«Enfermero de UCI · Instructor de SVA»*.',
          '**Profesión sanitaria.** La colegiada: médico, enfermero, técnico de emergencias…',
          '**Al menos una formación.** Titulación, especialidad o curso relevante para lo que impartes.',
          '**Al menos una experiencia.** Dónde ejerces o has ejercido, y desde cuándo.',
        ],
      },
      {
        tipo: 'texto',
        texto:
          'Es un mínimo razonable, no un currículum académico completo: lo justo para que quien se matricula sepa quién firma el curso. Puedes añadir todo lo que quieras por encima de eso.',
      },
      {
        tipo: 'texto',
        texto:
          'Lo que rellenes aquí es lo que se ve en tu **ficha pública** y en el bloque de profesorado de la web. Escríbelo pensando en un alumno que te está leyendo para decidir si se matricula.',
      },
      {
        tipo: 'aviso',
        texto:
          'Mientras el perfil esté incompleto verás un aviso en tu panel con lo que falta. No es decorativo: el botón de publicar estará bloqueado hasta que lo completes.',
      },
    ],
    relacionados: ['profesor-curso-crear', 'profesor-empezar'],
  },

  {
    id: 'profesor-documentos',
    titulo: 'Subir material y el espacio disponible',
    resumen: 'Cómo funciona el almacén de documentos y cuánto puedes ocupar.',
    seccion: 'Para el profesorado',
    para: ['profesor', 'super_admin'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'En **Documentos** subes una vez cada archivo y luego lo reutilizas en todos los cursos que quieras. No hace falta volver a subirlo en cada edición.',
      },
      {
        tipo: 'pasos',
        pasos: [
          'Entra en **Documentos** y pulsa subir.',
          'Elige el archivo (PDF, imagen, presentación…).',
          'Ponle un nombre que reconozcas dentro de seis meses, no «documento1».',
          'Ya puedes usarlo desde cualquier actividad de cualquier curso.',
        ],
      },
      { tipo: 'titulo', texto: 'Tu espacio' },
      {
        tipo: 'texto',
        texto:
          'Cada profesor dispone de **500 MB gratuitos**, suficiente para varios cursos con guías y presentaciones. En la pantalla de Documentos ves siempre cuánto llevas ocupado.',
      },
      {
        tipo: 'texto',
        texto:
          'Si intentas subir algo que no cabe, la plataforma te dice cuánto espacio te queda y cuánto ocupa ese archivo, para que sepas qué borrar.',
      },
      {
        tipo: 'truco',
        texto:
          'Los vídeos son lo que devora el espacio. Súbelos a YouTube o Vimeo como *no listados* y enlázalos desde una actividad: no consumen nada de tu cuota y se ven mejor.',
      },
    ],
    relacionados: ['profesor-curso-modulos'],
  },

  {
    id: 'profesor-preguntas',
    titulo: 'Escribir preguntas',
    resumen: 'Tipos de pregunta y cómo redactarlas para que enseñen algo.',
    seccion: 'Para el profesorado',
    para: ['profesor', 'super_admin'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'Las preguntas se escriben una vez y se reutilizan en tests de repaso, exámenes y desafíos. Viven en **bancos**, que son las carpetas donde las organizas.',
      },
      { tipo: 'titulo', texto: 'Tipos disponibles' },
      {
        tipo: 'lista',
        items: [
          '**Opción múltiple.** La habitual: enunciado y varias opciones con una correcta.',
          '**Verdadero o falso.** Para conceptos que se confunden a menudo.',
          '**Caso clínico.** Lleva un contexto clínico antes del enunciado. Es obligatorio rellenarlo: sin el caso, la pregunta no tiene sentido.',
        ],
      },
      { tipo: 'titulo', texto: 'La explicación no es opcional en la práctica' },
      {
        tipo: 'texto',
        texto:
          'Escribe siempre la explicación de la respuesta correcta. Es lo que convierte un test en estudio: el alumno falla, lee por qué, y aprende. Sin explicación solo se queda con que falló.',
      },
      {
        tipo: 'truco',
        texto:
          'Etiqueta cada pregunta con su materia y su dificultad al crearla. Cuesta cinco segundos y es lo que después te permite montar un examen equilibrado en un minuto en vez de leerte 300 preguntas.',
      },
    ],
    relacionados: ['profesor-bancos', 'profesor-examen'],
  },

  {
    id: 'profesor-bancos',
    titulo: 'Bancos de preguntas',
    resumen: 'Organizar, importar y filtrar los bancos.',
    seccion: 'Para el profesorado',
    para: ['profesor', 'super_admin', 'auditor'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'Un banco agrupa preguntas de un mismo tema o de una misma oposición. Un examen puede beber de varios bancos a la vez.',
      },
      { tipo: 'titulo', texto: 'Importar preguntas de golpe' },
      {
        tipo: 'texto',
        texto:
          'Si ya tienes las preguntas escritas, no las teclees de nuevo: puedes **subir un archivo** o pegar el texto directamente. La plataforma las reconoce y te muestra qué ha entendido antes de guardar nada.',
      },
      {
        tipo: 'truco',
        texto:
          'Si subes un archivo y dejas en blanco el nombre del banco, se usa el nombre del archivo. Un detalle menor que ahorra un paso.',
      },
      { tipo: 'titulo', texto: 'Los filtros' },
      {
        tipo: 'texto',
        texto:
          'Cuando tienes muchos bancos, el listado se filtra por lo que necesites: población objetivo, tipo de banco o institución. Y dentro de un banco, las preguntas se filtran por materia, dificultad y tipo.',
      },
      {
        tipo: 'aviso',
        texto:
          'Los bancos de oposición son distintos: sus preguntas van **numeradas** porque el número identifica a la pregunta en el pool oficial. No cambies esa numeración.',
      },
    ],
    relacionados: ['profesor-preguntas', 'profesor-examen', 'admin-convocatorias'],
  },

  {
    id: 'profesor-curso-crear',
    titulo: 'Crear un curso',
    resumen: 'La ficha, los estados borrador/publicado y la apertura de matrícula.',
    seccion: 'Dirigir un curso',
    para: ['profesor', 'super_admin'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'La ficha del curso es lo que lee alguien para decidir si se matricula, y también lo que revisa la Comisión. Merece la pena escribirla con cuidado.',
      },
      { tipo: 'titulo', texto: 'Qué rellenar' },
      {
        tipo: 'lista',
        items: [
          '**Título y descripción.** Qué se aprende y para quién es.',
          '**Modalidad.** Presencial, en línea o mixta. Determina si habrá control de asistencia.',
          '**Fechas y horas lectivas.** Las horas son la base de los créditos.',
          '**Acreditación y créditos**, si el curso los tiene.',
          '**Firmantes** del certificado: nombre y cargo de quien lo firma.',
        ],
      },
      { tipo: 'titulo', texto: 'Borrador y publicado' },
      {
        tipo: 'texto',
        texto:
          'Un curso nace en **borrador**: solo lo ves tú y puedes cambiarlo todo. Al **publicarlo** se hace visible en el catálogo. Y **abrir matrícula** es un tercer paso: un curso publicado puede estar visible sin admitir inscripciones todavía.',
      },
      {
        tipo: 'aviso',
        texto:
          'Un curso publicado no se puede editar. Es deliberado: si alguien se matriculó leyendo unas condiciones, esas condiciones no deben cambiar bajo sus pies. Para modificarlo, devuélvelo a borrador.',
      },
      {
        tipo: 'truco',
        texto:
          'Al crear el curso se generan solos unos módulos por defecto, con **Bienvenida** el primero. Aprovéchalo para contar lo concreto de esta edición: horarios, qué traer, cómo se aprueba.',
      },
    ],
    relacionados: ['profesor-curso-modulos', 'profesor-precio', 'profesor-perfil'],
  },

  {
    id: 'profesor-curso-modulos',
    titulo: 'Módulos y actividades',
    resumen: 'Cómo se estructura el contenido que verá el alumno.',
    seccion: 'Dirigir un curso',
    para: ['profesor', 'super_admin'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'El curso se divide en **módulos** (los capítulos) y cada módulo contiene **actividades** (lo que el alumno hace).',
      },
      { tipo: 'titulo', texto: 'Tipos de actividad' },
      {
        tipo: 'lista',
        items: [
          '**Documento.** Un archivo de los que tienes en Documentos.',
          '**Vídeo.** Un enlace a YouTube o Vimeo.',
          '**Texto.** Contenido escrito directamente en la plataforma.',
          '**Test de repaso.** Practica sin nota, repetible.',
          '**Examen.** El que califica y da derecho al certificado.',
        ],
      },
      {
        tipo: 'pasos',
        pasos: [
          'Abre el curso (en borrador) y ve a sus módulos.',
          'Crea el módulo y ponle nombre.',
          'Añade una actividad y elige su tipo.',
          'Si es un documento, elígelo del desplegable con tus archivos ya subidos.',
          'Ordena las actividades arrastrándolas.',
        ],
      },
      {
        tipo: 'aviso',
        texto:
          'Si el desplegable de documentos aparece vacío, es que aún no has subido nada a **Documentos**. Sube primero el archivo y vuelve; no se sube desde aquí a propósito, para que un mismo documento sirva en varios cursos.',
      },
    ],
    relacionados: ['profesor-documentos', 'profesor-examen'],
  },

  {
    id: 'profesor-examen',
    titulo: 'Montar el examen',
    resumen: 'El asistente, la nota de corte y la encuesta previa.',
    seccion: 'Dirigir un curso',
    para: ['profesor', 'super_admin'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'El examen no se escribe pregunta a pregunta: se **compone** a partir de tus bancos. El asistente te lleva en tres pasos: nombre, de qué bancos sale y cuántas preguntas.',
      },
      {
        tipo: 'texto',
        texto:
          'Las preguntas se eligen al azar dentro de los bancos que indiques, así que cada alumno recibe una combinación distinta. Eso reduce mucho la copia sin que tengas que hacer nada.',
      },
      { tipo: 'titulo', texto: 'Qué configurar' },
      {
        tipo: 'lista',
        items: [
          '**Número de preguntas** que se extraen del conjunto de bancos.',
          '**Nota de corte** para aprobar.',
          '**Tiempo límite**, si quieres ponerlo.',
        ],
      },
      {
        tipo: 'aviso',
        texto:
          'Antes del examen final, la plataforma exige al alumno haber respondido la **encuesta de satisfacción**. Es un requisito de la acreditación y se aplica solo. Avísalo en el módulo de Bienvenida para que nadie se sorprenda el último día.',
      },
      {
        tipo: 'truco',
        texto:
          'Comprueba que el banco tiene bastantes más preguntas que las que extrae el examen. Si el banco tiene 25 y el examen saca 20, todos los alumnos verán casi lo mismo.',
      },
    ],
    relacionados: ['profesor-bancos', 'profesor-certificados'],
  },

  {
    id: 'profesor-calidad',
    titulo: 'Preguntas mal planteadas',
    resumen: 'Los avisos de los alumnos, la dificultad real y cómo anular una pregunta.',
    seccion: 'Dirigir un curso',
    para: ['profesor', 'super_admin'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'En todo examen acaba habiendo una pregunta ambigua o directamente equivocada. Quien mejor lo detecta es quien acaba de responderla, así que el alumno puede avisar desde la revisión de su examen, y tú lo ves aquí.',
      },
      { tipo: 'titulo', texto: 'Cómo leer la tabla' },
      {
        tipo: 'lista',
        items: [
          '**Avisos.** Alumnos que han señalado la pregunta, con su motivo y comentario. Pulsa el número para leerlos.',
          '**Aciertos.** Qué porcentaje la acierta. Se ordena poniendo arriba lo señalado y lo más fallado.',
        ],
      },
      {
        tipo: 'aviso',
        texto:
          'Un acierto muy bajo **no siempre** significa que la pregunta esté mal: puede ser el punto del temario que peor se explicó, y esa información también es valiosa. Léela antes de anularla.',
      },
      { tipo: 'titulo', texto: 'Anular una pregunta' },
      {
        tipo: 'texto',
        texto:
          'Al anularla deja de contar para la nota de **todos**, y los exámenes ya entregados se recalculan al momento. Nadie puede bajar de nota: anular solo puede subir el porcentaje o dejarlo igual.',
      },
      {
        tipo: 'texto',
        texto:
          'Es reversible: si te precipitas, «Volver a contar» la reincorpora y vuelve a recalcular.',
      },
      {
        tipo: 'truco',
        texto:
          'Anular es preferible a corregir la pregunta a mitad de una edición. Si la cambias, unos alumnos habrán respondido a una versión y otros a otra, y la nota deja de ser comparable.',
      },
    ],
    relacionados: ['profesor-examen', 'profesor-acta'],
  },
  {
    id: 'profesor-precio',
    titulo: 'Precio de matrícula y matrícula anticipada',
    resumen: 'Poner precio, el recargo por fecha y qué ve el alumno.',
    seccion: 'Dirigir un curso',
    para: ['profesor', 'super_admin'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'En la sección de precio del curso decides cuánto cuesta la matrícula. Si lo dejas a cero, el curso es gratuito y el alumno entra directamente al matricularse.',
      },
      { tipo: 'titulo', texto: 'Matrícula anticipada' },
      {
        tipo: 'texto',
        texto:
          'Puedes premiar a quien se decide pronto: fijas un **precio anticipado**, una **fecha límite** y un **recargo en porcentaje** que se aplica a partir de esa fecha.',
      },
      {
        tipo: 'texto',
        texto:
          'Ejemplo: 100 € hasta el 30 de septiembre, y un 20 % de recargo después. Quien pague el 1 de octubre abonará 120 €. El alumno ve en todo momento qué precio le toca y cuánto le queda para que suba.',
      },
      {
        tipo: 'aviso',
        texto:
          'El precio se calcula por la fecha de **pago**, no la de matrícula. Alguien que reserve plaza dentro de plazo pero pague tarde pagará el recargo, y así se le indica.',
      },
      {
        tipo: 'texto',
        texto:
          'Las actividades docentes están **exentas de IGIC e IVA**, de modo que el precio que pones es el precio final: no se suman impuestos ni al mostrarlo ni al cobrarlo.',
      },
    ],
    relacionados: ['profesor-pagos', 'profesor-alumnos'],
  },

  {
    id: 'profesor-alumnos',
    titulo: 'Gestionar los alumnos del curso',
    resumen: 'Ver matriculados, su avance y su estado de pago.',
    seccion: 'Dirigir un curso',
    para: ['profesor', 'super_admin'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'En el panel del curso tienes la lista de matriculados con lo que necesitas de un vistazo: quién ha pagado, por dónde va y qué nota ha sacado.',
      },
      { tipo: 'titulo', texto: 'Estados de matrícula' },
      {
        tipo: 'lista',
        items: [
          '**Pendiente de pago.** Se ha matriculado pero aún no ha pagado; no ve el contenido.',
          '**Activo.** Al día y con acceso completo.',
          '**Finalizado.** Ha completado el curso.',
        ],
      },
      {
        tipo: 'truco',
        texto:
          'Si alguien lleva días en «pendiente de pago», suele ser que se atascó en la pasarela, no que se arrepintiera. Un mensaje suele recuperar esa matrícula.',
      },
    ],
    relacionados: ['profesor-pagos', 'profesor-asistencia', 'profesor-certificados'],
  },

  {
    id: 'profesor-pagos',
    titulo: 'Los cobros del curso',
    resumen: 'Cuánto llevas cobrado, qué falta y los justificantes.',
    seccion: 'Dirigir un curso',
    para: ['profesor', 'super_admin'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'La sección **Cobros del curso** te da los dos totales que importan —cobrado y pendiente— y el detalle de cada movimiento con su número de justificante, sin tener que entrar en Stripe.',
      },
      {
        tipo: 'aviso',
        texto:
          'Si la pasarela está en **modo de pruebas**, aparece un aviso rojo sobre la tabla. Esos importes no son dinero real: son pagos de prueba. Compruébalo antes de dar por buena una cifra.',
      },
      {
        tipo: 'texto',
        texto:
          'Cada pago genera un justificante con numeración correlativa, que el alumno descarga desde su perfil.',
      },
    ],
    relacionados: ['profesor-precio', 'admin-pendientes'],
  },

  {
    id: 'profesor-asistencia',
    titulo: 'Control de asistencia',
    resumen: 'Jornadas, el QR proyectado, pasar lista a mano y el listado en PDF.',
    seccion: 'Dirigir un curso',
    para: ['profesor', 'super_admin'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'En los cursos presenciales hay que acreditar quién estuvo y cuánto tiempo. La plataforma lo resuelve con jornadas y un QR proyectado.',
      },
      {
        tipo: 'pasos',
        pasos: [
          'Crea una **jornada** por cada día o actividad que quieras controlar.',
          'El día del curso, abre la jornada y pulsa **proyectar QR**.',
          'Proyecta la pantalla en el aula. Los alumnos escanean con su móvil y confirman.',
          'Ves en directo quién va fichando.',
          'Al terminar, repite para la salida.',
        ],
      },
      { tipo: 'titulo', texto: 'Por qué el QR cambia solo' },
      {
        tipo: 'texto',
        texto:
          'El código se renueva cada pocos segundos y en pantalla ves la cuenta atrás. Así una foto del QR reenviada por WhatsApp caduca antes de servirle a nadie desde su casa. Es lo que hace que la asistencia signifique algo.',
      },
      { tipo: 'titulo', texto: 'Pasar lista a mano' },
      {
        tipo: 'texto',
        texto:
          'Siempre habrá un móvil sin batería. Puedes marcar la asistencia manualmente desde tu panel; queda registrada como marcaje manual, con transparencia sobre quién la puso.',
      },
      { tipo: 'titulo', texto: 'El listado firmado' },
      {
        tipo: 'texto',
        texto:
          'Puedes descargar el **listado de asistencia en PDF** (A4 apaisado) con número de orden, apellidos, nombres, DNI y dos columnas de firma, entrada y salida. Es el papel que se firma en el aula y se archiva.',
      },
    ],
    relacionados: ['profesor-acta', 'alumno-asistencia'],
  },

  {
    id: 'profesor-acta',
    titulo: 'El acta del curso',
    resumen: 'Qué es, cuándo cerrarla y por qué no se puede modificar después.',
    seccion: 'Dirigir un curso',
    para: ['profesor', 'super_admin'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'El acta es el documento oficial de una edición: qué curso fue, cuándo, quién lo dirigió, quién asistió, quién aprobó y con qué nota. Es lo que se archiva y lo que pide la Comisión.',
      },
      { tipo: 'titulo', texto: 'Borrador y cierre' },
      {
        tipo: 'texto',
        texto:
          'Mientras el curso está en marcha, el acta es un **borrador** que puedes generar cuantas veces quieras para revisarla: se recalcula con los datos del momento.',
      },
      {
        tipo: 'texto',
        texto:
          'Cuando todo está correcto, la **cierras**. En ese momento los datos se congelan y se les calcula una huella digital. Si alguien alterase después una nota en la base de datos, la verificación del acta lo detectaría.',
      },
      {
        tipo: 'aviso',
        texto:
          'Cierra el acta cuando ya no vaya a cambiar nada: todas las notas puestas, la asistencia completa. Un acta cerrada no se modifica; si hay un error hay que emitir una versión nueva, y ambas quedan en el historial.',
      },
      {
        tipo: 'texto',
        texto:
          'Cada acta cerrada tiene su código de verificación pública. Quien lo consulte ve los datos agregados —cuántos aprobaron, fechas, curso—, nunca la lista nominal de alumnos.',
      },
    ],
    relacionados: ['profesor-certificados', 'verificar', 'admin-cfc'],
  },

  {
    id: 'profesor-certificados',
    titulo: 'Emitir los certificados',
    resumen: 'Cuándo puede descargarlo el alumno y cómo personalizar el diseño.',
    seccion: 'Dirigir un curso',
    para: ['profesor', 'super_admin'],
    cuerpo: [
      {
        tipo: 'texto',
        texto:
          'No tienes que emitir los certificados uno a uno: el alumno se lo descarga en cuanto cumple los requisitos. Tu trabajo es que la ficha del curso y el acta estén correctas.',
      },
      { tipo: 'titulo', texto: 'Requisitos para que se active' },
      {
        tipo: 'lista',
        items: [
          'Haber **aprobado el examen final**.',
          'Haber **respondido la encuesta** de satisfacción.',
        ],
      },
      { tipo: 'titulo', texto: 'El diseño' },
      {
        tipo: 'texto',
        texto:
          'Puedes subir una **imagen de fondo** propia para el certificado y, si el curso está acreditado, la imagen del sello CFC. Usa el botón de **vista previa** para verlo con un nombre de ejemplo antes de que lo descargue nadie.',
      },
      {
        tipo: 'truco',
        texto:
          'Revisa que los nombres y cargos de los firmantes estén bien escritos en la ficha. Aparecen tal cual en cada certificado, y corregirlos después significa reemitirlos todos.',
      },
    ],
    relacionados: ['profesor-acta', 'verificar', 'alumno-certificados'],
  },
];
