import { goTo } from '../modules/navigation.js';
import { getVehicle } from '../modules/storage.js';
import { markOnboardingComplete } from '../modules/auth.js';
import { saveVehicleFromForm, syncProfileVehicleCard } from '../modules/vehicleProfile.js';
import { showToast } from '../modules/telemetrySimulator.js';
import { bindAction } from '../components/Button.js';
import {
  initVehicleCatalogSelectors,
  loadVehicleIntoSelectors,
  validateVehicleForm,
} from '../modules/vehicleCatalogUI.js';
import { setFieldError, showFormErrors } from '../modules/validation.js';
import { startGps, isGpsSupported } from '../modules/gpsTelemetry.js';

function validateAndSaveVehicle() {
  showFormErrors('setupVehicleErrors', []);
  setFieldError('brand', '');
  setFieldError('model', '');
  setFieldError('year', '');

  const result = validateVehicleForm();
  if (!result.valid) {
    showFormErrors('setupVehicleErrors', result.errors);
    if (!result.data.brand) setFieldError('brand', 'Selecciona una marca.');
    if (!result.data.model) setFieldError('model', 'Selecciona un modelo.');
    if (!result.data.year) setFieldError('year', 'Selecciona un año.');
    return false;
  }

  saveVehicleFromForm();
  syncProfileVehicleCard();
  markOnboardingComplete();
  return true;
}

export function initVehicleSetup() {
  initVehicleCatalogSelectors();
  loadVehicleIntoSelectors(getVehicle());

  bindAction('[data-action="start-gps"]', () => {
    if (!validateAndSaveVehicle()) return;
    showFormErrors('gpsError', []);

    if (!isGpsSupported()) {
      showFormErrors('gpsError', ['Tu navegador no permite GPS. Usa el modo demostración.']);
      return;
    }

    // Pide el permiso de ubicación y arranca la medición.
    const ok = startGps((msg) => {
      showFormErrors('gpsError', [msg]);
      showToast('GPS', msg);
    });

    if (ok) {
      showToast('Medición activa', 'Sigue tu conducción en el panel en vivo.');
      goTo('dashboard');
    }
  });

  bindAction('[data-action="skip-obd"]', () => {
    if (!validateAndSaveVehicle()) return;
    goTo('dashboard');
  });
}
