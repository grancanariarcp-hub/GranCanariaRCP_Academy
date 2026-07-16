# 🎨 DOCUMENTACIÓN DISEÑO CORPORATIVO PROFESIONAL

**Versión:** 1.0  
**Archivo:** MOCKUP_CORPORATIVO_PRO.html  
**Estilo:** Corporativo | Médico | Profesional

---

## 🎯 FILOSOFÍA DE DISEÑO

```
OBJETIVO VISUAL:
├─ Profesionalismo: Aspecto de empresa seria
├─ Confianza: Colores médicos sofisticados
├─ Claridad: Información estructurada
├─ Eficiencia: Aprovechar toda la pantalla
└─ Elegancia: Espacios blancos inteligentes

NO debe parecer:
❌ Infantil (emojis reducidos)
❌ Vibrante (colores suaves)
❌ Desordenado (espacios generosos)
❌ Anticuado (diseño moderno)
```

---

## 🎨 PALETA DE COLORES

### **Colores Primarios (Azules Acero)**

```
--primary-dark: #1a365d
Uso: Headers, botones principales, énfasis
RGB: 26, 54, 93
Descripción: Azul marino oscuro, profesional

--primary-medium: #2d3748
Uso: Gradientes, fondos secundarios
RGB: 45, 55, 72
Descripción: Gris-azulado oscuro, sofisticado

--secondary-dark: #2c5282
Uso: Complementos, acentos
RGB: 44, 82, 130
Descripción: Azul acero medio
```

**Degradado primario:**
```css
background: linear-gradient(135deg, #1a365d 0%, #2d3748 100%);
/* Resultado: Gradiente profesional de azul acero a gris-azulado */
```

---

### **Colores Grises Acero**

```
--gray-100: #f7fafc  (Gris ultra claro - fondos)
--gray-200: #edf2f7  (Gris muy claro - bordes suaves)
--gray-300: #e2e8f0  (Gris claro - líneas divisoras)
--gray-400: #cbd5e0  (Gris medio-claro - placeholders)
--gray-500: #a0aec0  (Gris medio - texto deshabilitado)
--gray-600: #718096  (Gris medio-oscuro - texto secundario)
--gray-700: #4a5568  (Gris oscuro - texto terciario)
--gray-800: #2d3748  (Gris muy oscuro - texto fuerte)
--gray-900: #1a202c  (Gris casi negro - títulos)
```

**Fondo principal:**
```
--bg-primary: #f5f7fa
Descripción: Gris azulado muy claro (NO blanco puro)
Efecto: Reduce fatiga visual, profesional
```

---

### **Colores Acentos (Médicos)**

```
--accent: #c41e3a           (Rojo médico principal)
--accent-light: #e74c3c     (Rojo médico claro)
--success: #276749          (Verde médico)
--warning: #975a16          (Naranja médico)
--danger: #c53030           (Rojo puro)
```

---

## 📏 ESPACIADO Y SIZING

### **Padding (Interior de componentes)**

```
Tabla de espaciado:
├─ 6px   (muy pequeño: badges, small text)
├─ 8px   (pequeño: input interno)
├─ 10px  (pequeño: botones pequeños)
├─ 12px  (base: tabla cells, cards)
├─ 16px  (mediano: navbar, sidebar)
├─ 20px  (grande: card headers)
├─ 24px  (muy grande: main content)
└─ 32px  (máximo: desktop content)
```

### **Gaps (Entre elementos)**

```
Distancias entre componentes:
├─ 8px   (entre elementos en fila)
├─ 12px  (entre botones)
├─ 16px  (entre cards pequeñas)
├─ 24px  (entre sections)
└─ 32px  (entre grandes secciones)
```

### **Responsividad de Spacing**

```
Móvil (< 768px):
└─ padding: 16px
└─ gaps: 12px

Tablet (768px):
└─ padding: 20px
└─ gaps: 16px

Desktop (1024px+):
└─ padding: 24-32px
└─ gaps: 24px
```

---

## 🔤 TIPOGRAFÍA

### **Familia de Fuentes**

```
Stack primario:
-apple-system
BlinkMacSystemFont
'Segoe UI'
'Roboto'
'Oxygen'

Fallback: sans-serif
Resultado: Moderno, limpio, legible
```

### **Escalas de Tamaño**

| Elemento | Tamaño | Peso | Uso |
|----------|--------|------|-----|
| H1 (Título página) | 28px desktop / 22px móvil | 700 | Headers principales |
| H2 (Subtítulo) | 20px | 600 | Card titles |
| H3 (Sección) | 16px | 600 | Sección titles |
| Body | 14px | 400 | Texto normal |
| Small | 13px | 400 | Información secundaria |
| Tiny | 12px | 400 | Labels, badges |
| Micro | 11px | 600 | Timestamps, categorías |

### **Línea Base (Line Height)**

```
Párrafos: 1.6
Títulos: 1.2
Tables: 1.8
Badges: 1.0
```

---

## 📊 GRID SYSTEM

### **Desktop (1024px+)**

