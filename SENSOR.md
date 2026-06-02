# Conectar el sensor ELM327 y probar la telemetría

La app web no puede leer el Bluetooth/USB del sensor directamente. Por eso hay un
**agente** (`agent/`) que corre en el dispositivo conectado al ELM327, lee los datos
OBD2 y los publica en **Supabase Realtime**. La app web los muestra en vivo.

```
Auto → ELM327 (Bluetooth/USB) → agente Node → Supabase Realtime → app web (dashboard)
```

---

## A. Preparar el agente

```bash
cd agent
npm install
copy .env.example .env      # (Windows)  ·  cp .env.example .env  (Mac/Linux)
```

Edita `agent/.env` con tus credenciales de Supabase (las mismas del frontend):
```env
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_ANON_KEY=tu_clave_anon
```

---

## B. PRUEBA 1 — Sin hardware (recomendada primero)

Verifica todo el flujo (agente → Supabase → app) usando telemetría simulada:

```bash
cd agent
npm run sim
```

Verás `✅ Conectado a Supabase Realtime` y el agente empezará a publicar.
Ahora abre la app web (Netlify o `npm run dev`), entra al **dashboard** y deberías
ver velocidad, RPM y score **actualizándose en vivo** desde el agente.

> Si esto funciona, el problema (cuando uses el sensor real) será solo de
> conexión con el ELM327, no de la app.

---

## C. PRUEBA 2 — Con el ELM327 real

### 1. Conectar el sensor físicamente
- Enchufa el ELM327 al puerto **OBD2** del auto (bajo el volante).
- Pon el contacto del vehículo en **ON** (o el motor encendido).

### 2. Emparejar el adaptador

**Bluetooth (Windows):**
1. Ajustes → Bluetooth → emparejar "OBDII" (PIN suele ser `1234` o `0000`).
2. Ajustes → Más opciones Bluetooth → pestaña **COM**: anota el puerto
   "saliente", ej. `COM5`.

**Bluetooth (Linux):**
```bash
sudo rfcomm bind /dev/rfcomm0 <MAC_DEL_ELM> 1
```

**USB:** conéctalo y mira el puerto:
- Windows: Administrador de dispositivos → Puertos (COM y LPT) → ej. `COM3`
- Linux/Mac: `ls /dev/ttyUSB*` o `ls /dev/cu.*`

### 3. Configurar el puerto en `agent/.env`
```env
ELM_PORT=COM5          # el puerto que anotaste
ELM_BAUD=38400         # algunos adaptadores usan 9600 o 115200
```

### 4. Instalar el driver serie y arrancar
```bash
cd agent
npm install serialport @serialport/parser-readline
npm start
```

Deberías ver:
```
🔌 Puerto COM5 abierto. Inicializando ELM327...
🟢 ELM327 listo — leyendo OBD2 en vivo.
```

Abre el dashboard de la app: ahora los datos son **reales del vehículo**.

---

## Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `Cannot open COMx` | Puerto equivocado u ocupado | Verifica el COM; cierra otras apps OBD |
| Conecta pero `NO DATA` | Contacto apagado / PID no soportado | Enciende el contacto; algunos autos no exponen todos los PIDs |
| No abre el puerto BT | Mal emparejado | Re-emparejar; usar el COM "saliente" |
| `serialport` no instala | Falta compilador C++ | En Windows instala "Desktop development with C++" (Build Tools) |
| La app no muestra datos | App y agente usan proyectos Supabase distintos | Verifica que ambos usen la **misma** SUPABASE_URL |

> Recomendación: ejecuta primero `npm run sim`. Si la app recibe datos simulados,
> la cadena app↔Supabase está bien y solo resta la conexión física al ELM327.
