# 🫀 GranCanaria RCP Academy — Plan Maestro

**Versión:** 2.0 · **Actualizado:** 2026-07-17
**Autor de producto:** Federico Lübbe (Dr.) · **Desarrollo:** Claude Code

Este documento sustituye a los planes anteriores (enero 2026). Incorpora el
estado real desplegado, las decisiones técnicas tomadas y los nuevos requisitos:
**segmentación por público (niños / jóvenes / adultos)** y **tipos de pregunta
(teórica vs. caso clínico)**.

---

## 1. Estado actual (lo que YA existe y está en producción)

**Fase 1 — Infraestructura + Autenticación: COMPLETADA y EN VIVO.**

- Frontend Next.js 14 → **campus.grancanariarcp.es** (Vercel)
- Backend Express + TypeScript → **api / onrender.com** (Render)
- Base de datos PostgreSQL → **Neon**
- Roles: `super_admin` (Federico), `institution_admin`, `student`
- Logins: admin + alumno (3 métodos: registro, email+contraseña, código de acceso)
- Seguridad: JWT, bcrypt, rate limiting, CORS, cabeceras (helmet)
- **RGPD**: hash de identidad irreversible para menores, logs de auditoría
- Panel super admin (estadísticas, instituciones, auditoría)
- Marca: logo Gran Canaria RCP en favicon, logins y panel

### Decisiones técnicas tomadas (y por qué)

| Tema | Decisión | Motivo |
|------|----------|--------|
| Autenticación | Sistema propio JWT + bcrypt (sin Firebase) | Menos dependencias y coste; suficiente y robusto |
| Base de datos | Neon (no ElephantSQL) | ElephantSQL cerró en 2025 |
| IDs | UUID (no enteros SERIAL) | Más seguro y escalable; evita enumeración |
| Rol extra | `super_admin` para Federico | Control total sobre todo el sistema |
| CSS | Design system propio (paleta médica azul acero) | Coherente con la guía corporativa |

> ⚠️ Los scripts antiguos (`Setup_Scripts.ps1`, el `schema.sql` de enero) **no
> deben ejecutarse**: usan sintaxis MySQL inválida en PostgreSQL y machacarían lo actual.

---

## 2. El modelo de preguntas (NÚCLEO del producto)

Cada pregunta se clasifica por **cuatro dimensiones independientes**, lo que da
enorme flexibilidad para generar tests a medida:

| Dimensión | Valores | Para qué sirve |
|-----------|---------|----------------|
| **Nivel** | `SVB` · `SVI` · `SVA` | Profundidad del temario |
| **Público** ⭐nuevo | `niños` · `jóvenes` · `adultos` (uno o varios) | A quién va dirigida |
| **Tipo** ⭐nuevo | `teórica` · `caso_clínico` | Cómo evalúa |
| **Dificultad** | `fácil` · `media` · `difícil` | Progresión |

### 2.1 Público objetivo (propuesta de rangos — ajústalos tú)

| Público | Edad orientativa | Enfoque didáctico |
|---------|------------------|-------------------|
| 👶 **Niños** | 6–11 (primaria) | RCP adaptada: reconocer, pedir ayuda, llamar 112, compresiones básicas |
| 🧑 **Jóvenes** | 12–17 (ESO/Bach.) | SVB completo |
| 👨 **Adultos** | 18+ | SVB / SVI / SVA según formación |

> Una misma pregunta puede marcarse para **varios públicos** (p. ej. una técnica
> de SVB válida para jóvenes y adultos), evitando duplicar contenido.

### 2.2 Tipos de pregunta

- 📘 **Teórica / técnica** — conocimiento directo.
  *Ej.: «¿Frecuencia de compresiones en el adulto?»*
- 🩺 **Caso clínico** — un escenario que el alumno debe interpretar; evalúa si
  **extrae la información del contexto** y **reconoce la situación**.
  *Ej.: «Encuentras a un hombre de 60 años en la calle, no responde y no respira
  con normalidad. ¿Cuál es tu PRIMER paso?»* (usa el campo *contexto clínico*).

### 2.3 Campos de cada pregunta (esquema enriquecido)

```
- nivel           SVB | SVI | SVA
- públicos        [niños, jóvenes, adultos]        ⭐ nuevo
- tipo            teórica | caso_clínico           ⭐ nuevo
- dificultad      1..3
- enunciado       (texto de la pregunta)
- contexto_clínico(texto del escenario, solo en casos clínicos) ⭐ nuevo
- opciones        [A, B, C, D]
- correcta        índice de la opción correcta
- explicación     por qué es correcta (debriefing)
- fuente_ERC      capítulo / sección / página / enlace ⭐ nuevo
- fuente_plan_nacional  ⭐ nuevo
- vídeo_url       (YouTube u otro) ⭐ nuevo
- flashcard       frase clave para recordar ⭐ nuevo
- etiquetas       [parada, desfibrilación, ...] ⭐ nuevo
- crítica         (marca preguntas prioritarias) ⭐ nuevo
```

---

## 3. Hoja de ruta (fases restantes)

### ▶️ Fase 2 — Motor de test + banco de preguntas enriquecido *(SIGUIENTE)*
- Migrar el modelo de preguntas a las 4 dimensiones (nivel, público, tipo, dificultad) + campos ricos.
- **Pantalla de super admin para crear/editar preguntas** (así Federico carga contenido sin depender del desarrollo) + carga masiva por archivo.
- **Motor de test**: elegir filtros (nivel/público/tipo) → responder → **debriefing** inmediato (explicación + fuente + vídeo + flashcard) → resultado.
- Guardar respuestas de forma anónima.

### Fase 3 — Progreso personal
- Historial del alumno, % de aciertos, evolución.
- **«Practica tus errores»**: test solo con las preguntas falladas.
- Vídeos incrustados.

### Fase 4 — Panel de institución
- Importar alumnos (CSV) → generar **apodos anónimos + códigos/QR**.
- Estadísticas de grupo **anónimas** (top por apodo, medias por nivel).
- Informes exportables.

### Fase 5 — Desafíos, rankings y niveles SVI/SVA
- Retos temporales entre alumnos/grupos, ranking anónimo.
- Recomendación de curso si el rendimiento < 70 %.

### Fase 6 — Hooks de maniquíes (futuro)
- Endpoint para recibir datos WiFi de maniquíes (calidad de compresiones, etc.).

---

## 4. Recomendaciones para una app robusta y escalable

**Ingeniería / operación**
- 🧪 **Tests automáticos + CI** (Vitest + Supertest + GitHub Actions).
- 💳 **Backend de pago** cuando haya usuarios reales (Render gratis "duerme" ~50 s).
- 🔔 **Monitorización de errores** (Sentry) y logs.
- 💾 **Copias de seguridad** de la base de datos (Neon).

**Seguridad / RGPD (crítico: datos de menores)**
- Mantener **anonimato** del alumnado (apodos, no nombres).
- **Consentimiento / términos** y **política de retención** de datos.
- Añadir **cambio de contraseña** (hoy no existe).

**Producto / contenido**
- Empezar por **SVB de calidad** antes que mucho volumen.
- Herramienta propia de autoría de preguntas + validación pedagógica (tú).
- Medir desde el inicio (nº de tests, % aciertos por nivel/público).

---

## 5. Próximo paso inmediato

Construir la **Fase 2**: modelo de preguntas enriquecido + pantalla para crear
preguntas (con público y tipo) + motor de test con debriefing. Esto convierte la
plataforma de «web con login» a «herramienta de formación real» y te permite
empezar a cargar tu contenido médico.