```
Estructura de 3 columnas:
┌────────┬──────────────────────────────────────┐
│        │                                      │
│260px   │ Contenido (max 1400px centrado)     │
│sidebar │                                      │
│        │                                      │
└────────┴──────────────────────────────────────┘

Grids dentro del contenido:
1 columna:  100% width
2 columnas: 50% - 50%
3 columnas: 33% - 33% - 33%
4 columnas: 25% - 25% - 25% - 25%

Gaps entre columnas: 24px
```

### **Tablet (768px)**

```
Sin sidebar (hamburger menu)
┌──────────────────────────┐
│     Contenido 100%       │
│                          │
│ [Card] [Card]           │ (2 columnas)
│                          │
└──────────────────────────┘

Grid dentro del contenido:
1 columna:  100%
2 columnas: 50% - 50%
3 columnas: 100% (apiladas)
4 columnas: 50% - 50% (2x2)

Gaps: 16px
```

### **Móvil (< 768px)**

```
┌──────────────┐
│   100% width │
│              │
│ [Card]      │ (1 columna)
│ [Card]      │
│ [Card]      │
│              │
└──────────────┘

Siempre 1 columna
Gaps: 12px
```

---

## 🎴 COMPONENTES REUTILIZABLES

### **1. Stat Card (KPIs)**

```html
<div class="stat-card">
    <div class="stat-value">1,245</div>
    <div class="stat-label">Alumnos Activos</div>
    <div class="stat-change positive">↑ 12% este mes</div>
</div>
```

**Características:**
- Gradiente azul acero
- Valor grande y llamativo
- Label en mayúsculas
- Cambio mensual con color

**Uso:** Dashboards, KPIs, resúmenes

---

### **2. Card Estándar**

```html
<div class="card">
    <div class="card-header">
        <div>
            <div class="card-title">Título</div>
            <div class="card-subtitle">Subtítulo descriptivo</div>
        </div>
    </div>
    <!-- Contenido -->
</div>
```

**Características:**
- Fondo blanco
- Borde gris 200
- Sombra suave
- Header con separador
- Hover eleva (shadow aumenta)

**Variaciones:**
- Con tabla
- Con formulario
- Con gráfico
- Con lista

---

### **3. Tabla Profesional**

```html
<div class="table-responsive">
    <table>
        <thead>
            <tr>
                <th>Encabezado</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Dato</td>
            </tr>
        </tbody>
    </table>
</div>
```

**Características:**
- Header con fondo gris 100
- Bordes finos
- Hover en filas
- Responsive wrapper
- Raya separadora

---

### **4. Badge (Etiqueta)**

```html
<span class="badge badge-success">Excelente</span>
<span class="badge badge-warning">Bueno</span>
<span class="badge badge-danger">Crítico</span>
<span class="badge badge-primary">Nuevo</span>
```

