import { updateStat } from '../components/StatCard.js';
import { updateScoreGauge } from '../components/Gauge.js';
import {
  onTick, formatCLP, formatFuel, scoreLabel, showToast, getSessionMoney,
  pauseTelemetry, resumeTelemetry, isPaused, resetTripCost,
} from '../modules/telemetrySimulator.js';
import {
  recordTelemetryTick, getSessionSummary, resetSessionAnalytics,
} from '../modules/sessionAnalytics.js';
import { renderSessionSummary } from './activeTrip.js';
import { goTo } from '../modules/navigation.js';
import { bindAction } from '../components/Button.js';
import { tripsApi, getToken } from '../modules/api.js';

// ─── Gestión de viaje activo en backend ───────────────────────────────────────
let activeTripId = null;

async function startBackendTrip() {
  if (!getToken()) return;
  try {
    const { tripId } = await tripsApi.start({ source: 'simulator' });
    activeTripId = tripId;
  } catch { /* sin backend, continuar en modo local */ }
}

async function endBackendTrip() {
  const session = getSessionSummary();
  const money   = getSessionMoney();

  if (activeTripId && getToken()) {
    try {
      await tripsApi.end(activeTripId, {
        distanceKm:    session.distanceKm,
        durationMin:   Math.round(session.ticks * 1.5 / 60),
        avgSpeed:      session.avgSpeed,
        avgRpm:        session.avgRpm,
        avgFuelPer100: session.avgFuelPer100,
        score:         session.avgScore,
        costClp:       money.tripCostClp,
        savingsClp:    money.savingsClp,
        lossClp:       money.lossClp,
        harshBrakes:   session.harshBrakes,
        harshAccels:   session.harshAccels,
        idleSeconds:   Math.round(session.idleTicks * 1.5),
      });
    } catch { /* ignorar si no hay backend */ }
    activeTripId = null;
  }
  return session;
}

// ─── Control de botones ────────────────────────────────────────────────────────

function updateToggleButton() {
  const btn = document.getElementById('toggleTripBtn');
  if (!btn) return;
  btn.textContent = isPaused() ? '▶ Reanudar' : '⏸ Pausar';
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initDashboard() {
  onTick((telemetry, events) => {
    recordTelemetryTick(telemetry, events);

    updateStat('speedValue',  telemetry.speed);
    updateStat('rpmValue',    formatCLP(telemetry.rpm));
    updateStat('fuelValue',   formatFuel(telemetry.fuelPer100));
    updateStat('costValue',   formatCLP(Math.round(telemetry.tripCostClp)));
    updateStat('scoreValue',  telemetry.score);
    updateStat('scoreLabel',  scoreLabel(telemetry.score));
    updateScoreGauge(telemetry.score);

    renderSessionSummary();
  });

  // Iniciar viaje en backend al entrar al dashboard
  document.addEventListener('screenchange', async (e) => {
    if (e.detail?.screenId === 'dashboard') {
      updateToggleButton();
      if (!activeTripId) await startBackendTrip();
    }
  });

  // Pausar / Reanudar la telemetría en vivo
  bindAction('[data-action="toggle-trip"]', () => {
    if (isPaused()) {
      resumeTelemetry();
      showToast('Viaje reanudado', 'Telemetría en vivo activa de nuevo.');
    } else {
      pauseTelemetry();
      showToast('Viaje en pausa', 'Los datos en vivo están detenidos.');
    }
    updateToggleButton();
  });

  // Finalizar viaje: guarda en backend, reinicia sesión y va al historial
  bindAction('[data-action="finish-trip"]', async () => {
    const btn = document.getElementById('finishTripBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

    const session = await endBackendTrip();

    // Reiniciar acumuladores de la sesión
    resetSessionAnalytics();
    resetTripCost();
    resumeTelemetry();
    updateToggleButton();
    renderSessionSummary();

    if (btn) { btn.disabled = false; btn.textContent = 'Finalizar y guardar'; }

    showToast('Viaje guardado', `${session.distanceKm} km · score ${session.avgScore}. Ver en Viajes.`);

    // Iniciar un nuevo viaje en backend para la próxima sesión
    activeTripId = null;
    await startBackendTrip();
    goTo('trips');
  });

  bindAction('[data-action="dashboard-menu"]', () => {
    goTo('profile');
  });

  bindAction('[data-action="dashboard-alert"]', () => {
    const paused = isPaused();
    showToast(
      paused ? 'Telemetría en pausa' : 'Telemetría activa',
      paused ? 'Pulsa Reanudar para volver a recibir datos.' : 'Recibiendo datos del vehículo en vivo.',
    );
  });
}
