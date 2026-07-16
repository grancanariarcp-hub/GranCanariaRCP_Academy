# 🚀 PASO A PASO: INICIO DE PROYECTO EN VS CODE, POWERSHELL Y CLAUDE CODE

**Versión:** 1.0  
**Fecha:** Enero 2026  
**Tiempo estimado:** 2-3 horas (Fase 0)

---

## 📋 ÍNDICE

1. [Requisitos previos](#requisitos-previos)
2. [Fase 0: Preparación (30 min)](#fase-0-preparación)
3. [Fase 1: Setup Local (30 min)](#fase-1-setup-local)
4. [Fase 2: Cuentas externas (45 min)](#fase-2-cuentas-externas)
5. [Fase 3: Claude Code (45 min)](#fase-3-claude-code)
6. [Validación y troubleshooting](#validación-y-troubleshooting)

---

## ✅ REQUISITOS PREVIOS

### **Software necesario (descarga si no lo tienes):**

```
☑️ VS Code
   └─ Descargar: https://code.visualstudio.com/
   └─ Instalar normalmente
   
☑️ Node.js (v18+)
   └─ Descargar: https://nodejs.org/ (LTS)
   └─ Instalar normalmente
   └─ Verificar: Abre PowerShell → node --version
   
☑️ Git
   └─ Descargar: https://git-scm.com/
   └─ Instalar normalmente
   └─ Verificar: git --version en PowerShell
   
☑️ Claude Code (VS Code extension)
   └─ En VS Code: Extension Marketplace
   └─ Buscar: "Claude Code"
   └─ Instalar (es de Anthropic)
   
☑️ PowerShell 7+ (Windows 11 ya lo incluye)
   └─ O usar PowerShell Core si es versión antigua
```

### **Cuentas necesarias (crea si no las tienes):**

```
☑️ GitHub account
   └─ https://github.com/signup
   
☑️ Vercel account
   └─ https://vercel.com/signup
   └─ Conecta con GitHub cuando lo pidas
   
☑️ Firebase account
   └─ https://firebase.google.com/
   └─ Usa Gmail/Google
   
☑️ Hostinger cuenta
   └─ Ya lo tienes (dominio RCP)
   └─ Nota: usuario y contraseña
```

---

## 🔧 FASE 0: PREPARACIÓN (30 minutos)

### **Paso 0.1: Crear carpeta de proyecto**

```powershell
# Abre PowerShell como Administrador
# (Click derecho en escritorio → PowerShell)

# Crea carpeta base
mkdir C:\ProyectosRCP
cd C:\ProyectosRCP

# Crea subcarpetas
mkdir docs
mkdir scripts
mkdir references

# Verifica estructura
ls

# Debería mostrar:
# docs/
# scripts/
# references/
```

### **Paso 0.2: Descargar archivos de referencia**

```
Descarga estos 4 archivos de la salida anterior:
↓
C:\ProyectosRCP\references\
├─ RESPONSIVE_MOCKUP.html (abre en navegador - visualización)
├─ DOCUMENTACION_BREAKPOINTS.md (referencia - léelo)
├─ ARQUITECTURA_AUTENTICACION.md (referencia - léelo)
└─ RESUMEN_CAMBIOS_AUTENTICACION.md (referencia - léelo)
```

### **Paso 0.3: Verificar instalaciones**

```powershell
# Verifica Node.js
node --version
# Debería mostrar: v18.x.x o superior

# Verifica npm
npm --version
# Debería mostrar: 9.x.x o superior

# Verifica Git
git --version
# Debería mostrar: git version 2.x.x

# Si alguno falla:
# 1. Descárgalo de los links anteriores
# 2. Instála
# 3. REINICIA PowerShell
# 4. Vuelve a probar
```

**Si todo dice "command not found":**
```
→ Instala desde https://nodejs.org/ (LTS)
→ Reinicia Windows completamente
→ Vuelve a probar
```

---

## 📂 FASE 1: SETUP LOCAL (30 minutos)

### **Paso 1.1: Inicializar repositorio Git**

```powershell
cd C:\ProyectosRCP

# Inicializa git
git init

# Configura git (importante para commits)
git config --global user.name "Tu Nombre"
git config --global user.email "tu@email.com"

# Verifica
git config --list

# Debería mostrar:
# user.name=Tu Nombre
# user.email=tu@email.com
```

### **Paso 1.2: Crear estructura de carpetas**

```powershell
# Estructura final que Claude Code generará:
mkdir frontend
mkdir backend
mkdir mobile (opcional por ahora)
mkdir docs\technical
mkdir docs\api
mkdir scripts\setup
mkdir scripts\deploy

# Crear archivos base
New-Item .gitignore -Force
New-Item .env.example -Force
New-Item README.md -Force

# Estructura actual:
# C:\ProyectosRCP\
# ├─ frontend/
# ├─ backend/
# ├─ docs/
# │  ├─ technical/
# │  └─ api/
# ├─ scripts/
# │  ├─ setup/
# │  └─ deploy/
# ├─ references/  (los 4 archivos)
# ├─ .gitignore
# ├─ .env.example
# └─ README.md
```

### **Paso 1.3: Crear .gitignore**

```
# Usa VS Code para esto

1. Abre VS Code
2. File → Open Folder → C:\ProyectosRCP
3. Crea nuevo archivo: .gitignore
4. Copia esto:
```

```
# Dependencies
node_modules/
.npm
package-lock.json
yarn.lock

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/settings.json
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Build
dist/
build/
.next/

# Logs
*.log
npm-debug.log*

# Database
*.sqlite
*.db

# Temp
.tmp/
temp/
```

---

## 🔑 FASE 2: CUENTAS EXTERNAS (45 minutos)

### **Paso 2.1: Crear cuenta GitHub (si no la tienes)**

```
1. Ve a: https://github.com/signup
2. Email: tu@email.com
3. Contraseña: segura (guárdala!)
4. Username: ej. tu_usuario_rcp
5. Verifica email
6. Hecho ✅
```

### **Paso 2.2: Crear repositorio en GitHub**

```
1. Login en https://github.com
2. Click en "+" (arriba derecha) → New Repository
3. Repository name: GranCanariaRCP_Academy
4. Description: Plataforma de formación RCP
5. Public o Private (elige)
6. Initialize with README: NO (ya lo haremos)
7. Create repository

Copia la URL que te da:
ej: https://github.com/tu_usuario/GranCanariaRCP_Academy.git
```

### **Paso 2.3: Conectar repositorio local con GitHub**

```powershell
cd C:\ProyectosRCP

# Conectar remoto
git remote add origin https://github.com/TU_USUARIO/GranCanariaRCP_Academy.git

# Verifica
git remote -v
# Debería mostrar:
# origin  https://github.com/... (fetch)
# origin  https://github.com/... (push)

# Primer commit
git add .
git commit -m "Initial commit: Project structure setup"
git branch -M main
git push -u origin main

# Si pide credenciales:
# Usa: username + token de GitHub
# (Crea token en GitHub → Settings → Developer settings → PAT)
```

### **Paso 2.4: Crear cuenta Vercel**

```
1. Ve a: https://vercel.com/signup
2. Click: "Continue with GitHub"
3. Autoriza Vercel en GitHub
4. Importa repositorio GranCanariaRCP_Academy
5. Skip create team
6. Hecho ✅

Guarda:
- Vercel URL: https://grancanaria-rcp-academy.vercel.app
```

### **Paso 2.5: Crear cuenta Firebase**

```
1. Ve a: https://firebase.google.com/
2. Click: "Go to console"
3. Click: "Create project"
4. Project name: GranCanariaRCP
5. Analytics: No (por ahora)
6. Create project
7. Click: "Web" (símbolo </> )
8. App nickname: grancanaria-rcp-web
9. Register app

Guarda el config:
```

```javascript
// Tu config Firebase (no lo subas a GitHub!)
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "grancanaria....",
  projectId: "grancanaria...",
  storageBucket: "grancanaria....",
  messagingSenderId: "123...",
  appId: "1:123:web:abc..."
};
```

```
⚠️ IMPORTANTE: Este config va en .env.local
NO en repositorio público
```

### **Paso 2.6: Crear cuenta ElephantSQL (o tu BD en Hostinger)**

**Opción A: ElephantSQL (fácil, gratis)**
```
1. Ve a: https://www.elephantsql.com/
2. Sign up con GitHub
3. Create new instance
4. Name: grancanaria-rcp-prod
5. Plan: Tiny Turtle (free)
6. Region: EU (Ireland)
7. Create instance

Guarda la URL:
postgres://username:password@host:5432/database
```

**Opción B: Hostinger (ya tienes dominio)**
```
1. Accede a Hostinger panel
2. Bases de datos
3. Crear base de datos PostgreSQL
4. Nombre: grancanaria_rcp_db
5. Usuario: rcp_admin
6. Contraseña: segura

Guarda los datos de conexión
```

---

## 🎯 FASE 3: CLAUDE CODE (45 minutos)

### **Paso 3.1: Instalar extensión Claude Code en VS Code**

```
1. Abre VS Code
2. File → Open Folder → C:\ProyectosRCP
3. Click en "Extensions" (Ctrl+Shift+X)
4. Busca: "Claude Code"
5. Instala (es de Anthropic)
6. Reinicia VS Code
```

### **Paso 3.2: Crear archivo .env.local**

```powershell
# En PowerShell, en C:\ProyectosRCP:

New-Item .env.local -Force

# Abre el archivo en VS Code y escribe:
```

```
# Autenticación Claude Code
ANTHROPIC_API_KEY=sk-ant-...

# Firebase
FIREBASE_API_KEY=AIza...
FIREBASE_AUTH_DOMAIN=grancanaria...
FIREBASE_PROJECT_ID=grancanaria...

# Base de datos
DATABASE_URL=postgresql://user:pass@host:5432/db

# Vercel
VERCEL_TOKEN=vercel_xxxxx

# Git
GITHUB_TOKEN=ghp_xxxxx

# Aplicación
NODE_ENV=development
PORT=3000
```

**¿De dónde sacar los tokens?**
```
ANTHROPIC_API_KEY:
  → https://console.anthropic.com/account/keys
  
FIREBASE_*:
  → Copia del console de Firebase
  
DATABASE_URL:
  → ElephantSQL o Hostinger
  
VERCEL_TOKEN:
  → Vercel Settings → Tokens → Create
  
GITHUB_TOKEN:
  → GitHub Settings → Developer settings → Personal access tokens
```

### **Paso 3.3: Abrir Claude Code**

```
En VS Code:

1. Ctrl+Shift+P (Command Palette)
2. Escribe: "Claude Code"
3. Selecciona: "Claude Code: Start Session"
4. Se abre nueva ventana/panel
5. Espera a que se conecte
```

### **Paso 3.4: Crear System Prompt para Claude Code**

Copia esto en la primera interacción con Claude Code:

```
SYSTEM PROMPT - FASE 1 (Copia completo)

Eres un desarrollador senior full-stack especializado en:
- React 18 + Next.js 14
- Node.js + Express
- PostgreSQL
- Seguridad y RGPD

PROYECTO: GranCanaria RCP Academy
- Plataforma de formación en RCP
- Responsive design (móvil/tablet/desktop)
- 3 tipos de usuarios (menor, mayor, admin)

FASE 1: INFRAESTRUCTURA Y AUTENTICACIÓN

TAREAS:
1. Crear estructura Next.js 14 (app router)
2. Crear estructura Express backend
3. Schema PostgreSQL con tablas de:
   - institutions (institución)
   - students (alumnos)
   - test_responses (respuestas)
   - users (administradores)
4. Endpoints de autenticación:
   - POST /api/auth/student/register (mayores)
   - POST /api/auth/student/login-email (email+pass)
   - POST /api/auth/student/login-code (UUID)
   - POST /api/auth/institution/login (admin)
   - POST /api/auth/logout
5. Middlewares:
   - JWT validation
   - Rate limiting
   - CORS
6. Variables de entorno (.env.local)

RESTRICCIONES:
- NO almacenar datos innecesarios
- Encriptar: passwords (bcrypt), datos sensibles (AES-256)
- Identity hash para menores (irreversible)
- Logs de auditoría para acciones críticas
- HTTPS obligatorio en producción

ESTRUCTURA DE CARPETAS:
frontend/
├─ app/
│  ├─ (auth)/
│  │  ├─ login/
│  │  ├─ register/
│  │  └─ layout.tsx
│  ├─ (dashboard)/
│  │  ├─ dashboard/
│  │  ├─ tests/
│  │  └─ layout.tsx
│  ├─ api/
│  │  └─ auth/
│  │     ├─ login/
│  │     └─ register/
│  └─ layout.tsx
├─ components/
│  ├─ auth/
│  ├─ dashboard/
│  └─ common/
├─ context/
│  └─ AuthContext.tsx
├─ hooks/
│  ├─ useAuth.ts
│  └─ useMediaQuery.ts
├─ lib/
│  ├─ api.ts
│  └─ utils.ts
├─ styles/
│  └─ globals.css
└─ .env.local

backend/
├─ src/
│  ├─ routes/
│  │  ├─ auth.routes.ts
│  │  └─ institutions.routes.ts
│  ├─ controllers/
│  │  ├─ auth.controller.ts
│  │  └─ institutions.controller.ts
│  ├─ models/
│  │  ├─ User.ts
│  │  └─ Student.ts
│  ├─ middleware/
│  │  ├─ auth.ts
│  │  ├─ rateLimiter.ts
│  │  └─ errorHandler.ts
│  ├─ config/
│  │  ├─ database.ts
│  │  └─ env.ts
│  ├─ utils/
│  │  ├─ crypto.ts
│  │  └─ jwt.ts
│  └─ index.ts
├─ .env.local
└─ package.json

CONVENCIONES:
- Commits: "feat: [módulo] [descripción]"
- Nombres: camelCase para JS, snake_case para BD
- Comentarios: Explicar el POR QUÉ, no el QUÉ
- Tipos: Usar TypeScript siempre

ENTREGA AL FINAL DE FASE 1:
- ✅ Proyecto Next.js funcional (npm run dev)
- ✅ Servidor Express en puerto 5000
- ✅ BD PostgreSQL con datos de prueba
- ✅ Endpoints de auth validados
- ✅ .env.local completado
- ✅ README con instrucciones setup
```

### **Paso 3.5: Ejecutar Fase 1 con Claude Code**

```
Una vez pasted el System Prompt:

1. Claude Code generará archivos
2. Tú los ves en VS Code (click en archivos)
3. Claude Code te pide confirmaciones
4. Valida mientras genera

MIENTRAS CLAUDE CODE TRABAJA:
- NO cierres la sesión
- Responde sus preguntas
- Si hay error, dile: "Corrige el error [descripción]"
```

---

## 🔍 VALIDACIÓN Y TROUBLESHOOTING

### **Checklist: Antes de continuar**

```
FASE 0 (Preparación):
☑ Carpeta C:\ProyectosRCP creada
☑ Node.js v18+ instalado
☑ Git instalado
☑ PowerShell funcionando

FASE 1 (Setup Local):
☑ Repositorio git inicializado
☑ Estructura de carpetas creada
☑ .gitignore configurado
☑ Primer commit hecho

FASE 2 (Cuentas):
☑ Cuenta GitHub creada
☑ Repositorio en GitHub creado
☑ Vercel conectado
☑ Firebase proyecto creado
☑ Base de datos (ElephantSQL o Hostinger)
☑ .env.local creado con tokens

FASE 3 (Claude Code):
☑ Claude Code instalado en VS Code
☑ .env.local visible en proyecto
☑ System Prompt pegado en Claude Code
☑ Primer archivo generado
```

---

### **Errores comunes y soluciones**

| Error | Causa | Solución |
|-------|-------|----------|
| "node: command not found" | Node no instalado | Instala desde nodejs.org, reinicia |
| "git: command not found" | Git no instalado | Instala desde git-scm.com, reinicia |
| "Cannot find .env.local" | Archivo no creado | New-Item .env.local en PowerShell |
| "Remote rejected" en git push | Token GitHub inválido | Crea nuevo token en GitHub Settings |
| "Claude Code no abre" | Extensión no instalada | Marketplace de VS Code, reinstala |
| "DATABASE_URL inválido" | Typo en conexión | Verifica en ElephantSQL panel |

---

## 📝 TEMPLATE: CREDENCIALES SEGURAS

Crea archivo `credentials.txt` (NO en repo):

```
=== GRANCANARIA RCP ACADEMY - CREDENCIALES ===
Fecha: [Hoy]
Actualizado: [Hoy]

1. GITHUB
   Usuario: [tu_usuario]
   Email: [tu@email.com]
   Token: ghp_xxxxx (en .env.local)
   Repo: https://github.com/.../GranCanariaRCP_Academy

2. VERCEL
   Email: [tu@email.com]
   Token: vercel_xxxxx (en .env.local)
   URL: https://grancanaria-rcp-academy.vercel.app

3. FIREBASE
   Project ID: grancanaria-rcp
   API Key: AIza... (en .env.local)
   Console: https://console.firebase.google.com

4. BASE DE DATOS
   Provider: ElephantSQL | Hostinger
   URL: postgres://user:pass@host:5432/db (en .env.local)
   Usuario: [username]
   Contraseña: [password]

5. CLAUDE CODE
   API Key: sk-ant-... (en .env.local)
   Docs: https://claude.ai/docs

⚠️ GUARDAR ESTE ARCHIVO EN LUGAR SEGURO
   NO compartir, NO subir a GitHub
```

---

## ✅ RESUMEN DEL FLUJO

```
ANTES DE EMPEZAR
├─ Descargar referencia (4 archivos)
├─ Instalar Node.js, Git, VS Code
└─ Crear cuentas: GitHub, Vercel, Firebase, BD

FASE 0: PREPARACIÓN (30 min)
├─ Crear carpeta C:\ProyectosRCP
├─ Verificar instalaciones
└─ Descargar referencias

FASE 1: SETUP LOCAL (30 min)
├─ Inicializar Git
├─ Crear estructura de carpetas
└─ Primer commit

FASE 2: CUENTAS EXTERNAS (45 min)
├─ GitHub: crear repo
├─ Vercel: conectar
├─ Firebase: crear proyecto
├─ Base de datos: crear
└─ .env.local: llenar

FASE 3: CLAUDE CODE (45 min)
├─ Instalar extensión
├─ Crear .env.local
├─ Abrir Claude Code
├─ Pegar System Prompt
└─ Claude Code genera Fase 1

TOTAL: ~2.5 horas

RESULTADO:
✅ Proyecto funcional
✅ Servidor backend en puerto 5000
✅ Frontend Next.js listo
✅ BD PostgreSQL configurada
✅ Autenticación preparada
```

---

## 🚀 COMANDO FINAL PARA INICIAR

Una vez completada Fase 3:

```powershell
cd C:\ProyectosRCP\frontend

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Debería mostrar:
# ▲ Next.js 14.x
# - Local:    http://localhost:3000
# - Packages: npm
```

Abre en navegador: http://localhost:3000

¡Listo para trabajar! 🎉

---

## 📞 PROBLEMAS COMUNES

**¿Qué hago si Claude Code se desconecta?**
```
1. Ctrl+Shift+P → Claude Code: Stop Session
2. Espera 10 segundos
3. Ctrl+Shift+P → Claude Code: Start Session
4. Continúa
```

**¿Cómo cancelo un cambio que hizo Claude Code?**
```
git status          # Ver cambios
git checkout file   # Deshacer archivo
git reset --hard    # Deshacer todo
```

**¿Los archivos no se guardan?**
```
VS Code Settings:
File → Preferences → Settings
Busca: "Auto Save"
Selecciona: "onFocusChange" o "afterDelay"
```

---

## 📚 REFERENCIAS

- [Next.js Docs](https://nextjs.org/docs)
- [Express Docs](https://expressjs.com/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Claude Code Guide](https://claude.ai/docs)
- [RBAC con JWT](https://jwt.io/introduction)

---

**¡Listo para empezar!** 🚀

Cualquier duda en cada paso, me preguntas.
