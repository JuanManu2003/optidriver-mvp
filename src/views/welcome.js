import { getWeeklySummary } from '../modules/trips.js';
import { formatCLP } from '../modules/analytics.js';
import { isOnboardingComplete } from '../modules/auth.js';
import { goTo } from '../modules/navigation.js';
import { bindAction } from '../components/Button.js';

function refreshHeroMetrics() {
  const summary = getWeeklySummary();
  const effEl = document.getElementById('heroEfficiency');
  const savingsEl = document.getElementById('heroSavings');

  if (effEl) effEl.textContent = `+${summary.efficiencyPercent}%`;
  if (savingsEl) savingsEl.textContent = `$${formatCLP(summary.savingsClp)}`;
}

function refreshWelcomeActions() {
  const continueBtn = document.getElementById('welcomeContinue');
  if (!continueBtn) return;
  if (isOnboardingComplete()) {
    continueBtn.classList.remove('hidden');
  } else {
    continueBtn.classList.add('hidden');
  }
}

export function initWelcome() {
  refreshHeroMetrics();
  refreshWelcomeActions();

  bindAction('[data-action="welcome-continue"]', () => goTo('dashboard'));

  document.addEventListener('screenchange', (e) => {
    if (e.detail?.screenId === 'welcome') {
      refreshHeroMetrics();
      refreshWelcomeActions();
    }
  });

  document.addEventListener('sessionreset', () => {
    refreshWelcomeActions();
  });
}
