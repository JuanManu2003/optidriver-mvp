# OptiDriver / FuelSense Pro — MVP con ELM327/OBD2

App para conductores de Uber, DiDi y Cabify en Chile. Reduce gastos de combustible mediante telemetría real del vehículo (sensor ELM327/OBD2) con dashboard, historial e insights dinámicos.

---

## Arquitectura

```
optidriver-mvp/
├── backend/              ← Node.js + Express + SQLite + WebSocket
│   ├── server.js         ← Servidor principal (HTTP + WS)
│   ├── db.js             ← Base de datos SQLite
│   ├── middleware/auth.js ← JWT
│   ├── routes/           ← auth, vehicles, trips, insights, telemetry
│   └── elm/elmReader.js  ← Integración ELM327 vía puerto serie
└── src/                  ← Frontend Vite + JS vanilla
    ├── modules/api.js    ← Cliente HTTP + WebSocket
    ├── modules/elmClient.js ← ELM327 vía Web Serial API (browser)
    └── ...
```

---

## Requisitos

- Node.js 18+
- npm 9+
- (Opcional) Sensor ELM327 USB o Bluetooth conectado al puerto OBD2 del vehículo

---

## Instalación

### 1. Frontend
```bash
cd "C:\Optidriver MVP\optidriver-mvp"
npm install
```

### 2. Backend
```bash
cd "C:\Optidriver MVP\optidriver-mvp\backend"
npm install
```

---

