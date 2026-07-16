# 📐 BREAKPOINTS Y ESTRATEGIA RESPONSIVE

**Versión:** 1.0  
**Archivo:** RESPONSIVE_MOCKUP.html  
**Enfoque:** Mobile-First Responsive Design

---

## 🎯 ESTRATEGIA GENERAL

```
┌─────────────────────────────────────────────────────────┐
│            MOBILE-FIRST RESPONSIVE                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  BASE (Móvil < 480px)                                 │
│  └─ Stack vertical (1 columna)                        │
│  └─ Hamburger menu                                    │
│  └─ Navbar top (navegación arriba)                    │
│  └─ Contenido full-width                              │
│                                                         │
│  TABLET (480px - 1023px)                              │
│  └─ Sidebar izquierda (permanente)                    │
│  └─ Contenido fluye a la derecha                      │
│  └─ Grid: 2 columnas para componentes                 │
│  └─ 250px sidebar + flexible contenido                │
│                                                         │
│  DESKTOP (≥ 1024px)                                   │
│  └─ Sidebar izquierda (280px)                         │
│  └─ Contenido centrado (max-width 1400px)             │
│  └─ Grid: 3-4 columnas para componentes               │
│  └─ Espacios generosos                                │
│  └─ Tipografía más grande                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 BREAKPOINTS DEFINIDOS

### **1. MÓVIL (< 480px) - Base/Default**

```css
/* No se necesitan media queries para esto */
/* Es el CSS base */
```

**Características:**
- ✅ Stack vertical (1 columna)
- ✅ Navbar móvil con hamburger
- ✅ Sidebar hidden por defecto
- ✅ Overlay para menú lateral
- ✅ Botones full-width
- ✅ Padding reducido (16px)
- ✅ Tipografía pequeña

**Grid del layout:**
```
┌──────────────────────┐
│   Navbar (60px)      │  ← Hamburger + Logo
├──────────────────────┤
│                      │
│    Content           │  ← Full-width (16px padding)
│  (Stack vertical)    │
│                      │
└──────────────────────┘
```

**Componentes en móvil:**
- Stat cards: 1 columna
- Forms: Full-width
- Buttons: Full-width
- Course cards: Full-width
- Rankings: Single column

**Ejemplo visual:**
```
┌─ ☰ RCP Academy ─┐
├──────────────────┤
│ [Botón primario] │
│ [Botón secundario]
│                  │
│ 📝 12 Tests      │
│ ✅ 78% Promedio  │
│                  │
│ ❌ Error 1       │
│ ❌ Error 2       │
│                  │
└──────────────────┘
```

---

### **2. TABLET (768px - 1023px)**

```css
@media (min-width: 768px) {
    .app-container {
        grid-template-columns: 250px 1fr;
        grid-template-rows: 1fr;
    }
    
    .navbar-mobile {
        display: none;  /* Esconder navbar móvil */
    }
    
    .sidebar {
        display: flex;  /* Mostrar sidebar */
        position: static;
        width: 250px;
    }
    
    .stats-grid {
        grid-template-columns: repeat(2, 1fr);  /* 2 columnas */
    }
}
```

**Características:**
- ✅ Sidebar visible permanentemente (izquierda)
- ✅ Sin hamburger menu
- ✅ Grid 2 columnas para stats
- ✅ Sidebar 250px fijo
- ✅ Contenido fluye a la derecha
- ✅ Padding mediano (20-24px)
- ✅ Tipografía mediana

**Grid del layout:**
```
┌─────────┬──────────────────────────┐
│         │                          │
│ Sidebar │    Content               │
│ (250px) │    (flex, variable)      │
│         │                          │
│ - Home  │  [Stat 1] [Stat 2]      │
│ - Tests │  [Stat 3] [Stat 4]      │
│ - Rank  │                          │
│ - Admin │  [Button 1] [Button 2]  │
│         │                          │
└─────────┴──────────────────────────┘
```

**Componentes en tablet:**
- Stat cards: 2 columnas
- Forms: Full-width
- Buttons: 2 por fila en algunos casos
- Course cards: 2 columnas (primera fila) + 1 (segunda)
- Rankings: Single column

---

### **3. DESKTOP (≥ 1024px)**

```css
@media (min-width: 1024px) {
    .sidebar {
        width: 280px;  /* Ligeramente más ancho */
    }
    
    .content {
        max-width: 1400px;  /* Limita ancho máximo */
        margin: 0 auto;  /* Centra contenido */
        padding: 24px 32px;  /* Más espacios */
    }
    
    .stats-grid {
        grid-template-columns: repeat(4, 1fr);  /* 4 columnas */
    }
    
    .courses-section {
        display: grid;
        grid-template-columns: repeat(3, 1fr);  /* 3 columnas */
        gap: 16px;
    }
}
```

**Características:**
- ✅ Sidebar 280px (más ancho que tablet)
- ✅ Contenido centrado (max 1400px)
- ✅ Grid 3-4 columnas para componentes
- ✅ Padding generoso (24-32px)
- ✅ Tipografía grande
- ✅ Espacios más amplios (gap 16px)
- ✅ Elementos distribuidos horizontalmente

**Grid del layout:**
```
┌──────────┬────────────────────────────────────┐
│          │                                    │
│ Sidebar  │        Content (max 1400px)        │
│ (280px)  │       (centrado)                   │
│          │                                    │
│ - Home   │ [Stat 1] [Stat 2] [Stat 3] [Stat 4]
│ - Tests  │                                    │
│ - Rank   │ [Course 1] [Course 2] [Course 3]  │
│ - Admin  │                                    │
│          │ [Error 1] [Error 2] [Error 3]     │
│          │                                    │
└──────────┴────────────────────────────────────┘
```

**Componentes en desktop:**
- Stat cards: 4 columnas
- Forms: Inline cuando es posible
- Buttons: 2-3 por fila
- Course cards: 3 columnas
- Rankings: Single column (full-width)

---

## 🔄 COMPONENTES Y SU COMPORTAMIENTO POR BREAKPOINT

### **1. Stat Cards (Tarjetas de estadísticas)**

| Breakpoint | Grid | Ancho | Ejemplo |
|-----------|------|-------|---------|
| Móvil (< 768px) | 1 col | 100% | `📝 Tests` `✅ Promedio` |
| Tablet (768px) | 2 col | 50% c/u | `📝 Tests` `✅ Promedio` |
| Desktop (1024px) | 4 col | 25% c/u | 4 stats en una fila |

```css
/* Móvil (default) */
.stats-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
}

