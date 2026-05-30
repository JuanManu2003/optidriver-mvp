# Guía de despliegue — OptiDriver

Arquitectura desplegada:
- **Frontend** (Vite) → **Vercel** (estático, gratis)
- **Backend** (Node + WebSocket + SQLite) → **Render** (servicio web, gratis)

Tu equipo accederá a una URL permanente tipo `https://optidriver.vercel.app`.

---

## Paso 0 — Subir el código a GitHub

Ya dejé el repositorio inicializado con un commit. Solo falta enviarlo a GitHub:

1. Crea un repositorio vacío en https://github.com/new (ej. `optidriver-mvp`). **No** marques "Add README".
2. En la carpeta del proyecto, conecta y sube:
   ```bash
   git remote add origin https://github.com/TU-USUARIO/optidriver-mvp.git
   git branch -M main
   git push -u origin main
   ```

---

## Paso 1 — Backend en Render

1. Crea una cuenta en https://render.com (puedes entrar con tu GitHub).
2. **New +** → **Blueprint** → selecciona tu repositorio.
   - Render detecta `backend/render.yaml` automáticamente.
   - Si prefieres manual: **New +** → **Web Service** →
     - Root Directory: `backend`
     - Build Command: `npm install`
     - Start Command: `npm start`
3. Deja que despliegue. Al terminar copia la URL, ej.:
   ```
   https://optidriver-backend.onrender.com
   ```
4. Verifica que responde abriendo `https://optidriver-backend.onrender.com/api/health`

> **Nota plan free:** el servicio "duerme" tras 15 min sin uso (primer acceso tarda ~30 s) y la base SQLite se reinicia en cada deploy. Para datos permanentes, añade un disco (ya está descrito en `render.yaml`, requiere plan de pago) o migra a Postgres.

---

## Paso 2 — Frontend en Vercel

1. Crea una cuenta en https://vercel.com (entra con GitHub).
2. **Add New** → **Project** → importa tu repositorio.
   - Framework: **Vite** (se detecta solo).
   - Build Command: `npm run build` · Output: `dist` (automático).
3. **IMPORTANTE** — antes de desplegar, en **Environment Variables** agrega:
   | Name | Value |
   |------|-------|
   | `VITE_API_URL` | `https://optidriver-backend.onrender.com` *(la URL del paso 1, sin `/` final)* |
4. **Deploy**. Al terminar tendrás la URL pública, ej. `https://optidriver-mvp.vercel.app`.

---

## Paso 3 — Compartir con tu equipo

Envía la URL de Vercel a tu equipo. Cada integrante:
- Abre la URL en su navegador (PC o móvil).
- Crea su propia cuenta (el registro va al backend en Render).
- Ve la telemetría en vivo (simulada, o real si hay un ELM327 conectado al backend).

Cada vez que hagas `git push`, Vercel y Render **redepliegan automáticamente** — tu equipo siempre verá la última versión.

---

## Resumen de variables de entorno

**Frontend (Vercel):**
- `VITE_API_URL` = URL del backend en Render

**Backend (Render):**
- `JWT_SECRET` = secreto para firmar tokens (Render lo genera con `render.yaml`)
- `ELM_PORT`, `ELM_AUTO` = solo si conectas un ELM327 físico al servidor

---

## Alternativas

- **Backend en Railway** (https://railway.app): soporta volúmenes persistentes en plan free; mismo `npm start`.
- **Frontend en Netlify**: Build `npm run build`, publish `dist`, misma variable `VITE_API_URL`.
