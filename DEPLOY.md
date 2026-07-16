# 🚀 Despliegue — GranCanaria RCP Academy

Guía para publicar la plataforma en **campus.grancanariarcp.es**, dejando
`www.grancanariarcp.es` como sitio principal intacto.

## Arquitectura (hosting gestionado, gratis para empezar)

```
Usuario
  │
  ├─ https://campus.grancanariarcp.es  ─►  Frontend (Next.js)   →  Vercel
  │                                              │ fetch
  └─ https://api.grancanariarcp.es     ─►  Backend (Express)    →  Render
                                                 │ SQL
                                          PostgreSQL             →  Neon
```

- **DNS** se gestiona en **Hostinger** (dos registros CNAME nuevos).
- `www` y la raíz del dominio **no se tocan**.

---

## 0. Requisitos previos

1. Sube el proyecto a un repositorio de **GitHub** (privado vale).
   ```powershell
   cd C:\ProyectoRCP
   git add .
   git commit -m "feat: fase 1 completa (auth + infra) + configuracion de despliegue"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/GranCanariaRCP_Academy.git
   git push -u origin main
   ```
2. Cuentas (todas con login por GitHub): [Neon](https://neon.tech),
   [Render](https://render.com), [Vercel](https://vercel.com).
3. Acceso al panel de **Hostinger** para editar la zona DNS de `grancanariarcp.es`.

---

## 1. Base de datos — Neon (PostgreSQL gestionado)

1. Entra en Neon → **Create project** → nombre `grancanaria-rcp`, región **EU (Frankfurt)**.
2. Base de datos: `grancanaria_rcp`.
3. Copia la **connection string** (usa la variante *Pooled connection*). Se parece a:
   ```
   postgresql://user:pass@ep-xxxx-pooler.eu-central-1.aws.neon.tech/grancanaria_rcp?sslmode=require
   ```
   Guárdala: es tu `DATABASE_URL` de producción.

> Reemplaza a ElephantSQL (que cerró en 2025). Neon tiene plan gratuito y SSL.

---

## 2. Backend — Render (API Express)

1. Genera los secretos (guárdalos, los pegas en Render):
   ```powershell
   node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(48).toString('hex'))"
   node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
   ```
2. En Render → **New + → Blueprint** → conecta el repo. Render leerá
   [`render.yaml`](render.yaml) y creará el servicio `grancanaria-rcp-api`.
3. Cuando pida las variables marcadas como *secret*, rellena:
   - `DATABASE_URL` → la de Neon (paso 1)
   - `ENCRYPTION_KEY` → la generada
   - `SUPERADMIN_PASSWORD` → una contraseña fuerte (cámbiala respecto a la de prueba)
   - (`JWT_SECRET` se genera solo; puedes sustituirlo por el tuyo)
4. Deploy. Cuando termine, tendrás una URL tipo `https://grancanaria-rcp-api.onrender.com`.
5. **Crea el schema y siembra los datos (una sola vez):** en Render, abre el
   servicio → pestaña **Shell** y ejecuta:
   ```bash
   npm run db:setup:prod
   ```
   Debe imprimir `super admin ready`, las instituciones y `seeding complete ✅`.
6. Comprueba: abre `https://grancanaria-rcp-api.onrender.com/api/health` → `{"status":"ok",...}`.

> Nota: el plan free de Render “duerme” tras inactividad; la primera petición
> tras un rato tarda unos segundos. Suficiente para empezar.

---

## 3. Frontend — Vercel (Next.js)

1. Vercel → **Add New → Project** → importa el repo.
2. **Root Directory:** `frontend`. Framework: *Next.js* (autodetectado).
3. En **Environment Variables** añade:
   ```
   NEXT_PUBLIC_API_URL = https://api.grancanariarcp.es
   ```
   (todavía no existe ese subdominio; lo creamos en el paso 4, pero ya lo dejamos configurado).
4. Deploy. Obtendrás una URL tipo `https://grancanaria-rcp-academy.vercel.app`.

---

## 4. Subdominios y DNS (Hostinger)

### 4a. Añadir los dominios personalizados en cada plataforma
- **Vercel** → proyecto → *Settings → Domains* → añade `campus.grancanariarcp.es`.
  Vercel te indicará un CNAME destino (normalmente `cname.vercel-dns.com`).
- **Render** → servicio → *Settings → Custom Domains* → añade `api.grancanariarcp.es`.
  Render te dará un CNAME destino (`grancanaria-rcp-api.onrender.com`).

### 4b. Crear los registros en Hostinger
Panel de Hostinger → *Dominios → grancanariarcp.es → DNS / Nameservers → Registros DNS*.
Añade **dos CNAME** (deja `www` y `@` como están):

| Tipo  | Nombre (host) | Apunta a (destino que te dio la plataforma) | TTL   |
|-------|---------------|----------------------------------------------|-------|
| CNAME | `campus`      | `cname.vercel-dns.com`                        | 3600  |
| CNAME | `api`         | `grancanaria-rcp-api.onrender.com`            | 3600  |

> Usa exactamente el destino que muestre Vercel/Render (pueden variar).
> La propagación DNS y la emisión del certificado HTTPS tardan de minutos a ~1 hora.

---

## 5. Cerrar el círculo (CORS)

Ya está configurado, pero verifica que en **Render** la variable
`CORS_ORIGIN` = `https://campus.grancanariarcp.es`. Si cambias el subdominio,
actualiza esta variable y vuelve a desplegar.

---

## 6. Verificación final

1. `https://api.grancanariarcp.es/api/health` → `{"status":"ok"}`
2. Abre `https://campus.grancanariarcp.es`
3. Entra como **Super Admin**: `grancanariarcp@gmail.com` / (tu contraseña de producción).
4. Prueba el acceso de alumno con el código `RCP-DEMO-2026`.

---

## 7. Seguridad post-despliegue (importante)

- ✅ **Cambia** la contraseña del super admin respecto a la de prueba (`Admin123!RCP`).
- ✅ Borra o desactiva los usuarios/instituciones **demo** cuando tengas datos reales.
- ✅ Nunca subas `.env` / `.env.local` al repo (ya están en `.gitignore`).
- ✅ Guarda `JWT_SECRET`, `ENCRYPTION_KEY` y `DATABASE_URL` en un gestor de contraseñas.

---

## Resumen de "qué va dónde"

| Componente | Plataforma | URL pública | Variables clave |
|------------|-----------|-------------|-----------------|
| Frontend   | Vercel    | `campus.grancanariarcp.es` | `NEXT_PUBLIC_API_URL` |
| Backend    | Render    | `api.grancanariarcp.es`    | `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, `CORS_ORIGIN` |
| Base datos | Neon      | (privada)                  | — |
| DNS        | Hostinger | 2× CNAME (`campus`, `api`) | — |