/* Tablet */
@media (min-width: 768px) {
    .stats-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
    }
}

/* Desktop */
@media (min-width: 1024px) {
    .stats-grid {
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
        margin-bottom: 32px;
    }
}
```

---

### **2. Cursos Section**

| Breakpoint | Grid | Ancho | Ejemplo |
|-----------|------|-------|---------|
| Móvil | 1 col | 100% | SVB, SVI, SVA apilados |
| Tablet | 1 col | 100% | SVB, SVI, SVA apilados |
| Desktop | 3 col | 33% c/u | 3 en una fila |

```css
/* Móvil/Tablet (default) */
.courses-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

/* Desktop */
@media (min-width: 1024px) {
    .courses-section {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
        margin-bottom: 32px;
    }
}
```

---

### **3. Botones**

| Breakpoint | Display | Comportamiento |
|-----------|---------|-----------------|
| Móvil | width: 100% | Full-width siempre |
| Tablet | width: auto | 2 botones en fila (flex) |
| Desktop | width: auto | 2-3 en fila según contexto |

```css
/* Móvil (default) */
button {
    width: 100%;
    padding: 12px 16px;
}

.button-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

/* Tablet */
@media (min-width: 768px) {
    button {
        width: auto;
    }
    
    .button-group {
        flex-direction: row;
        gap: 12px;
    }
    
    .button-group button {
        flex: 1;
    }
}
```

---

### **4. Navigation / Sidebar**

| Breakpoint | Estado | Comportamiento |
|-----------|--------|-----------------|
| Móvil | Hidden | Hamburger menu, aparece al click |
| Tablet | Visible | Sidebar fijo izquierda |
| Desktop | Visible | Sidebar 280px fijo |

```css
/* Móvil (default) */
.sidebar {
    display: none;
    position: fixed;
    z-index: 1000;
}

.hamburger {
    display: block;
}

.navbar-mobile {
    display: flex;
}

/* Tablet */
@media (min-width: 768px) {
    .sidebar {
        display: flex !important;
        position: static;
        width: 250px;
    }
    
    .hamburger {
        display: none;
    }
    
    .navbar-mobile {
        display: none;
    }
}

/* Desktop */
@media (min-width: 1024px) {
    .sidebar {
        width: 280px;
    }
}
```

---

### **5. Tipografía**

| Breakpoint | H1 | H2 | Body | Label |
|-----------|----|----|------|-------|
| Móvil | 22px | 20px | 12px | 12px |
| Tablet | 26px | 24px | 13px | 13px |
| Desktop | 32px | 28px | 14px | 14px |

```css
/* Móvil (default) */
.screen-header h1 {
    font-size: 22px;
}

/* Tablet */
@media (min-width: 768px) {
    .screen-header h1 {
        font-size: 26px;
    }
}

