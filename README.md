# 🫀 GranCanaria RCP Academy

Plataforma de formación en RCP (reanimación cardiopulmonar).
**Fase 1: Infraestructura y autenticación.**

- **Frontend:** Next.js 14 (App Router, TypeScript) → http://localhost:3000
- **Backend:** Express + TypeScript → http://localhost:5000
- **Base de datos:** PostgreSQL

Roles: `super_admin` (Federico) · `institution_admin` · `student`.

> **Despliegue a producción** (`campus.grancanariarcp.es`): ver [DEPLOY.md](DEPLOY.md).

---

## 🚀 Puesta en marcha (local)

Requisitos: Node.js 18+, y **Docker** (para PostgreSQL) o un PostgreSQL propio.

### 1. Levantar PostgreSQL

**En este equipo ya hay un PostgreSQL portable instalado** en
`C:\Users\lubbe\PostgresRCP` (sin necesidad de administrador). Para arrancarlo
o pararlo:

```powershell
# Arrancar (tras reiniciar el PC hay que volver a lanzarlo)
powershell -ExecutionPolicy Bypass -File scripts\db-local-start.ps1

# Parar
powershell -ExecutionPolicy Bypass -File scripts\db-local-stop.ps1
```

> Alternativas: `docker compose up -d` (si instalas Docker), o un PostgreSQL
> propio creando la base `grancanaria_rcp` (usuario `rcp_admin`, contraseña
> `rcp_password`) y ajustando `DATABASE_URL` en `backend/.env`.

### 2. Backend

```powershell
cd backend
npm install
copy .env.example .env      # revisa/ajusta valores
npm run db:setup            # crea el schema y siembra datos de prueba
npm run dev                 # arranca en http://localhost:5000
```

### 3. Frontend (en otra terminal)

```powershell
cd frontend
npm install
npm run dev                 # arranca en http://localhost:3000
```

Abre **http://localhost:3000**.

---

## 🔑 Credenciales de prueba (creadas por el seed)

| Rol | Acceso | Credenciales |
|-----|--------|--------------|
| **Super Admin (Federico)** | `/login/admin` | `grancanariarcp@gmail.com` / `Admin123!RCP` |
| Admin institución | `/login/admin` | `admin.centro@ies-gc.example` / `Instituto123!` |
| Alumno (email) | `/login/student` → Email | `alumno@demo.example` / `Alumno123!` |
| Alumno (código) | `/login/student` → Código | `RCP-DEMO-2026` |
| Alumno (registro) | `/login/student` → Registro | usa el código de institución `IES-GC-01` |

> ⚠️ Cambia la contraseña del Super Admin tras el primer acceso en producción.

---

## 🧩 Endpoints principales (backend)

```
GET  /api/health                     Estado del servicio

POST /api/auth/admin/login           Login super_admin / institution_admin
POST /api/auth/student/register      Alumno · método 1 (registro email+pass)
POST /api/auth/student/login-email   Alumno · método 2 (email+pass)
POST /api/auth/student/login-code    Alumno · método 3 (código de acceso)
POST /api/auth/logout                Cierre de sesión (auditado)
GET  /api/auth/me                    Identidad del token

GET  /api/admin/stats                KPIs globales           (super_admin)
GET  /api/admin/institutions         Listar instituciones    (super_admin)
POST /api/admin/institutions         Crear institución       (super_admin)
GET  /api/admin/admins               Listar administradores  (super_admin)
POST /api/admin/admins               Crear admin institución (super_admin)
POST /api/admin/questions            Crear pregunta          (super_admin)
GET  /api/admin/audit-logs           Logs de auditoría       (super_admin)

GET  /api/student/dashboard          Progreso del alumno     (student)
```

---

## 🔐 Seguridad y RGPD (Fase 1)

- Contraseñas con **bcrypt** (coste 12).
- **JWT** con expiración configurable; middlewares `requireAuth` + `requireRole`.
- **Rate limiting** global y reforzado en los endpoints de autenticación.
- **AES-256-GCM** disponible para datos sensibles recuperables.
- **Hash de identidad irreversible** (HMAC-SHA256) para menores: permite evitar
  duplicados sin poder reconstruir la identidad del menor.
- **Audit logs** para logins, creación de instituciones/admins/preguntas, etc.
- `helmet` + CORS restringido al origen del frontend.

---

## 📁 Estructura

```
ProyectoRCP/
├─ backend/
│  ├─ src/
│  │  ├─ config/        env.ts, database.ts
│  │  ├─ controllers/   auth, admin, student
│  │  ├─ db/            schema.sql, setup.ts, seed.ts
│  │  ├─ middleware/    auth, role, rateLimiter, errorHandler
│  │  ├─ routes/        auth, admin, student
│  │  ├─ services/      audit.ts
│  │  ├─ utils/         crypto, jwt, httpError, asyncHandler
│  │  └─ index.ts
│  └─ .env.example
├─ frontend/
│  ├─ app/              page, login/(admin|student), admin, student
│  ├─ components/       AppShell
│  ├─ hooks/            useSession
│  └─ lib/              api.ts, auth.ts
├─ docker-compose.yml   PostgreSQL local
└─ references/          documentación de diseño y arranque
```

---

## 🧪 Comandos útiles

```powershell
# Reiniciar la base de datos desde cero (borra y vuelve a sembrar)
cd backend; npm run db:reset

# Sólo volver a sembrar datos de prueba
cd backend; npm run db:seed

# Comprobar el backend
curl http://localhost:5000/api/health
```
