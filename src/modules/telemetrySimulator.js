/**
 * telemetrySimulator.js — Motor de telemetría con soporte dual:
 *   1. Backend WebSocket (datos reales ELM327 o simulados por el servidor)
 *   2. Simulación local en el navegador (fallback si no hay backend)
 *
 * El frontend siempre consume el mismo callback onTick(telemetry, events).
 */

import {
  computeScore,
  scoreLabel,
  rpmFromSpeed,
  fuelPer100FromTelemetry,
  estimateMoneyDelta,
  formatCLP,
  formatFuel,
} from './analytics.js';
import { connectWS, onWsMessage } from './api.js';

// ─── Estado de sesión ─────────────────────────────────────────────────────────
let state = {
  speed: 52, rpm: 1850, fuelPer100: 6.2,
  tripCostClp: 2450, score: 86, mode: 'cruise',
  modeTicks: 0, gearHint: 3,
  sessionLossClp: 0, sessionSavingsClp: 0,
  source: 'local',
};

let localIntervalId = null;
let toastTimer      = null;
let onTickCallback  = null;
let usingBackend    = false;
let paused          = false;
let lastGpsSpeed    = null;

// ─── Simulación local (fallback) ──────────────────────────────────────────────

const DRIVING_MODES = ['cruise', 'accel', 'brake', 'idle', 'stop_go'];

function pickNextMode() {
  const roll = Math.random();
  if (state.speed < 8) return roll < 0.5 ? 'idle' : 'accel';
  if (state.mode === 'idle') return roll < 0.6 ? 'accel' : 'stop_go';
  if (state.mode === 'accel') return roll < 0.35 ? 'cruise' : roll < 0.6 ? 'brake' : 'accel';
  if (state.mode === 'brake') return roll < 0.5 ? 'cruise' : 'stop_go';
  if (roll < 0.12) return 'idle';
  if (roll < 0.28) return 'accel';
  if (roll < 0.38) return 'brake';
  if (roll < 0.55) return 'stop_go';
  return 'cruise';
}

function stepPhysics() {
  let harshAccel = false;
  let harshBrake = false;
  const prevSpeed = state.speed;

  state.modeTicks += 1;
  if (state.modeTicks > 4 + Math.floor(Math.random() * 5)) {
    state.mode = pickNextMode();
    state.modeTicks = 0;
    state.gearHint = 2 + Math.floor(Math.random() * 3);
  }

  switch (state.mode) {
    case 'idle':   state.speed = Math.max(0, state.speed - 4 - Math.random() * 3); break;
    case 'accel':  state.speed += 6 + Math.random() * 8; if (state.speed - prevSpeed > 10) harshAccel = true; break;
    case 'brake':  state.speed -= 7 + Math.random() * 9; if (prevSpeed - state.speed > 12) harshBrake = true; break;
    case 'stop_go': state.speed += (Math.random() - 0.4) * 14; break;
    default:       state.speed += (Math.random() - 0.5) * 6;
  }

  state.speed = Math.max(0, Math.min(95, Math.round(state.speed)));
  const isIdle = state.speed <= 3;
  state.rpm = rpmFromSpeed(state.speed, state.gearHint);
  if (harshAccel) state.rpm = Math.min(4200, state.rpm + 400);
  if (isIdle) state.rpm = 720 + Math.floor(Math.random() * 120);

  state.fuelPer100 = fuelPer100FromTelemetry({ speed: state.speed, rpm: state.rpm, isIdle, harshAccel, harshBrake });
  state.score = computeScore({ speed: state.speed, rpm: state.rpm, fuelPer100: state.fuelPer100, isIdle, harshAccel, harshBrake });

  const money = estimateMoneyDelta({ fuelPer100: state.fuelPer100, speed: Math.max(state.speed, isIdle ? 0 : 5), dtSec: 1.5 });
  if (money.clp > 0) {
    state.sessionLossClp += money.clp;
    state.tripCostClp += money.clp;
  } else {
    state.sessionSavingsClp += Math.abs(money.clp);
    state.tripCostClp = Math.max(1200, state.tripCostClp + money.clp);
  }

  state.source = 'local';
  return { harshAccel, harshBrake, isIdle, money };
}

// ─── Procesamiento de tick (origen WS o local) ────────────────────────────────

