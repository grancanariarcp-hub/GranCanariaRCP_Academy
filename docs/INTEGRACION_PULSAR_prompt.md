# Prompt para PÚLSAR — integración con la academia (Gran Canaria RCP)

> Pega esto en el asistente que trabaja el proyecto PÚLSAR (`C:/pulsar`).
> Está redactado para no necesitar más contexto, y **ya tiene en cuenta la
> arquitectura real de PÚLSAR** (Personas/Matrículas, sesiones con subgrupos).

---

Estoy integrando PÚLSAR (simulación clínica) con **Gran Canaria RCP Academy**, la
plataforma online donde se lleva la parte teórica de los cursos y se cierran las
actas. Reparto de responsabilidades:

- **La academia** es la fuente de verdad de: cursos (ediciones con fechas),
  alumnos, profesores, matrículas, teoría, asistencia, actas y certificados.
- **PÚLSAR** es la fuente de verdad de: la ejecución de la práctica presencial y
  sus calificaciones (escenarios, ítems, apto/no apto práctico).

Intercambio **por archivos JSON**, en dos sentidos:

1. La academia **exporta** un `curso-academia.json` → se importa en PÚLSAR para
   tener a los alumnos y sus subgrupos listos para la práctica.
2. PÚLSAR **exporta** un `resultados-pulsar.json` → se importa en la academia
   para incorporar la nota práctica y cerrar el acta.

Cruce: el curso por **`idAcademia`** (UUID) con apoyo de un `codigoVinculacion`
corto (`RCP-XXXXXX`); los alumnos por **`documento`**; los instructores por email.

La academia **ya está terminada y en producción** con su mitad. Hay que adaptar
PÚLSAR. Antes, lo que YA tienes y encaja (lo he verificado en tu código):

## Lo que PÚLSAR ya tiene y vamos a reutilizar (no reconstruir)

- **`servidor/matriculacion.js`** — `datos/personas.json` + `datos/matriculas.json`.
  - **Persona**: `{ id, orgId, docTipo("DNI"|"NIE"|"Pasaporte"), docNum(normalizado),
    nombre, apellidos, fechaNac, centro, profesion, consentido, creado }`.
    Única por `(orgId, docNum)`. **Este es el registro de alumnos.**
  - **Matrícula**: `{ id, orgId, cursoId, personaId, rol("alumno"|"instructor"),
    estado("pendiente"|"confirmada"), fechaISO }`.
- **`servidor/cursos.js`** — `datos/cursos.json`. Un **curso** en PÚLSAR es una
  **plantilla reutilizable** (escenarios). NO tiene fechas ni alumnos.
- **La sesión en vivo** (`motor/motor.js`, `estado.sesion`) ya tiene:
  - `participantes[]`: `{ id, nombre, personaId?, subgrupoId? }`
  - `subgrupos[]`: `{ id, nombre }` + `repartirSubgrupos` (reparto equilibrado)
  - `curso { nombre, lugar, fecha, instructores, empresa, logo }` (cabecera del informe)
  - evaluación por alumno y `historial.registrar(...)` archiva el resultado.

Es decir: **el "curso" de la academia = en PÚLSAR una plantilla (los escenarios)
+ el conjunto de Matrículas de esa edición (los alumnos)**. La sesión en vivo es
donde esos alumnos, repartidos en subgrupos, ejecutan la práctica.

## Tarea 1 — Aclarar el vocabulario (sin renombrar a lo bruto)

No hace falta renombrar `cursos.js` (está muy incrustado y sería arriesgado).
Basta con dejar claro en la interfaz que:
- **Plantilla** = el curso reutilizable de PÚLSAR (escenarios).
- **Curso / edición** = lo que llega de la academia: alumnos + fechas. En PÚLSAR
  se materializa como un conjunto de **Matrículas** sobre una plantilla.

Si en la UI hoy dices "curso" para la plantilla, cámbialo a "plantilla" ahí; deja
"curso" para la edición con alumnos que viene de la academia.

## Tarea 2 — IMPORTAR el `curso-academia.json`

