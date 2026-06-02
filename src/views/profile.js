import { getUser } from '../modules/storage.js';
import { syncProfileVehicleCard } from '../modules/vehicleProfile.js';
import { resetSession } from '../modules/storage.js';
import { goTo } from '../modules/navigation.js';
import { showToast } from '../modules/telemetrySimulator.js';
import { formatCLP } from '../modules/analytics.js';
import { resetSessionAnalytics } from '../modules/sessionAnalytics.js';
import { resetTripCost } from '../modules/telemetrySimulator.js';
import { bindAction } from '../components/Button.js';
import { startGps, stopGps, isGpsRunning, isGpsSupported } from '../modules/gpsTelemetry.js';

function renderGpsToggle() {
  const toggle = document.getElementById('gpsToggle');
  const statusText = document.getElementById('gpsStatusText');
  const on = isGpsRunning();
  if (toggle) toggle.setAttribute('aria-checked', on ? 'true' : 'false');
  if (statusText) statusText.textContent = on ? 'Activada · midiendo' : 'Desactivada';
}

function renderProfile() {
  const user = getUser();
  const profileName = document.getElementById('profileName');
  const profileMeta = document.getElementById('profileMeta');
  const savingsText = document.getElementById('savingsGoalText');
  const savingsPct = document.getElementById('savingsGoalPct');
  const savingsBar = document.getElementById('savingsGoalBar');
  const fuelPrice = document.getElementById('profileFuelPrice');
  const platformEl = document.getElementById('profilePlatform');

  if (profileName) profileName.textContent = user.name;
  if (fuelPrice) fuelPrice.textContent = `$${formatCLP(user.fuelPricePerLiter)}/L`;
  if (platformEl) platformEl.textContent = user.platform || '—';

  if (profileMeta) {
    const cityShort = user.city ? user.city.split(',')[0] : '—';
    profileMeta.innerHTML = `
      <p class="small">${user.email || '—'}</p>
      <p class="small">${user.phoneDisplay || user.phone || '—'} · ${cityShort}</p>
      <p class="small">Conductor desde ${user.memberSince} · ${user.drivingHoursPerDay || 8} h/día</p>
    `;
  }

  const pct = Math.round((user.monthlySavingsCurrent / user.monthlySavingsGoal) * 100);
  if (savingsText) {
    savingsText.textContent = `$${formatCLP(user.monthlySavingsCurrent)} / $${formatCLP(user.monthlySavingsGoal)} CLP`;
  }
  if (savingsPct) savingsPct.textContent = `${pct}%`;
  if (savingsBar) savingsBar.style.width = `${pct}%`;

  syncProfileVehicleCard();
}

export function initProfile() {
  renderProfile();

  document.addEventListener('screenchange', (e) => {
    if (e.detail?.screenId === 'profile') { renderProfile(); renderGpsToggle(); }
  });

  bindAction('[data-action="profile-settings"]', () => {
    showToast('Configuración', 'Panel de configuración visual para el MVP.');
  });

  // Activar / desactivar la ubicación (GPS) desde el perfil
  bindAction('[data-action="toggle-gps"]', () => {
    if (isGpsRunning()) {
      stopGps();
      showToast('Ubicación desactivada', 'Ya no se está midiendo tu conducción.');
    } else {
      if (!isGpsSupported()) {
        showToast('GPS no disponible', 'Tu navegador no permite acceder a la ubicación.');
        return;
      }
      startGps((msg) => showToast('GPS', msg));
      showToast('Ubicación activada', 'Midiendo tu conducción por GPS.');
    }
    renderGpsToggle();
  });

  bindAction('[data-action="logout"]', () => {
    resetSessionAnalytics();
    resetTripCost();
    resetSession();
    goTo('welcome');
  });
}