function processBackendTick(data) {
  if (paused) return;
  const isIdle = data.speed <= 3;

  // Calcular métricas derivadas si no vienen del backend
  const fuelPer100 = data.fuel ?? fuelPer100FromTelemetry({ speed: data.speed, rpm: data.rpm, isIdle, harshAccel: false, harshBrake: false });
  const score      = data.score ?? computeScore({ speed: data.speed, rpm: data.rpm, fuelPer100, isIdle, harshAccel: false, harshBrake: false });
  const money      = estimateMoneyDelta({ fuelPer100, speed: Math.max(data.speed, 1), dtSec: 1.0 });

  state.speed      = data.speed;
  state.rpm        = data.rpm;
  state.fuelPer100 = fuelPer100;
  state.score      = score;
  state.mode       = data.mode || 'cruise';
  state.source     = data.source || 'backend';

  if (money.clp > 0) {
    state.sessionLossClp += money.clp;
    state.tripCostClp += money.clp;
  } else {
    state.sessionSavingsClp += Math.abs(money.clp);
    state.tripCostClp = Math.max(1200, state.tripCostClp + money.clp);
  }

  // Indicador visual: muestra la fuente real de los datos en vivo.
  const badge = document.getElementById('elmStatusBadge');
  if (badge) {
    badge.textContent = data.source === 'elm327' ? 'Sensor ELM en vivo' : 'Datos en vivo';
  }

  const events = { harshAccel: false, harshBrake: false, isIdle, money };
  if (onTickCallback) onTickCallback(getState(), events);
  emitEvents(events);
}

// ─── Telemetría desde GPS (modo Waze, sin hardware) ────────────────────────────
//
// Recibe la velocidad real del GPS del teléfono y deriva el resto (RPM y consumo
// estimados, score, eventos de frenada/aceleración brusca) reutilizando analytics.

export function ingestGpsTick({ speedKmh, dtSec = 1 }) {
  if (paused) return;
  usingBackend = true; // desactiva el simulador local

  const speed = Math.max(0, Math.round(speedKmh || 0));
  const prev = lastGpsSpeed == null ? speed : lastGpsSpeed;
  lastGpsSpeed = speed;

  // Aceleración en km/h por segundo → detectar maniobras bruscas
  const accel = (speed - prev) / Math.max(dtSec, 0.3);
  const harshAccel = accel > 9;    // acelerón fuerte
  const harshBrake = accel < -11;  // frenada fuerte
  const isIdle = speed <= 3;

  const rpm = isIdle ? 800 + Math.floor(Math.random() * 80) : rpmFromSpeed(speed, 3);
  const fuelPer100 = fuelPer100FromTelemetry({ speed, rpm, isIdle, harshAccel, harshBrake });
  const score = computeScore({ speed, rpm, fuelPer100, isIdle, harshAccel, harshBrake });
  const money = estimateMoneyDelta({ fuelPer100, speed: Math.max(speed, isIdle ? 0 : 5), dtSec });

  state.speed = speed;
  state.rpm = rpm;
  state.fuelPer100 = fuelPer100;
  state.score = score;
  state.mode = harshBrake ? 'brake' : harshAccel ? 'accel' : isIdle ? 'idle' : 'cruise';
  state.source = 'gps';

  if (money.clp > 0) {
    state.sessionLossClp += money.clp;
    state.tripCostClp += money.clp;
  } else {
    state.sessionSavingsClp += Math.abs(money.clp);
    state.tripCostClp = Math.max(1200, state.tripCostClp + money.clp);
  }

  const badge = document.getElementById('elmStatusBadge');
  if (badge) badge.textContent = 'GPS en vivo';

  const events = { harshAccel, harshBrake, isIdle, money };
  if (onTickCallback) onTickCallback(getState(), events);
  emitEvents(events);
}

export function resetGps() {
  lastGpsSpeed = null;
}

/**
 * Activa/desactiva una fuente de datos en vivo (GPS o realtime).
 * Al activarla, el simulador local deja de emitir de inmediato y los
 * indicadores se ponen en 0 hasta que llegue la primera lectura real.
 */
export function setLiveSource(on) {
  usingBackend = Boolean(on);
  if (on) {
    lastGpsSpeed = null;
    state.speed = 0;
    state.rpm = 800;
    state.fuelPer100 = 0;
    state.score = 0;
    state.mode = 'idle';
    state.source = 'gps';
    if (onTickCallback) {
      onTickCallback(getState(), { harshAccel: false, harshBrake: false, isIdle: true, money: { clp: 0 } });
    }
  }
}

// ─── Toast & eventos ──────────────────────────────────────────────────────────

