# 🫀 GranCanaria RCP Academy — Plan Maestro

**Versión:** 3.0 · **Actualizado:** 2026-07-17
**Autor de producto:** Federico Lübbe (Dr.) · **Desarrollo:** Claude Code

> **Cambio de rumbo (v3):** el proyecto crece de "plataforma de tests" a un
> **CAMPUS VIRTUAL de formación médica acreditada (LMS)**: cursos, matrícula,
> módulos, exámenes, foro, seguimiento de tiempo, calificaciones, certificados
> (con **CFC**) y pagos. Se construye **a medida y por fases**, reutilizando la
> base ya creada. Cursos **gratis primero**; **pagos (Stripe) en la Fase G**.

---

## 1. Estado actual (ya hecho y en producción)

- **Fase 1 — Infra + Auth:** ✅ desplegado (Vercel + Render + Neon + R2 + campus.grancanariarcp.es).
- **Fase 2 — Banco de preguntas:** ✅ modelo enriquecido (nivel × público × tipo × dificultad),
  pantalla de crear preguntas, **documentos de referencia en R2** con referencia
  **documento + página**. ⏳ *Falta rematar la carga masiva (Excel) — se reutiliza en los exámenes.*
- Roles actuales: `super_admin`, `institution_admin`, `student`.
- Decisiones firmes: sin Firebase (JWT propio); Neon (no ElephantSQL); UUID; migraciones (`db:migrate`).

Todo esto **son piezas del campus**: los logins/roles, el banco de preguntas y los
documentos en R2 se convierten en los **exámenes y materiales** de los cursos.

---

## 2. Público por edad (confirmado)
👶 Niños 6–11 · 🧑 Jóvenes 12–17 · 👨 Adultos 18+. Una pregunta puede servir a varios.
Tipos de pregunta: 📘 teórica · 🩺 caso clínico · (nuevos para cursos) ✔️ verdadero/falso · ✍️ abierta.

---

## 3. El Campus (visión funcional)

### 3.1 Roles
- **super_admin** (Federico): todo. Edita las **taxonomías** (temas, subtemas, públicos objetivo).
- **profesor** (nuevo): crea y gestiona sus cursos.
- **alumno**: se matricula, estudia, hace exámenes, descarga certificados.

### 3.2 Crear curso (profesor)
Al pulsar **"Crear nuevo curso"** se pide:
- Nombre, duración (horas), **modalidad** (online / mixto / presencial).
- **Tema** (desplegable editable por super_admin; base: **RCP, Medicina Intensiva, Emergencias**).
- **Subtema** (desplegable editable por super_admin; base: **SVB, SVA, SVI, Respiratorio, Cardiológico, Neurocrítico**).
- Objetivo general, objetivos específicos.
- **Público objetivo** (Médicos, Enfermeros, Estudiantes de Medicina, Estudiantes de Enfermería…).
- **Miniatura** (imagen opcional en R2; si no hay, una genérica por tema).
- Al crearse: se generan automáticamente una **Bienvenida** y un **módulo**.

### 3.3 Estructura del curso
- **Módulos** (añadir/eliminar con "Editar"). Cada módulo → **actividades**:
  incluir **documento**, **vídeo**, **enlace/URL**, **crear test** o **crear examen**.
- Cada actividad puede ser **obligatoria de ver** para avanzar (o no).
- **Exámenes**: pre-test, test por unidad y **examen final**. Al crear examen:
  añadir preguntas (importar o una a una), tipo **test / verdadero-falso / abierta**
  (en test y V/F se marca la correcta) → definir **nº de intentos** y **% de aprobado**
  y **tiempo por intento** → "Confirmo crear test/examen".
- **Configuración del curso**: fechas de inicio/fin de cada módulo, del curso, y
  ventana para el **examen final**.

### 3.4 Matrícula (desde el login)
- En el login se ven **fichas de los cursos con matrícula abierta**.
- Al pulsar una ficha: **registrarse** (si es nuevo) o **matricularse** directo (si ya existe).
- Curso **gratis** → matriculado al momento. Curso **de pago** → pasarela (Stripe, Fase G) → al pagar, matriculado.
- Alumno: pestaña **"Mis cursos"** (activos y realizados).

### 3.5 Seguimiento, foro y calificaciones
- **Tiempo dedicado**: el alumno y el profesor lo ven.
- **Foro** por curso: comentar dudas entre todos o **solo al profesor**.
- Dashboard del profesor por curso → pestaña **"Calificaciones"**: nota de cada test/examen,
  horas por alumno y nº de intentos.

### 3.6 Certificado (al aprobar)
Se activa el botón **"Descargar certificado"** cuando el alumno **completa todas las actividades**,
dedica el **tiempo mínimo** y **aprueba**. Se genera en **PDF A4 apaisado**.

