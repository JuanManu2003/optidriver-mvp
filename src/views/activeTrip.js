import { formatCLP } from '../modules/analytics.js';
import { getSessionMoney } from '../modules/telemetrySimulator.js';
import { getSessionSummary } from '../modules/sessionAnalytics.js';

export function renderSessionSummary() {
  const money = getSessionMoney();
  const session = getSessionSummary();

  const lossEl = document.getElementById('sessionLoss');
  const savingsEl = document.getElementById('sessionSavings');
  const distEl = document.getElementById('sessionDistance');
  const avgEl = document.getElementById('sessionAvgScore');

  if (lossEl) lossEl.textContent = `$${formatCLP(money.lossClp)}`;
  if (savingsEl) savingsEl.textContent = `$${formatCLP(money.savingsClp)}`;
  if (distEl) distEl.textContent = `${String(session.distanceKm).replace('.', ',')} km`;
  if (avgEl) avgEl.textContent = session.ticks > 0 ? String(session.avgScore) : '—';
}

export function initActiveTrip() {
  document.addEventListener('screenchange', (e) => {
    if (e.detail?.screenId === 'dashboard') renderSessionSummary();
  });
}
