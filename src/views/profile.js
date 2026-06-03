import { getUser, getVehicle, updateUser, updateVehicle, resetSession } from '../modules/storage.js';
import { syncProfileVehicleCard } from '../modules/vehicleProfile.js';
import { goTo } from '../modules/navigation.js';
import { showToast, resetTripCost } from '../modules/telemetrySimulator.js';
import { formatCLP } from '../modules/analytics.js';
import { resetSessionAnalytics } from '../modules/sessionAnalytics.js';
import { bindAction } from '../components/Button.js';
import { startGps, stopGps, isGpsRunning, isGpsSupported } from '../modules/gpsTelemetry.js';
import { tripsApi } from '../modules/api.js';

function renderProfile() {
  const user = getUser();

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set('profileName', user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Conductor');
  set('profileEmailLine', user.email || '—');
  set('profilePlatform', user.platform || 'Uber');
  set('profileMemberSince', `Desde ${user.memberSince || '2024'}`);
  set('profileFuelPrice', `$${formatCLP(user.fuelPricePerLiter || 1320)}/L`);

  const avatar = document.getElementById('profileAvatar');
  if (avatar) {
    const initials = `${(user.firstName || user.name || 'C')[0] || ''}`.toUpperCase();
    avatar.textContent = initials || '👤';
  }

  // Meta de ahorro
  const goal = user.monthlySavingsGoal || 20000;
  const current = user.monthlySavingsCurrent || 0;
  const pct = Math.min(100, Math.round((current / goal) * 100));
  set('savingsGoalText', `$${formatCLP(current)} / $${formatCLP(goal)} CLP`);
  set('savingsGoalPct', `${pct}%`);
  const bar = document.getElementById('savingsGoalBar');
  if (bar) bar.style.width = `${pct}%`;

  syncProfileVehicleCard();
}

async function renderStats() {
  // Resumen real desde Supabase (con respaldo a 0 si no hay sesión/datos)
  try {
    const summary = await tripsApi.summary();
    document.getElementById('statTrips').textContent = summary.tripCount ?? 0;
    document.getElementById('statKm').textContent = summary.totalKm ?? 0;
    document.getElementById('statScore').textContent = summary.avgScore || '—';
  } catch {
    document.getElementById('statTrips').textContent = '0';
    document.getElementById('statKm').textContent = '0';
    document.getElementById('statScore').textContent = '—';
  }
}

function renderGpsToggle() {
  const toggle = document.getElementById('gpsToggle');
  const statusText = document.getElementById('gpsStatusText');
  const on = isGpsRunning();
  if (toggle) toggle.setAttribute('aria-checked', on ? 'true' : 'false');
  if (statusText) statusText.textContent = on ? 'Activada · midiendo' : 'Desactivada';
}

// ─── Edición de perfil ─────────────────────────────────────────────────────────

function openEdit() {
  const user = getUser();
  const vehicle = getVehicle();
  const val = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };

  val('editFirstName', user.firstName || (user.name || '').split(' ')[0]);
  val('editLastName', user.lastName || (user.name || '').split(' ').slice(1).join(' '));
  val('editCity', (user.city || '').split(',')[0]);
  val('editPlatform', user.platform || 'Uber');
  val('editHours', user.drivingHoursPerDay || 8);
  val('editBrand', vehicle.brand);
  val('editModel', vehicle.model);
  val('editYear', vehicle.year);
  val('editFuel', vehicle.fuelType || 'Gasolina');

  document.getElementById('profileEditForm')?.classList.remove('hidden');
}

function closeEdit() {
  document.getElementById('profileEditForm')?.classList.add('hidden');
}

function saveEdit() {
  const get = (id) => document.getElementById(id)?.value?.trim() || '';
  const firstName = get('editFirstName');
  const lastName = get('editLastName');

  updateUser({
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
    city: get('editCity'),
    platform: get('editPlatform'),
    drivingHoursPerDay: Number(get('editHours')) || 8,
  });

  updateVehicle({
    brand: get('editBrand'),
    model: get('editModel'),
    year: Number(get('editYear')) || 2020,
    fuelType: get('editFuel'),
  });

  closeEdit();
  renderProfile();
  showToast('Perfil actualizado', 'Tus datos se guardaron correctamente.');
}

export function initProfile() {
  renderProfile();
  renderStats();
  renderGpsToggle();

  document.addEventListener('screenchange', (e) => {
    if (e.detail?.screenId === 'profile') {
      renderProfile();
      renderStats();
      renderGpsToggle();
      closeEdit();
    }
  });

  bindAction('[data-action="edit-profile"]', openEdit);
  bindAction('[data-action="cancel-edit"]', closeEdit);
  bindAction('[data-action="save-profile"]', saveEdit);

  bindAction('[data-action="toggle-gps"]', () => {
    if (isGpsRunning()) {
      stopGps();
      showToast('Ubicación desactivada', 'Ya no se está midiendo tu conducción.');
    } else {
      if (!isGpsSupported()) {
        showToast('GPS no disponible', 'Tu navegador no permite acceder a la ubicación.');
        return;
      }
      startGps((msg) => showToast('Ubicación', msg));
      showToast('Ubicación activada', 'Midiendo tu conducción por GPS.');
    }
    renderGpsToggle();
  });

  bindAction('[data-action="toggle-notif"]', () => {
    const t = document.getElementById('notifToggle');
    const on = t?.getAttribute('aria-checked') === 'true';
    t?.setAttribute('aria-checked', on ? 'false' : 'true');
    showToast('Notificaciones', on ? 'Desactivadas.' : 'Activadas.');
  });

  bindAction('[data-action="logout"]', () => {
    if (isGpsRunning()) stopGps();
    resetSessionAnalytics();
    resetTripCost();
    resetSession();
    goTo('welcome');
  });
}