Pestaña **"Configurar certificado"** (profesor):
- Autocompletadas: **nombre del curso**, **duración total en horas**, **periodo**.
- A definir: **quién certifica**.
- **Firmantes**: 2 celdas (Nombre y Apellidos + cargo). Si se dejan vacías, no aparecen.
- **Imagen de fondo** del certificado (opcional, R2).
- **CFC**: si se otorgaron/están en trámite y cuántos + imagen de los CFC si están otorgados.

**Texto del certificado:**
> **XXXXXX** Certifica que: **Nombre y Apellidos** APROBÓ el curso **XXXXXXX**, que se
> desarrolló *online / mixto / presencial* entre **xx/xx/xxxx** y **xx/xx/xxxx** con un
> total de **x** horas.

(Nombre y Apellidos vienen del **registro del alumno**; el resto, de la **ficha del curso**.)

---

## 4. Arquitectura técnica (qué añadimos)
Nuevas tablas principales: `courses`, `modules`, `activities`, `enrollments`,
`exams`, `exam_questions`, `attempts`, `taxonomies` (temas/subtemas/públicos),
`time_logs`, `forum_threads`/`forum_posts`, `certificate_configs`/`certificates`,
`payments`. Archivos (miniaturas, fondos de certificado, materiales) → **R2**.
Certificados PDF → generación en el servidor (fondo + texto + firmantes).

---

## 5. Roadmap del Campus (por fases)

| Fase | Entrega |
|------|---------|
| **C0** | *(remate)* Carga masiva de preguntas (Excel) — reutilizable en exámenes |
| **A** | Rol **profesor** + taxonomías editables + **crear curso** + dashboard del profesor |
| **B** | **Módulos y actividades** (documentos/vídeos/enlaces, obligatoriedad) |
| **C** | **Exámenes** (reutiliza banco de preguntas; añade V/F y abierta; intentos, % aprobado, tiempo) |
| **D** | **Matrícula gratis** desde el login + "Mis cursos" + fechas de curso/módulo/examen |
| **E** | **Tiempo dedicado** + **calificaciones** del profesor + condición de aprobado |
| **F** | **Certificados** PDF (con CFC) al aprobar |
| **G** | **Pagos (Stripe)** para cursos de pago |
| **H** | **Foro** del curso |

> Con **A→F** ya hay un curso real de principio a fin (crear → matricular → estudiar
> → examen → certificado). **G y H** se añaden después.

---

## 6. Recomendaciones de escalabilidad
- Construir **por fases** con un ciclo completo pronto (A→F) y luego enriquecer.
- **Tests automáticos + CI** para no romper nada al crecer.
- **Backend de pago** (~7€/mes) cuando haya alumnos reales (Render gratis "duerme").
- **Monitorización** (Sentry) + **copias de seguridad** (Neon).
- **RGPD**: consentimiento/términos, anonimato donde aplique, retención de datos.
- Reutilizar R2 para todos los archivos; certificados PDF generados bajo demanda.

---

## 8. Requisitos adicionales (v3.1)

- **Versión visible** en la app (semver: `v1.0.0`, `v1.1.0`, …) + commit corto. ⭐
- **Import de preguntas en JSON** (para IA) además de Excel. JSON recomendado para test y V/F.
- **Bancos de preguntas con permisos**:
  - `super_admin` accede a **todos** los bancos y decide cuáles son **públicos**.
  - Cada `profesor` accede a **las preguntas que él crea/importa** + las **públicas**.
  - Campos nuevos en `questions`: `owner_id`, `is_public` (solo super_admin lo cambia), estado `borrador/revisada`.
- **Alta de profesores**: auto-registro con estado **pendiente** → el super_admin **valida** (aprueba/rechaza); o el super_admin **crea** el profesor directamente.
- **Cursos multi-profesor y directores**:
  - Tabla `course_staff` (curso × profesor × rol `director`/`instructor`).
  - El creador es **director** por defecto; los directores pueden **añadir/invitar** profesores.
- **Reclutamiento de profesores**:
  - `convocatorias` (visibles solo para profesores): perfil buscado + qué se ofrece.
  - `postulaciones`: el profesor pulsa **"Postularse"**; el convocante ve su perfil y contacta.
- **Notificaciones** (push + email) al **abrir matrícula**, **filtradas por público objetivo**
  del curso (si es "todos", a todos). Requiere servicio de email (p. ej. Resend) + web push.

### Mejoras recomendadas (anotadas, se activan cuando toque)
- Revisión/aprobación de preguntas (borrador → revisada) — clave por el uso de IA.
- Estado **borrador/publicado** de cursos + **vista previa** del profesor como alumno.
- **Buscador y filtros** en el banco de preguntas.

### Orden sugerido con lo nuevo
`C0` (import Excel **+ JSON**, con owner/visibilidad) → **versión visible v1.0.0** →
`Fase A` (rol profesor + validación de altas + crear curso + directores) → B → C … 
Reclutamiento y notificaciones se integran junto a las fases de profesores/matrícula.
