import './styles/main.css';

import { initStorage } from './modules/storage.js';
import { initBottomNav } from './components/BottomNav.js';
import { start as startTelemetry } from './modules/telemetrySimulator.js';

import { initWelcome } from './views/welcome.js';
import { initOnboarding } from './views/onboarding.js';
import { initLogin } from './views/login.js';
import { initRegister } from './views/register.js';
import { initVehicleSetup } from './views/vehicleSetup.js';
import { initDashboard } from './views/dashboard.js';
import { initActiveTrip } from './views/activeTrip.js';
import { initHistory } from './views/history.js';
import { initInsights } from './views/insights.js';
import { initProfile } from './views/profile.js';

function bootstrapApp() {
  initStorage();
  initBottomNav();

  initWelcome();
  initOnboarding();
  initLogin();
  initRegister();
  initVehicleSetup();
  initDashboard();
  initActiveTrip();
  initHistory();
  initInsights();
  initProfile();

  startTelemetry(1500);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapApp);
} else {
  bootstrapApp();
}