**Variantes:**
- `badge-success`: Verde médico (#c6f6d5, #276749)
- `badge-warning`: Naranja médico (#feebc8, #975a16)
- `badge-danger`: Rojo (#fed7d7, #c53030)
- `badge-primary`: Azul acero (#1a365d con 10% opacity)

---

### **5. Botones**

```html
<!-- Primario (acción principal) -->
<button class="btn-primary">Acción Principal</button>

<!-- Secundario (acción secundaria) -->
<button class="btn-secondary">Cancelar</button>

<!-- Outline (menos énfasis) -->
<button class="btn-outline">Ver más</button>

<!-- Pequeño -->
<button class="btn-primary btn-small">Guardar</button>
```

**Diseño:**
- Primario: Gradiente azul acero + sombra
- Secundario: Fondo gris 200
- Outline: Transparente + borde
- Pequeño: Padding reducido

---

### **6. Formulario**

```html
<div class="form-group">
    <label class="form-label">Nombre</label>
    <input type="text" class="form-input" placeholder="Ingresa nombre">
</div>

<div class="form-group">
    <label class="form-label">Tipo</label>
    <select class="form-select">
        <option>Opción 1</option>
        <option>Opción 2</option>
    </select>
</div>
```

**Características:**
- Labels claros en mayúscula pequeña
- Inputs con borde gris 300
- Focus: Azul acero + sombra
- Placeholders en gris 500
- Alto input: 40px (toque fácil)

---

### **7. Barra de Progreso**

```html
<div class="progress-bar">
    <div class="progress-fill" style="width: 65%;"></div>
</div>
```

**Características:**
- Fondo gris 200
- Fill: Gradiente azul acero
- Animación suave

---

### **8. Info Box (Notificación)**

```html
<div class="info-box">
    📊 <strong>1,245 alumnos</strong> nuevos este mes
</div>
```

**Características:**
- Fondo azul acero 5% opacity
- Borde izquierdo azul acero
- Padding generoso
- Font-size pequeño

---

## 🎯 LAYOUTS ESPECÍFICOS

### **Dashboard (Desktop)**

```
┌─────────────────────────────────────────┐
│ Dashboard | Bienvenido...              │ (Header)
├─────────────────────────────────────────┤
│                                         │
│ [Stat 1] [Stat 2] [Stat 3] [Stat 4]   │ (4 columnas)
│                                         │
│ [Card Gráfico Left] [Card Info Right]  │ (2 columnas)
│                                         │
│ [Tabla Full Width]                      │ (1 columna)
│                                         │
└─────────────────────────────────────────┘
```

### **Formulario (Desktop)**

```
Izquierda (2 columnas):
[Input] [Input]
[Input] [Input]
[Select]

Derecha (info):
[Info box]
[Help text]
```

### **Listado (Desktop)**

```
Header con filtros:
[Input búsqueda] [Selector] [Botón acción]

Tabla:
[Toda la anchura]

Footer:
[Paginación]
```

---

## 🌈 COMBINACIONES DE COLORES

### **Para Success (Positivo)**

```
Fondo: #c6f6d5 (Verde muy claro)
Texto: #276749 (Verde oscuro)
Icono: ✅
```

### **Para Warning (Atención)**

```
Fondo: #feebc8 (Naranja muy claro)
Texto: #975a16 (Naranja oscuro)
Icono: ⚠️
```

### **Para Danger (Error)**

```
Fondo: #fed7d7 (Rojo muy claro)
Texto: #c53030 (Rojo oscuro)
Icono: ❌
```

### **Para Primary (Información)**

```
Fondo: rgba(26, 54, 93, 0.1) (Azul acero 10%)
Texto: #1a365d (Azul acero)
Icono: ℹ️
```

---

## 📱 RESPONSIVE BEHAVIOR

### **Breakpoints**

```
Móvil:    < 768px   (1 columna, sin sidebar)
Tablet:   768-1023px (2 columnas, sin sidebar)
Desktop:  ≥ 1024px   (2-4 columnas, con sidebar)
```

### **Cambios por Breakpoint**

| Elemento | Móvil | Tablet | Desktop |
|----------|-------|--------|---------|
| Sidebar | Hamburger | Hamburger | Visible |
| Grid Stats | 1 col | 2 col | 4 col |
| Grid Cards | 1 col | 2 col | 2-3 col |
| Tipografía | -4px | -2px | Base |
| Padding | 16px | 20px | 24-32px |
| Gaps | 12px | 16px | 24px |

---

## ✨ EFECTOS Y TRANSICIONES

### **Sombras**

```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05)      /* Sutil */
--shadow-md: 0 4px 6px rgba(0,0,0,0.1)       /* Normal */
--shadow-lg: 0 10px 15px rgba(0,0,0,0.1)     /* Elevado */
--shadow-xl: 0 20px 25px rgba(0,0,0,0.1)     /* Flotante */
```

### **Transiciones**

```css
Button hover:  transform: translateY(-2px) + shadow aumenta
Card hover:    shadow-md
Input focus:   border-color + shadow + background
```

### **Animaciones**

```css
Fade in:   opacity 0 → 1 (0.3s)
Slide in:  transform translateY(10px) → 0 (0.3s)
```

---

## 🎓 USO EN PRÁCTICA

### **Crear una Card con estadísticas**

```html
<div class="card">
    <div class="card-header">
        <div class="card-title">Rendimiento SVB</div>
    </div>
    
    <div style="margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">
                Soporte Vital Básico
            </span>
            <span style="font-size: 14px; font-weight: 700; color: var(--primary-dark);">
                85%
            </span>
        </div>
        <div class="progress-bar">
            <div class="progress-fill" style="width: 85%;"></div>
        </div>
    </div>
</div>
```

---

## 📋 CHECKLIST DE COMPONENTES

- [x] Stat Cards (KPIs)
- [x] Cards estándar
- [x] Tablas responsivas
- [x] Badges (4 variantes)
- [x] Botones (3 variantes)
- [x] Formularios completos
- [x] Barras de progreso
- [x] Info boxes
- [x] Sidebar navigation
- [x] Navbar superior
- [x] Grid layouts
- [x] Tipografía escalada

---

## 🎨 PALETA RESUMIDA

```
AZULES ACERO (Primarios):
├─ #1a365d  (Dark - Headers, botones)
├─ #2d3748  (Medium - Gradientes)
└─ #2c5282  (Light - Acentos)

GRISES ACERO (Fondos/Texto):
├─ #f5f7fa  (Fondo principal)
├─ #ffffff  (Fondo cards)
├─ #edf2f7  (Fondo terciario)
└─ #1a202c  (Texto principal)

MÉDICOS (Acentos):
├─ #c41e3a  (Rojo principal)
├─ #276749  (Verde success)
└─ #975a16  (Naranja warning)
```

---

## ✅ RESULTADO FINAL

```
✨ Profesionalismo:     ★★★★★
✨ Confianza médica:    ★★★★★
✨ Modernidad:          ★★★★★
✨ Legibilidad:         ★★★★★
✨ Responsividad:       ★★★★★
✨ Eficiencia espacial: ★★★★★

ESTADO: 🟢 LISTO PARA DESARROLLO
```

Este design system es la base para que Claude Code genere componentes React consistentes y profesionales en Fase 1.