/* Desktop */
@media (min-width: 1024px) {
    .screen-header h1 {
        font-size: 32px;
    }
}
```

---

### **6. Espaciado/Padding**

| Breakpoint | Content Padding | Form Gap | Component Gap |
|-----------|-----------------|----------|-----------------|
| Móvil | 16px | 6px | 8-12px |
| Tablet | 20px | 8px | 12px |
| Desktop | 24-32px | 8px | 16px |

```css
/* Móvil (default) */
.content {
    padding: 16px;
}

.form-group {
    gap: 6px;
    margin-bottom: 14px;
}

.button-group {
    gap: 12px;
}

/* Tablet */
@media (min-width: 768px) {
    .content {
        padding: 20px;
    }
}

/* Desktop */
@media (min-width: 1024px) {
    .content {
        padding: 24px 32px;
    }
    
    .stats-grid {
        gap: 16px;
    }
}
```

---

## 📱 VISIÓN POR DISPOSITIVO

### **MÓVIL (375px - iPhone 12)**

```
┌──────────────────────────────────────────┐
│   ☰  ❤️  RCP Academy                   │  ← Navbar
├──────────────────────────────────────────┤
│                                          │
│             LANDING                      │
│                                          │
│  [❤️ Logo]                              │
│                                          │
│  GranCanaria RCP Academy                │
│  Formación en RCP                       │
│  Guías ERC 2025                         │
│                                          │
│  [Soy Alumno/Profesional]              │  ← Full-width
│  [Soy Institución]                     │
│                                          │
│  📚 CURSOS DISPONIBLES                  │
│                                          │
│  ┌─────────────────────────────┐        │
│  │ SVB - Soporte Vital Básico  │        │
│  │ Para todos                  │        │
│  │ [Ver curso →]              │        │
│  └─────────────────────────────┘        │
│                                          │
│  ┌─────────────────────────────┐        │
│  │ SVI - Soporte Vital Inmediato
│  │ Estudiantes...              │        │
│  │ [Ver curso →]              │        │
│  └─────────────────────────────┘        │
│                                          │
│  ┌─────────────────────────────┐        │
│  │ SVA - Soporte Vital Avanzado
│  │ Médicos y Enfermeros...     │        │
│  │ [Ver curso →]              │        │
│  └─────────────────────────────┘        │
│                                          │
└──────────────────────────────────────────┘
```

---

### **TABLET (768px - iPad)**

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  ┌─────────────┬───────────────────────────────────┐ │
│  │             │           LANDING                 │ │
│  │  SIDEBAR    │                                   │ │
│  │             │  [❤️ Logo]                       │ │
│  │  🏠 Home    │  GranCanaria RCP Academy         │ │
│  │  👤 Alumno  │  Formación en RCP                │ │
│  │  🏥 Instit. │                                   │ │
│  │  📊 Dashbo. │  [Soy Alumno] [Soy Institución]  │ │
│  │  📝 Test    │                                   │ │
│  │  🏆 Rank    │  📚 CURSOS DISPONIBLES           │ │
│  │  ⚙️  Admin   │                                   │ │
│  │             │  ┌────────────────────────────┐  │ │
│  │             │  │ SVB                        │  │ │
│  │             │  │ Para todos                 │  │ │
│  │             │  │ [Ver curso]               │  │ │
│  │             │  └────────────────────────────┘  │ │
│  │             │  ┌────────────────────────────┐  │ │
│  │             │  │ SVI                        │  │ │
│  │             │  │ Estudiantes...             │  │ │
│  │             │  │ [Ver curso]               │  │ │
│  │             │  └────────────────────────────┘  │ │
│  │             │                                   │ │
│  └─────────────┴───────────────────────────────────┘ │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

### **DESKTOP (1200px - PC)**

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                    │
│  ┌──────────────┬──────────────────────────────────────────────────────┐          │
│  │              │                                                      │          │
│  │   SIDEBAR    │         CONTENT (max-width: 1400px, centered)       │          │
│  │   (280px)    │                                                      │          │
│  │              │  LANDING                                             │          │
│  │  🏠 Home     │                                                      │          │
│  │  👤 Alumno   │  ❤️ GranCanaria RCP Academy                         │          │
│  │  🏥 Institu. │  Formación en RCP - Guías ERC 2025                  │          │
│  │  📊 Dashbo.  │                                                      │          │
│  │  📝 Test     │  [Soy Alumno] [Soy Institución]                     │          │
│  │  🏆 Ranking  │                                                      │          │
│  │  ⚙️  Admin    │  📚 CURSOS DISPONIBLES                              │          │
│  │              │                                                      │          │
│  │              │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐│          │
│  │              │  │ SVB         │  │ SVI         │  │ SVA         ││          │
│  │              │  │ Para todos  │  │ Estudiantes │  │ Médicos     ││          │
│  │              │  │ [Ver curso] │  │ [Ver curso] │  │ [Ver curso] ││          │
│  │              │  └─────────────┘  └─────────────┘  └─────────────┘│          │
│  │              │                                                      │          │
│  └──────────────┴──────────────────────────────────────────────────────┘          │
│                                                                                    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🧪 CÓMO PROBAR RESPONSIVIDAD

### **Opción 1: Navegador Desktop**
```
1. Abre RESPONSIVE_MOCKUP.html
2. Presiona F12 (DevTools)
3. Click en "Toggle device toolbar" (Ctrl+Shift+M)
4. Prueba diferentes dispositivos:
   - iPhone 12 (375x812)
   - iPad (768x1024)
   - Desktop (1400px)
