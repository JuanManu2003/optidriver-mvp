/**
 * server.js — Servidor principal OptiDriver.
 *
 * Expone:
 *   HTTP  → API REST en /api/*
 *   WS    → WebSocket en ws://localhost:3001/ws  (telemetría en tiempo real)
 *
 * Variables de entorno:
 *   PORT         → Puerto HTTP (default 3001)
 *   JWT_SECRET   → Secreto para firmar tokens
 *   ELM_PORT     → Puerto serie del ELM327 (default COM3)
 *   ELM_AUTO     → 'true' para intentar conectar ELM al arrancar
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { connectElm, getElmStatus, listPorts } from './elm/elmReader.js';

import authRoutes      from './routes/auth.js';
import vehicleRoutes   from './routes/vehicles.js';
import tripRoutes      from './routes/trips.js';
import insightRoutes   from './routes/insights.js';
import telemetryRoutes from './routes/telemetry.js';

// ─── App Express ──────────────────────────────────────────────────────────────
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// ─── Rutas REST ───────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/vehicles',  vehicleRoutes);
app.use('/api/trips',     tripRoutes);
app.use('/api/insights',  insightRoutes);
app.use('/api/telemetry', telemetryRoutes);

// Lista puertos disponibles (útil para diagnóstico ELM)
app.get('/api/elm/ports', async (_req, res) => {
  try {
    const ports = await listPorts();
    res.json({ ports, status: getElmStatus() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Intentar conectar ELM manualmente
app.post('/api/elm/connect', async (req, res) => {
  const portPath = req.body.port || process.env.ELM_PORT || 'COM3';
  try {
    await connectElm(portPath, (tick) => broadcastTelemetry(tick));
    res.json({ ok: true, port: portPath });
  } catch (err) {
    res.status(500).json({ error: err.message, hint: 'Verifica que el ELM327 esté conectado y el puerto sea correcto.' });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, elm: getElmStatus(), ts: new Date().toISOString() });
});

// ─── WebSocket ────────────────────────────────────────────────────────────────
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

const clients = new Set();

wss.on('connection', (ws, req) => {
  clients.add(ws);
  console.log(`[WS] Cliente conectado. Total: ${clients.size}`);

  // Enviar estado ELM al conectarse
  ws.send(JSON.stringify({ type: 'elm_status', data: getElmStatus() }));

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WS] Cliente desconectado. Total: ${clients.size}`);
  });

  ws.on('error', (err) => {
    console.error('[WS] Error de cliente:', err.message);
    clients.delete(ws);
  });
});

/**
 * Envía un tick de telemetría a todos los clientes WebSocket conectados.
 * Llamado tanto por el ELM real como por el simulador de fallback.
 */
export function broadcastTelemetry(tick) {
  const msg = JSON.stringify({ type: 'telemetry', data: tick });
  for (const client of clients) {
    if (client.readyState === 1) { // OPEN
      client.send(msg);
    }
  }
}

// ─── Simulador de fallback ────────────────────────────────────────────────────
// Si no hay ELM conectado, el servidor genera telemetría simulada para el frontend.

let simulatorInterval = null;
let simState = { speed: 52, rpm: 1850, fuel: 6.2, score: 86, mode: 'cruise', ticks: 0 };

function stepSimulator() {
  simState.ticks++;
  const roll = Math.random();

  if (simState.ticks % 6 === 0) {
    const modes = ['cruise', 'accel', 'brake', 'idle'];
    simState.mode = modes[Math.floor(Math.random() * modes.length)];
  }

  switch (simState.mode) {
    case 'accel': simState.speed = Math.min(95, simState.speed + 5 + Math.random() * 7); break;
    case 'brake': simState.speed = Math.max(0,  simState.speed - 8 + Math.random() * 4); break;
    case 'idle':  simState.speed = Math.max(0,  simState.speed - 3); break;
    default:      simState.speed += (roll - 0.5) * 5;
  }
  simState.speed = Math.max(0, Math.min(95, Math.round(simState.speed)));
  simState.rpm   = Math.round(800 + simState.speed * 45 + (roll - 0.5) * 200);
  simState.fuel  = +(5.8 + Math.abs(simState.rpm - 1900) / 1200).toFixed(1);
  simState.score = Math.min(98, Math.max(52, 88 - (simState.rpm > 3000 ? 14 : 0) - (simState.fuel > 8.5 ? 8 : 0)));

  return {
    speed:   simState.speed,
    rpm:     simState.rpm,
    fuel:    simState.fuel,
    score:   simState.score,
    mode:    simState.mode,
    throttle: Math.round(simState.speed / 95 * 60 + roll * 20),
    temp:    90 + Math.floor(roll * 10),
    ts:      Date.now(),
    source:  'simulator',
  };
}

export function startSimulator(intervalMs = 1000) {
  if (simulatorInterval) return;
  simulatorInterval = setInterval(() => {
    if (!getElmStatus().connected && clients.size > 0) {
      broadcastTelemetry(stepSimulator());
    }
  }, intervalMs);
  console.log('[SIM] Simulador de telemetría activo (fallback cuando no hay ELM)');
}

export function stopSimulator() {
  clearInterval(simulatorInterval);
  simulatorInterval = null;
}

// ─── Arranque ─────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 3001;

httpServer.listen(PORT, () => {
  console.log(`\n🚗 OptiDriver Backend corriendo en http://localhost:${PORT}`);
  console.log(`🔌 WebSocket disponible en ws://localhost:${PORT}/ws`);
  console.log(`📊 API REST en http://localhost:${PORT}/api\n`);

  startSimulator();

  // Intentar conectar ELM automáticamente si ELM_AUTO=true
  if (process.env.ELM_AUTO === 'true') {
    const elmPort = process.env.ELM_PORT || 'COM3';
    console.log(`[ELM] Intentando conectar automáticamente en ${elmPort}...`);
    connectElm(elmPort, (tick) => broadcastTelemetry(tick))
      .then(() => console.log('[ELM] ✅ ELM327 conectado exitosamente'))
      .catch((err) => console.warn(`[ELM] ⚠️  No se pudo conectar: ${err.message}\n    → El simulador seguirá activo como fallback.`));
  }
});

export default app;
