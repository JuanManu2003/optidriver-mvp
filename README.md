# OptiDriver / FuelSense Pro

App para conductores de Uber, DiDi y Cabify en Chile. Muestra en tiempo real el
consumo de combustible, hábitos de conducción y ahorro, leyendo datos del auto
mediante un sensor **ELM327 (OBD2)**.

---

## 🗺️ Mapa del proyecto (qué hay en cada carpeta)

Piensa en el proyecto como una casa con habitaciones ordenadas:

```
optidriver-mvp/
│
├── 📁 src/         ← TODO el código de la app (lo que ves en pantalla)
├── 📁 agent/       ← Programa que lee el sensor del auto y lo envía a la nube
├── 📁 supabase/    ← El "plano" de la base de datos (tablas)
├── 📁 docs/        ← Guías paso a paso (desplegar, conectar el sensor)
├── 📁 public/      ← Archivos sueltos que se copian tal cual al sitio
├── 📁 dist/        ← Se genera solo al compilar — NO se edita a mano
│
├── 📄 index.html       ← La página base donde viven todas las pantallas
├── 📄 package.json     ← Lista de "ingredientes" (librerías) y comandos
├── 📄 vite.config.js   ← Config de la herramienta que levanta la app
├── 📄 netlify.toml     ← Config para publicar la app en Netlify
├── 📄 .env.local       ← Tus claves secretas de Supabase (NO se comparte)
└── 📄 README.md        ← Este archivo
```

> Los archivos sueltos de la raíz (package.json, vite.config.js, etc.) **deben
> estar ahí** porque las herramientas los buscan en ese lugar. No se pueden mover
> a carpetas sin romper el proyecto.

---

## 📁 Dentro de `src/` (aquí pasarás la mayor parte del tiempo)

```
src/
├── 📁 views/       ← Una pantalla = un archivo (login, dashboard, etc.)
├── 📁 components/  ← Piezas reutilizables (botón, tarjeta, medidor...)
├── 📁 modules/     ← La "lógica" (conexión a Supabase, cálculos, datos)
├── 📁 data/        ← Listas fijas (ciudades de Chile, catálogo de autos)
├── 📁 styles/      ← Los colores y el diseño (CSS)
└── 📄 main.js      ← El punto de arranque que enciende todo
```

**Las pantallas (`src/views/`):**
| Archivo | Pantalla |
|---|---|
| `welcome.js` | Bienvenida |
| `register.js` / `login.js` | Crear cuenta / Iniciar sesión |
| `onboarding.js` | Perfil básico (ciudad, plataforma, horas) |
| `vehicleSetup.js` | Vehículo + conexión OBD2 |
| `dashboard.js` | Panel en vivo (velocidad, RPM, score) |
| `history.js` | Historial de viajes |
| `insights.js` | Análisis, proyecciones y exportar reporte |
| `profile.js` | Datos del conductor |

**La lógica clave (`src/modules/`):**
| Archivo | Para qué sirve |
|---|---|
| `supabase.js` | Conexión con la base de datos en la nube |
| `api.js` | Guardar/leer usuarios, vehículos y viajes |
| `telemetrySimulator.js` | Recibe la telemetría (del sensor o simulada) |
| `analytics.js` | Cálculos de consumo, score y ahorro |
| `report.js` | Genera y exporta el reporte (CSV / PDF) |
| `navigation.js` | Cambia entre pantallas |

---

## ▶️ Cómo correr la app en tu computador

1. Instala las librerías (solo la primera vez):
   ```bash
   npm install
   ```
2. Levanta la app:
   ```bash
   npm run dev
   ```
3. Abre **http://localhost:5173** en el navegador. Cada cambio que guardes en el
   código se ve al instante.

> Si editas en VS Code, abre la carpeta `optidriver-mvp` completa
> (Archivo → Abrir carpeta) y trabaja sobre todo dentro de `src/`.

---

## ☁️ Base de datos (Supabase)

La app guarda usuarios, vehículos y viajes en **Supabase** (base de datos en la
nube, ya configurada). El "plano" de las tablas está en
[`supabase/schema.sql`](supabase/schema.sql).

Tus claves van en `.env.local` (ya creado). Ese archivo es secreto y **no** se
sube a GitHub.

---

## 📡 Sensor del auto (ELM327 / OBD2)

La app web no puede leer el Bluetooth del sensor directamente, así que un pequeño
programa en la carpeta [`agent/`](agent/) lo lee y envía los datos a la nube.
Cómo probarlo (con y sin sensor real) está en [`docs/SENSOR.md`](docs/SENSOR.md).

---

## 🚀 Publicar la app para tu equipo

Pasos para subirla a internet con Netlify: [`docs/DEPLOY.md`](docs/DEPLOY.md).

---

## 🎨 Cambiar el diseño

Los colores están en [`src/styles/variables.css`](src/styles/variables.css).
El resto del diseño en [`src/styles/main.css`](src/styles/main.css).
