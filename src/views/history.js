import { tripsApi } from '../modules/api.js';
import { getRecentTrips, getWeeklySummary, formatTripCost, formatTripFuel } from '../modules/trips.js';
import { formatCLP } from '../modules/analytics.js';
import { createTripBadge } from '../components/AlertBadge.js';
import { showToast } from '../modules/telemetrySimulator.js';
import { bindAction } from '../components/Button.js';

function renderTrips(trips) {
  const list = document.getElementById('tripsList');
  if (!list) return;
  list.innerHTML = '';

  trips.forEach((trip) => {
    const row = document.createElement('div');
    row.className = 'trip';

    const durationMin = trip.durationMin ?? trip.durationMin ?? '—';
    const distKm      = trip.distanceKm  ?? trip.distanceKm  ?? '—';
    const fuel        = trip.avgFuelPer100 ?? trip.fuelPer100 ?? '—';
    const cost        = trip.costClp ?? 0;
    const score       = trip.score ?? 0;
    const label       = trip.vehicleName || trip.label || 'Viaje';
    const date        = trip.startedAt ? new Date(trip.startedAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) : '';

    row.innerHTML = `
      <div>
        <strong>${label}${date ? ` · ${date}` : ''}</strong>
        <div class="trip-data">
          <span>${durationMin} min</span>
          <span>${String(distKm).replace('.', ',')} km</span>
          <span>${typeof fuel === 'number' ? fuel.toFixed(1).replace('.', ',') : fuel} L/100</span>
          <span>$${formatCLP(cost)} CLP</span>
        </div>
      </div>
    `;
    row.appendChild(createTripBadge(score));
    list.appendChild(row);
  });

  if (trips.length === 0) {
    list.innerHTML = '<p class="muted" style="text-align:center;padding:1rem">Sin viajes registrados aún.</p>';
  }
}

function renderSummary(summary) {
  const savingsEl = document.getElementById('weeklySavings');
  const tripsEl   = document.getElementById('weeklyTrips');
  const kmEl      = document.getElementById('weeklyKm');
  const effEl     = document.getElementById('weeklyEfficiency');

  if (savingsEl) savingsEl.textContent = `$${formatCLP(summary.savingsClp || summary.savingsClp || 0)} CLP`;
  if (tripsEl)   tripsEl.textContent   = String(summary.tripCount || 0);
  if (kmEl)      kmEl.textContent      = String(summary.totalKm || 0);
  if (effEl)     effEl.textContent     = `+${summary.efficiencyPercent || summary.avgScore || 0}%`;
}

async function loadFromBackend() {
  try {
    const [trips, summary] = await Promise.all([tripsApi.list(20), tripsApi.summary()]);
    renderTrips(trips);
    renderSummary(summary);
  } catch {
    // Fallback a datos locales si el backend no responde
    renderTrips(getRecentTrips());
    renderSummary(getWeeklySummary());
  }
}

export function initHistory() {
  // Carga inicial con datos locales (inmediato)
  renderSummary(getWeeklySummary());
  renderTrips(getRecentTrips());

  bindAction('[data-action="trips-filter"]', () => {
    showToast('Filtro', 'Filtros por período disponibles en próxima versión.');
  });

  // Recarga desde backend cada vez que se entra a la pantalla
  document.addEventListener('screenchange', (e) => {
    if (e.detail?.screenId === 'trips') loadFromBackend();
  });
}
