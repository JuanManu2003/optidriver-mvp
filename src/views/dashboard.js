import { updateStat } from '../components/StatCard.js';
import {
  onTick, formatCLP, formatFuel, scoreLabel, showToast,
  getSessionMoney, resetTripCost, pauseTelemetry, resumeTelemetry,
} from '../modules/telemetrySimulator.js';
import {
  recordTelemetryTick, getSessionSummary, resetSessionAnalytics,
} from '../modules/sessionAnalytics.js';
import { goTo } from '../modules/navigation.js';
import { bindAction } from '../components/Button.js';
import { tripsApi, getToken } from '../modules/api.js';
import { startGps, isGpsSupported, isGpsRunning } from '../modules/gpsTelemetry.js';

let tripActive = false;
let activeTripId = null;
let tripStartTs = 0;
let timerId = null;

function fmtTime(ms) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function showState(active) {
  document.getElementById('tripIdleState')?.classList.toggle('hidden', active);
  document.getElementById('tripActiveState')?.classList.toggle('hidden', !active);
}

function tickTimer() {
  const el = document.getElementById('tripTimeValue');
  if (el && tripActive) el.textContent = fmtTime(Date.now() - tripStartTs);
}

async function beginTrip() {
  // Arrancar el GPS (pide permiso de ubicación) si está disponible.
  if (isGpsSupported() && !isGpsRunning()) {
    startGps((msg) => showToast('Ubicación', msg));
  }

  resetSessionAnalytics();
  resetTripCost();
  resumeTelemetry(); // empieza a medir
  tripActive = true;
  tripStartTs = Date.now();
  showState(true);

  // Reiniciar valores en pantalla
  ['distValue', 'maxSpeedValue', 'avgSpeedValue', 'harshBrakeCount', 'harshAccelCount', 'fuelValue', 'speedValue']
    .forEach((id) => updateStat(id, '0'));
  updateStat('tripTimeValue', '00:00');
  updateStat('costValue', '0');
  updateStat('sessionSavings', '$0');
  updateStat('sessionLoss', '$0');
  const list = document.getElementById('eventList');
  if (list) list.innerHTML = '';

  timerId = setInterval(tickTimer, 1000);

  if (getToken()) {
    try {
      const { tripId } = await tripsApi.start({ source: 'gps' });
      activeTripId = tripId;
    } catch { /* sin sesión: viaje solo local */ }
  }

  showToast('Viaje iniciado', 'Conduce con cuidado. Estamos midiendo tu trayecto.');
}

async function endTrip() {
  clearInterval(timerId);
  timerId = null;
  pauseTelemetry(); // deja de medir al finalizar

  const s = getSessionSummary();
  const money = getSessionMoney();

  if (activeTripId && getToken()) {
    try {
      await tripsApi.end(activeTripId, {
        distanceKm: s.distanceKm,
        durationMin: Math.round((Date.now() - tripStartTs) / 60000),
        avgSpeed: s.avgSpeed,
        avgRpm: s.avgRpm,
        avgFuelPer100: s.avgFuelPer100,
        score: s.avgScore,
        costClp: money.tripCostClp,
        savingsClp: money.savingsClp,
        lossClp: money.lossClp,
        harshBrakes: s.harshBrakes,
        harshAccels: s.harshAccels,
        idleSeconds: Math.round(s.idleTicks * 1.5),
      });
    } catch { /* ignorar si no hay backend */ }
  }

  activeTripId = null;
  tripActive = false;
  showState(false);

  showToast('Viaje guardado', `${s.distanceKm} km · conducción ${scoreLabel(s.avgScore).toLowerCase()}.`);
  goTo('trips');
}

export function initDashboard() {
  onTick((telemetry, events) => {
    // La velocidad actual se muestra siempre (confirma que el GPS responde)
    updateStat('speedValue', telemetry.speed);
    if (!tripActive) return;

    recordTelemetryTick(telemetry, events);
    const s = getSessionSummary();
    const money = getSessionMoney();

    updateStat('distValue', s.distanceKm.toFixed(1).replace('.', ','));
    updateStat('maxSpeedValue', s.maxSpeed);
    updateStat('avgSpeedValue', s.avgSpeed);
    updateStat('fuelValue', formatFuel(telemetry.fuelPer100));
    updateStat('harshBrakeCount', s.harshBrakes);
    updateStat('harshAccelCount', s.harshAccels);
    updateStat('costValue', formatCLP(Math.round(money.tripCostClp)));
    updateStat('sessionSavings', `$${formatCLP(money.savingsClp)}`);
    updateStat('sessionLoss', `$${formatCLP(money.lossClp)}`);

    const chip = document.getElementById('drivingChip');
    if (chip) chip.textContent = `Conducción: ${scoreLabel(s.avgScore)}`;
  });

  // Sin viaje activo, la telemetría está en pausa (no genera datos ni avisos)
  pauseTelemetry();

  bindAction('[data-action="start-trip"]', beginTrip);
  bindAction('[data-action="finish-trip"]', endTrip);
  bindAction('[data-action="dashboard-menu"]', () => goTo('profile'));

  document.addEventListener('screenchange', (e) => {
    if (e.detail?.screenId === 'dashboard') showState(tripActive);
  });
}