5. Redimensiona ventana → Ve cómo se adapta en tiempo real
```

### **Opción 2: Redimensionar ventana**
```
1. Abre RESPONSIVE_MOCKUP.html en navegador
2. Redimensiona ventana lentamente:
   - Empieza en 375px (móvil)
   - Observa en 768px (cambio a tablet)
   - Observa en 1024px (cambio a desktop)
3. Fíjate en:
   - Hamburger desaparece en 768px
   - Sidebar aparece
   - Grid cambia de columnas
   - Espaciado aumenta
```

### **Opción 3: Dispositivos reales**
```
1. Descarga RESPONSIVE_MOCKUP.html
2. Abre en móvil: www.tudominio.com/mockup.html
3. Prueba en tableta
4. Prueba en PC
5. Gira el dispositivo (landscape/portrait)
```

---

## 📋 CHECKLIST DE COMPONENTES RESPONSIVE

- [x] Navigation (hamburger móvil, sidebar tablet+)
- [x] Stat cards (1 col → 2 col → 4 col)
- [x] Button groups (column → row)
- [x] Form inputs (full-width siempre)
- [x] Course cards (1 col → 1 col → 3 col)
- [x] Rankings (single column en todos)
- [x] Tipografía adaptativa
- [x] Espaciado adaptativo
- [x] Padding adaptativo

---

## 🎯 VISTA PREVIA POR PANTALLA

### **Pantalla Landing**

**Móvil:**
```
Header + Logo
Botones (full-width)
Cursos (apilados vertical)
```

**Tablet:**
```
Header + Logo
Botones (2 en fila)
Cursos (apilados vertical)
```

**Desktop:**
```
Header + Logo
Botones (2 en fila)
Cursos (3 en fila horizontal)
```

---

### **Pantalla Dashboard**

**Móvil:**
```
Stat 1 (100%)
Stat 2 (100%)
Errores (apilados)
Botón (full-width)
```

**Tablet:**
```
Stat 1 | Stat 2
Errores (apilados)
Botón (width: auto)
```

**Desktop:**
```
Stat 1 | Stat 2 | Stat 3 | Stat 4
Errores (distribuidos)
Botón (width: auto)
```

---

## 🚀 IMPLEMENTACIÓN EN REACT/NEXT.JS

Cuando pasemos a código real, usaremos:

```javascript
// Hooks para detectar breakpoint
const useMediaQuery = (query) => {
    const [matches, setMatches] = useState(false);
    
    useEffect(() => {
        const media = window.matchMedia(query);
        setMatches(media.matches);
        
        const listener = () => setMatches(media.matches);
        media.addEventListener('change', listener);
        
        return () => media.removeEventListener('change', listener);
    }, [query]);
    
    return matches;
};

// Uso en componentes
const Dashboard = () => {
    const isMobile = useMediaQuery('(max-width: 767px)');
    const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
    const isDesktop = useMediaQuery('(min-width: 1024px)');
    
    return (
        <div className={isMobile ? 'grid-1col' : isTablet ? 'grid-2col' : 'grid-4col'}>
            {/* Componentes */}
        </div>
    );
};
```

---

## ✅ RESUMEN

```
BREAKPOINTS CLAVE:
├─ Móvil: < 480px (iPhone, Android pequeño)
├─ Tablet: 768px - 1023px (iPad, tablets)
└─ Desktop: ≥ 1024px (PC, laptops)

CAMBIOS PRINCIPALES:
├─ 480px: (Dentro de móvil, ajustes menores)
├─ 768px: Aparece sidebar, desaparece hamburger ⭐
├─ 1024px: Grid expandido, espaciado aumenta ⭐
└─ 1400px: Max-width limit del contenido

COMPONENTES ADAPTABLES:
├─ Stats: 1 → 2 → 4 columnas
├─ Cursos: 1 → 1 → 3 columnas
├─ Botones: Full-width → Inline
├─ Navigation: Hamburger → Sidebar
└─ Tipografía: Escalada progresiva

ESTADO: ✅ Listo para React/Next.js
```