## Ejecución en desarrollo

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
# → http://localhost:3001
# → ws://localhost:3001/ws
```

**Terminal 2 — Frontend:**
```bash
cd ..    # volver a la raíz del proyecto
npm run dev
# → http://localhost:5173
```

> El proxy de Vite redirige `/api/*` y `/ws` al backend automáticamente.

---

## Configuración ELM327

### Variables de entorno (backend/.env)
```bash
cp backend/.env.example backend/.env
```

```env
PORT=3001
JWT_SECRET=cambia_este_secreto

# ELM327 OBD2
ELM_PORT=COM3          # Windows: COM3 | Linux/Mac: /dev/ttyUSB0
ELM_BAUD=38400
ELM_POLL_MS=500
ELM_AUTO=false         # true = conectar ELM automáticamente al arrancar
```

### Conexión USB
1. Conecta el adaptador ELM327 al puerto OBD2 del vehículo (debajo del volante).
2. Conecta el USB al PC.
3. Windows: Device Manager → Ports → anota el COM (ej. COM3).
4. Linux/Mac: `ls /dev/ttyUSB*`
5. Configura `ELM_PORT` en el `.env`.

### Conexión Bluetooth
1. Parear el ELM327 BT en el sistema operativo.
2. Windows: crear puerto COM virtual en Bluetooth settings.
3. Linux: `rfcomm bind /dev/rfcomm0 <MAC> 1`
4. Usar ese puerto en `ELM_PORT`.

### Activar ELM desde la API
```bash
# Listar puertos disponibles
curl http://localhost:3001/api/elm/ports

# Conectar ELM en COM3
curl -X POST http://localhost:3001/api/elm/connect \
  -H "Content-Type: application/json" \
  -d '{"port":"COM3"}'
```

### ELM vía Web Serial API (navegador)
En Chrome/Edge 89+, la app puede conectarse directamente al ELM sin pasar por Node.js usando el módulo `src/modules/elmClient.js` y la Web Serial API.

---

## API REST

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/register` | Registro de usuario |
| POST | `/api/auth/login` | Login → JWT |
| GET | `/api/auth/me` | Perfil del usuario autenticado |
| GET | `/api/vehicles` | Vehículos del usuario |
| POST | `/api/vehicles` | Crear vehículo |
| PUT | `/api/vehicles/:id` | Editar vehículo |
| DELETE | `/api/vehicles/:id` | Eliminar vehículo |
| POST | `/api/trips/start` | Iniciar viaje |
| POST | `/api/trips/:id/end` | Finalizar viaje con resumen |
| GET | `/api/trips` | Historial de viajes |
| GET | `/api/trips/summary` | Resumen semanal |
| GET | `/api/insights` | Recomendaciones dinámicas |
| GET | `/api/telemetry/status` | Estado del sensor ELM |
| POST | `/api/telemetry/:tripId/tick` | Registrar tick de telemetría |
| GET | `/api/elm/ports` | Puertos serie disponibles |
| POST | `/api/elm/connect` | Conectar ELM327 |
| GET | `/api/health` | Estado del servidor |

### WebSocket — `ws://localhost:3001/ws`
Mensajes emitidos por el servidor:
```json
{ "type": "telemetry", "data": { "speed": 52, "rpm": 1850, "fuel": 6.2, "score": 86, "source": "elm327" } }
{ "type": "elm_status", "data": { "connected": true, "port": "COM3", "lastError": null } }
```

---

## Estructura del proyecto

```
src/
├── modules/
│   ├── api.js              ← Cliente HTTP + WebSocket al backend
│   ├── elmClient.js        ← ELM327 vía Web Serial API (browser)
│   ├── telemetrySimulator.js ← Dual: WebSocket + simulador local
│   ├── auth.js             ← Auth online (JWT) + fallback local
│   ├── analytics.js        ← Score, consumo, fórmulas
│   ├── sessionAnalytics.js ← Acumulador de sesión
│   ├── navigation.js       ← Router de pantallas
│   ├── storage.js          ← localStorage
│   ├── recommendations.js  ← Tips de conducción
│   ├── trips.js            ← Viajes mock (fallback)
│   ├── validation.js       ← Validadores de formularios
│   ├── vehicleCatalogUI.js ← UI selector de vehículo
│   ├── vehicleProfile.js   ← Perfil del vehículo
│   └── cityCatalogUI.js    ← UI selector de ciudad
├── views/
│   ├── welcome.js, login.js, register.js, onboarding.js
│   ├── dashboard.js        ← Telemetría en tiempo real + guardado de trips
│   ├── activeTrip.js       ← Resumen de sesión activa
│   ├── history.js          ← Historial desde backend
│   ├── insights.js         ← Recomendaciones desde backend
│   ├── profile.js, vehicleSetup.js
│   └── ...
├── components/
│   └── AlertBadge, BottomNav, Button, Card, Gauge, StatCard
├── data/
│   └── mockUser, mockVehicle, vehicleCatalog, chileCities, mockTrips
└── styles/
    └── main.css, variables.css, animations.css

backend/
├── server.js               ← Express + WebSocket + simulador fallback
├── db.js                   ← SQLite (users, vehicles, trips, telemetry)
├── middleware/auth.js       ← JWT
├── routes/
│   ├── auth.js, vehicles.js, trips.js, insights.js, telemetry.js
└── elm/
    └── elmReader.js         ← SerialPort + parseo OBD2 PIDs
```

---

## PIDs OBD2 leídos

| PID | Descripción | Fórmula |
|-----|-------------|---------|
| `010D` | Velocidad km/h | byte A |
| `010C` | RPM | ((A×256)+B)/4 |
| `0111` | Posición acelerador % | (A/255)×100 |
| `0105` | Temperatura motor °C | A−40 |
| `012F` | Nivel combustible % | (A/255)×100 |

---

## Flujo de datos

```
ELM327 sensor
    ↓ (SerialPort / USB / BT)
backend/elm/elmReader.js
    ↓ (callback por tick)
backend/server.js → broadcastTelemetry()
    ↓ (WebSocket ws://localhost:3001/ws)
src/modules/telemetrySimulator.js (onWsMessage)
    ↓ (onTick callback)
src/views/dashboard.js → actualiza UI
```

Si no hay ELM conectado, el backend genera telemetría simulada y la transmite por el mismo WebSocket. El frontend no distingue la fuente (el badge ELM muestra el estado).

---

## Modos de operación

| Modo | Fuente de datos | Cuándo |
|------|----------------|--------|
| ELM327 real | Sensor OBD2 vía USB/BT | `ELM_AUTO=true` o POST `/api/elm/connect` |
| Simulador backend | Algoritmo en Node.js | Sin ELM conectado, con backend activo |
| Simulador local | Algoritmo en navegador | Sin backend disponible |

---

## Build para producción

```bash
npm run build        # Genera dist/
npm run preview      # Sirve el build local
```

El backend se despliega como servidor Node.js independiente (Railway, Render, VPS).
