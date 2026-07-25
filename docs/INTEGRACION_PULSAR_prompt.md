# Prompt para PÚLSAR — integración con la academia (Gran Canaria RCP)

> Pega esto en el asistente que trabaja el proyecto PÚLSAR (`C:/pulsar`).
> Está redactado para no necesitar más contexto.

---

Estoy integrando PÚLSAR (simulación clínica) con **Gran Canaria RCP Academy**, la
plataforma online donde se lleva la parte teórica de los cursos y se cierran las
actas. El reparto de responsabilidades es:

- **La academia** es la fuente de verdad de: cursos (ediciones con fechas),
  alumnos, profesores, matrículas, teoría, asistencia, actas y certificados.
- **PÚLSAR** es la fuente de verdad de: la ejecución de la práctica presencial y
  sus calificaciones (escenarios, ítems, apto/no apto práctico).

El intercambio es **por archivos JSON**, en dos sentidos:

1. La academia **exporta** un `curso-academia.json` → se importa en PÚLSAR para
   montar la sesión práctica con sus alumnos y subgrupos.
2. PÚLSAR **exporta** un `resultados-pulsar.json` → se importa en la academia
   para incorporar la nota práctica y cerrar el acta.

El curso se casa por **`idAcademia`** (y de apoyo, un `codigoVinculacion` corto y
legible). Los alumnos se casan por **`documento`** (DNI/NIE/pasaporte). Los
instructores, por email (y documento si lo tienen).

La academia **ya está terminada y en producción** con su mitad. Necesito adaptar
PÚLSAR para que encaje. Tienes tres tareas.

---

## Contexto de lo que ya existe en PÚLSAR (para no romperlo)

He revisado el código. Ten en cuenta:

- `servidor/cursos.js`: un **curso** en PÚLSAR es hoy una **plantilla
  reutilizable** (nombre + escenarios que referencian casos), sin fechas ni
  alumnos. Persistencia en `datos/cursos.json`.
- `servidor/evaluacion.js`: los `GRUPOS` que ya existen (`tecnica` /
  `no_tecnica`) son categorías de ítems de evaluación. **No** son grupos de
  alumnos. No los toques ni los confundas con lo de abajo.
- El `importar(datos)` actual de `cursos.js` solo lee `nombre`, `descripcion`,
  `duracionMin` y `escenarios`. Ignora alumnos, grupos e instructores.

## Tarea 1 — Renombrar "curso" a "plantilla" para las plantillas reutilizables

Para que los dos sistemas hablen el mismo idioma sin ambigüedad:

- Lo que hoy PÚLSAR llama **curso** (la plantilla con escenarios) pasa a llamarse
  **plantilla** en la interfaz y, si es viable sin migración dolorosa, en el
  código (`plantillas.js`, `datos/plantillas.json`, etc.).
- El término **curso** queda libre para significar lo que la academia entiende
  por curso: una **edición concreta con alumnos, fechas y subgrupos**. En PÚLSAR
  eso es una **cohorte/sesión** que se basa en una plantilla.

Si el renombrado de datos es costoso, al menos hazlo en la interfaz y deja
`curso.js` como alias, pero deja claro el concepto.

## Tarea 2 — IMPORTAR el `curso-academia.json` como cohorte con alumnos y subgrupos

La academia genera **exactamente** este formato (te paso un ejemplo real):

```json
{
  "version": "1.0",
  "origen": "academia",
  "curso": {
    "idAcademia": "47d499db-ce7d-4952-9326-a2b3a8170c30",
    "codigoVinculacion": "RCP-GGM926",
    "nombre": "SVA para enfermería",
    "modalidad": "SVA",
    "empresa": "Hospital Dr. Negrín",
    "lugar": "Aula de Simulación",
    "fechaInicio": "2026-09-01",
    "fechaFin": "2026-09-03",
    "instructores": [
      { "nombre": "Carlos", "apellidos": "Lübbe", "documento": "12345678A", "email": "instructor@ejemplo.es" }
    ]
  },
  "grupos": [
    {
      "nombre": "Rojo",
      "color": "#e23b3b",
      "alumnos": [
        { "documento": "11111111A", "nombre": "Ana", "apellidos": "García", "email": "ana@ejemplo.es", "profesion": "" }
      ]
    },
    {
      "nombre": "Azul",
      "color": "#2f6fe0",
      "alumnos": [ /* … */ ]
    }
  ]
}
```