La academia genera **exactamente** este formato (ejemplo real):

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
    { "nombre": "Rojo", "color": "#e23b3b",
      "alumnos": [ { "documento": "11111111A", "nombre": "Ana", "apellidos": "García", "email": "ana@ejemplo.es", "profesion": "" } ] },
    { "nombre": "Azul", "color": "#2f6fe0", "alumnos": [ /* … */ ] }
  ]
}
```

**Qué debe hacer PÚLSAR al importarlo:**
1. **Upsert de Personas** por `docNum` en la organización, una por cada
   `grupos[].alumnos[]`. El `documento` viene como una sola cadena; deriva
   `docTipo`/`docNum` (por defecto DNI; si no cumple patrón DNI/NIE, "Pasaporte").
   Normaliza igual que la academia: MAYÚSCULAS, sin espacios ni guiones.
2. **Crear Matrículas** (rol `alumno`) de esas Personas sobre una **plantilla**
   que elija el instructor, en estado que decidas (p.ej. `confirmada`, ya que la
   academia ya las validó). Guarda en la matrícula (o en una tabla puente) el
   **`idAcademia`** y el **subgrupo por color** (`grupos[].nombre`/`color`) de
   cada alumno, para poder sembrar los `subgrupos` de la sesión y para el
   ida y vuelta.
3. Registrar a los **instructores** por email/documento.
4. Guardar `empresa`, `lugar`, fechas y `modalidad`(SVA/SVB/SVI/otro) como datos
   de la edición → alimentan la cabecera `curso {}` de la sesión.

Cuando se lance la sesión en vivo, los `participantes` se crean desde esas
Matrículas (con su `personaId`), y los `subgrupos` de la sesión se siembran con
los colores que vinieron. Así el instructor no teclea a nadie a mano.

## Tarea 3 — EXPORTAR el `resultados-pulsar.json`

Al terminar la práctica (tienes la calificación por alumno en el flujo de
evaluación → `historial.registrar`), genera este formato **exacto**, que la
academia sabe importar:

```json
{
  "version": "1.0",
  "origen": "pulsar",
  "cursoRef": { "idAcademia": "47d499db-…", "idPulsar": "cur-abc123", "nombre": "SVA para enfermería", "fechaInicio": "2026-09-01", "fechaFin": "2026-09-03", "lugar": "Aula de Simulación" },
  "instructores": [ { "nombre": "Carlos", "email": "instructor@ejemplo.es" } ],
  "umbralApto": 70,
  "alumnos": [
    {
      "documento": "11111111A", "nombre": "Ana", "apellidos": "García",
      "grupo": "Rojo", "asistencia": true,
      "teorico":   { "nota": 78, "apto": true },
      "simulacion":{ "nota": 82, "apto": true, "escenarios": [ { "nombre": "PCR FV", "nota": 85, "apto": true, "itemsNoConseguidos": ["Desfibrila <2 min"] } ] },
      "global":    { "apto": true },
      "feedback":  { "mejorar": "…", "fortalecer": "…", "comentario": "…" }
    }
  ]
}
```

Lo que la academia usa de cada alumno (lo demás lo guarda como detalle):
- **`documento`** — imprescindible. El MISMO que vino, mismo formato normalizado.
- **`simulacion.nota`** y **`simulacion.apto`** — la nota práctica y si superó.
- `simulacion.escenarios[]` + `itemsNoConseguidos` y `feedback` — para el legajo.
- **`cursoRef.idAcademia`** — para casar con el curso correcto.

**Sobre `apto`:** en un curso con práctica, la academia solo da al alumno como
**apto final** si aprueba la teoría (que lleva ella) Y `simulacion.apto === true`.
Ese booleano decide si el alumno obtiene el certificado.

## Identificación (resumen)

- **Alumnos:** por `documento` (DNI/NIE/pasaporte), normalizado MAYÚSCULAS sin
  espacios ni guiones. En PÚLSAR corresponde a `Persona.docNum`.
- **Curso/edición:** por `idAcademia` (UUID). `codigoVinculacion` como apoyo legible.
- **Instructores:** por email (y documento si está).

## Por ahora NO hace falta API en vivo

Empezamos solo con archivos: más robusto y auditable. Cuando funcione, valoramos
una API con token bearer contra `https://grancanaria-rcp-api.onrender.com`.

---

Cuando lo tengas, dime qué nombres de campo has usado por si hay que ajustar
algo, y hacemos una prueba de ida y vuelta con un curso de 2-3 alumnos.