export function showToast(title, text) {
  const toast = document.getElementById('toast');
  const titleEl = document.getElementById('toastTitle');
  const textEl = document.getElementById('toastText');
  if (!toast || !titleEl || !textEl) return;
  titleEl.textContent = title;
  textEl.textContent = text;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

export function addEvent(type, title, detail) {
  const list = document.getElementById('eventList');
  if (!list) return;
  const iconClass = type === 'danger' ? 'danger' : type === 'warning' ? 'warning' : 'good';
  const icon = type === 'good' ? '✓' : '!';
  const div = document.createElement('div');
  div.className = 'event';
  div.innerHTML = `
    <div class="event-icon ${iconClass}">${icon}</div>
    <div><strong>${title}</strong><p class="small">${detail}</p></div>
  `;
  list.prepend(div);
  while (list.children.length > 5) list.removeChild(list.lastElementChild);
}

function emitEvents({ harshAccel, harshBrake, isIdle, money }) {
  if (harshBrake) {
    const loss = Math.max(35, Math.round((money?.clp ?? 45) * 3));
    addEvent('danger', 'Frenada brusca detectada', `Reduce velocidad gradualmente · ~$${formatCLP(loss)} CLP`);
    showToast('Frenada brusca', 'Anticipa el tráfico para ahorrar combustible.');
    return;
  }
  if (harshAccel) {
    const loss = Math.max(30, Math.round((money?.clp ?? 40) * 2.5));
    addEvent('warning', 'Aceleración brusca', `Sube de marcha suave · ~$${formatCLP(loss)} CLP`);
    showToast('Aceleración brusca', 'Progresión suave mejora tu margen por viaje.');
    return;
  }
  if (state.rpm > 3000 && state.speed > 25) {
    addEvent('warning', 'RPM elevadas', `Óptimo 1.500–2.500 · ~$${formatCLP(35)} CLP`);
    showToast('RPM elevadas', 'Mantén revoluciones en zona eficiente.');
    return;
  }
  if (isIdle && state.modeTicks > 2) {
    addEvent('warning', 'Ralentí prolongado', `Motor encendido sin avanzar · ~$${formatCLP(28)} CLP`);
    return;
  }
  if (state.score >= 88 && state.speed >= 40 && state.speed <= 68 && Math.random() > 0.55) {
    addEvent('good', 'Conducción eficiente', 'Velocidad y RPM en rango óptimo.');
  }
}

function localTick() {
  if (paused) return;
  if (usingBackend) return; // El backend ya envía ticks vía WebSocket
  const events = stepPhysics();
  if (onTickCallback) onTickCallback(getState(), events);
  emitEvents(events);
}

// ─── API pública ──────────────────────────────────────────────────────────────

export function getState() {
  return { ...state };
}

export function onTick(cb) {
  onTickCallback = cb;
}

/**
 * Inicia la telemetría.
 * 1. Intenta conectar al WebSocket del backend.
 * 2. Si no hay backend, arranca el simulador local.
 */
export function start(intervalMs = 1500) {
  // Intento de conexión al backend (silencioso, sin bloquear UI)
  try {
    connectWS();
    onWsMessage('telemetry', (data) => {
      usingBackend = true;
      const active = document.querySelector('.screen.active');
      if (active?.id === 'dashboard') processBackendTick(data);
    });
    onWsMessage('elm_status', (data) => {
      const badge = document.getElementById('elmStatusBadge');
      if (badge) {
        badge.textContent = data.connected ? '🟢 ELM Conectado' : '🟡 Simulador';
        badge.title = data.connected ? `Puerto: ${data.port}` : 'Sin sensor ELM. Usando simulador.';
      }
    });
  } catch { /* WS no disponible, continuar con simulador local */ }

  // Simulador local como fallback (siempre activo pero sólo emite si !usingBackend)
  if (!localIntervalId) {
    localIntervalId = setInterval(() => {
      const active = document.querySelector('.screen.active');
      if (active?.id === 'dashboard') localTick();
    }, intervalMs);
  }
}

export function stop() {
  if (localIntervalId) {
    clearInterval(localIntervalId);
    localIntervalId = null;
  }
}

export function pauseTelemetry() {
  paused = true;
}

export function resumeTelemetry() {
  paused = false;
}

export function isPaused() {
  return paused;
}

export function resetTripCost() {
  state.tripCostClp = 1800;
  state.sessionLossClp = 0;
  state.sessionSavingsClp = 0;
}

export function getSessionMoney() {
  return {
    lossClp:     Math.round(state.sessionLossClp),
    savingsClp:  Math.round(state.sessionSavingsClp),
    tripCostClp: Math.round(state.tripCostClp),
  };
}

export { formatCLP, formatFuel, scoreLabel };