Notas de campos:
- `curso.modalidad` es el **tipo clínico**: `SVA` | `SVB` | `SVI` | `otro`. (En la
  academia, "online/híbrido/presencial" es OTRO eje distinto que no se envía.)
- `curso.idAcademia` es el identificador que hay que **guardar en la cohorte** y
  devolver luego en los resultados: es el ancla del cruce.
- Los **grupos son subgrupos de alumnos por color** (Rojo, Azul, Amarillo…). Este
  es el concepto nuevo en PÚLSAR: NO es el `GRUPOS` de evaluación. Si el curso no
  usa subgrupos, vendrá un único grupo llamado `"Todos"`.
- `alumnos[].documento` es la llave. `profesion` puede venir vacío por ahora.

**Qué debe hacer PÚLSAR al importarlo:**
1. Crear una **cohorte/sesión** (no una plantilla) que guarde `idAcademia`,
   `codigoVinculacion`, nombre, tipo, empresa, lugar y fechas.
2. Dar de alta a los **alumnos** con su documento como identificador, repartidos
   en los **subgrupos** por color que vienen en `grupos[]`.
3. Registrar a los **instructores** por email/documento.
4. Idealmente, permitir asociar esa cohorte a una **plantilla** existente (la que
   tenga los escenarios que se van a correr).

## Tarea 3 — EXPORTAR el `resultados-pulsar.json` con este formato exacto

Cuando termine la práctica, PÚLSAR debe generar un archivo que la academia sabe
importar. El formato que la academia **espera** es:

```json
{
  "version": "1.0",
  "origen": "pulsar",
  "cursoRef": {
    "idAcademia": "47d499db-ce7d-4952-9326-a2b3a8170c30",
    "idPulsar": "cur-abc123",
    "nombre": "SVA para enfermería",
    "fechaInicio": "2026-09-01",
    "fechaFin": "2026-09-03",
    "lugar": "Aula de Simulación"
  },
  "instructores": [ { "nombre": "Carlos", "email": "instructor@ejemplo.es" } ],
  "umbralApto": 70,
  "alumnos": [
    {
      "documento": "11111111A",
      "nombre": "Ana",
      "apellidos": "García",
      "grupo": "Rojo",
      "asistencia": true,
      "teorico":   { "nota": 78, "apto": true, "examenes": [ { "nombre": "Test final", "nota": 78 } ] },
      "simulacion":{ "nota": 82, "apto": true, "escenarios": [ { "nombre": "PCR FV", "nota": 85, "apto": true, "itemsNoConseguidos": ["Desfibrila <2 min"] } ] },
      "global":    { "apto": true },
      "feedback":  { "mejorar": "…", "fortalecer": "…", "comentario": "…" }
    }
  ]
}
```

Lo que la academia realmente usa de cada alumno (lo demás lo guarda como detalle):
- **`documento`** — imprescindible, es como casa al alumno. Debe ser el MISMO que
  vino en el `curso-academia.json` (mismo formato, sin espacios ni guiones).
- **`simulacion.nota`** y **`simulacion.apto`** — la nota práctica y si superó.
- `simulacion.escenarios[]` e `itemsNoConseguidos` — se guardan para el legajo.
- `feedback` — se guarda para el alumno.
- `cursoRef.idAcademia` — para verificar que el archivo es de este curso.

**Importante sobre `apto`:** en un curso con práctica, la academia solo dará al
alumno como **apto final** si aprueba la teoría (que la lleva ella) Y
`simulacion.apto === true`. Así que ese booleano decide de verdad si el alumno
obtiene el certificado.

## Identificación (resumen para PÚLSAR)

- **Alumnos:** por `documento` (DNI/NIE/pasaporte), normalizado en MAYÚSCULAS y
  sin espacios ni guiones. Es único por persona.
- **Curso:** por `idAcademia` (UUID). El `codigoVinculacion` (p.ej. `RCP-GGM926`)
  es un apoyo legible por humanos para no confundir ediciones.
- **Instructores:** por email (y documento si está).

## Por ahora NO hace falta API en vivo

Empezamos solo con archivos: más robusto y auditable. Cuando esto funcione,
valoraremos una API con token bearer contra
`https://grancanaria-rcp-api.onrender.com`. No la construyas todavía.

---

Cuando lo tengas, dime qué nombres de campo has usado en tu lado por si hay que
ajustar algo, y generamos un par de archivos de ejemplo para probar el ida y
vuelta completo.
