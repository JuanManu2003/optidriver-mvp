# Guía de despliegue — OptiDriver (Supabase + Netlify)

Arquitectura:
- **Frontend** (Vite, estático) → **Netlify** (URL permanente, gratis)
- **Auth + Base de datos + Realtime** → **Supabase** (gratis, datos permanentes)
- **Sensor ELM327** → **agente local** (`agent/`) que publica en Supabase Realtime

No necesitas hospedar ningún servidor propio. El sensor requiere un pequeño
programa corriendo en el dispositivo conectado al ELM327 (eso no se puede evitar:
ningún servicio en la nube puede leer un puerto Bluetooth/USB).

---

## Paso 1 — Supabase (¡ya está creado!)

> El proyecto Supabase ya existe y las tablas ya fueron creadas. Solo te queda
> el punto 3 (desactivar confirmación de email). Los pasos 1–2 se documentan por
> si algún día necesitas recrearlo desde cero.

1. (Ya hecho) Proyecto creado en https://supabase.com.
2. (Ya hecho) Tablas creadas ejecutando [`../supabase/schema.sql`](../supabase/schema.sql)
   en **SQL Editor** — crea `profiles`, `vehicles`, `trips`, la seguridad por
   usuario (RLS) y el perfil automático.
3. **PENDIENTE:** ve a **Authentication → Sign In / Providers → Email** y
   **desactiva "Confirm email"** (para que tu equipo entre sin confirmar correo).
3. Ve a **Authentication → Providers → Email** y **desactiva "Confirm email"**
   (para que tu equipo pueda entrar sin confirmar correo en el MVP).
4. Ve a **Project Settings → API** y copia:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`

---

## Paso 2 — Subir el código a GitHub

```bash
git remote add origin https://github.com/TU-USUARIO/optidriver-mvp.git
git branch -M main
git push -u origin main
```

---

## Paso 3 — Desplegar el frontend en Netlify

1. Crea cuenta en https://netlify.com (entra con GitHub).
2. **Add new site → Import an existing project** → elige tu repo.
   - Build command: `npm run build` · Publish directory: `dist` (lo detecta por `netlify.toml`).
3. En **Site settings → Environment variables**, agrega:
   | Key | Value |
   |-----|-------|
   | `VITE_SUPABASE_URL` | tu Project URL |
   | `VITE_SUPABASE_ANON_KEY` | tu anon public key |
4. **Deploy**. Obtendrás la URL pública, ej. `https://optidriver.netlify.app`.

> Cada `git push` redespliega automáticamente. Comparte esa URL con tu equipo:
> cada integrante crea su cuenta y ve sus propios datos (RLS los aísla).

---

## Paso 4 — (Opcional) Datos del sensor en vivo

Mira [`SENSOR.md`](SENSOR.md) para conectar el ELM327 y probar la telemetría real.

---

## Modo local (desarrollo)

Sin variables de Supabase, la app corre con simulador + localStorage:
```bash
npm install
npm run dev      # http://localhost:5173
```
Para desarrollar contra Supabase, crea `.env.local` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
