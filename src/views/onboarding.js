import { goTo } from '../modules/navigation.js';
import { getUser, updateUser } from '../modules/storage.js';
import { bindAction } from '../components/Button.js';
import { populateCitySelect, validateCityField } from '../modules/cityCatalogUI.js';
import { setFieldError, showFormErrors } from '../modules/validation.js';

export function initOnboarding() {
  const user = getUser();
  const citySelect = document.getElementById('city');
  populateCitySelect(citySelect, user.city || '');

  const hoursRange = document.querySelector('#setupProfile input[type="range"]');
  const hoursValue = document.getElementById('hoursValue');

  if (hoursRange && hoursValue) {
    if (user.drivingHoursPerDay) hoursRange.value = user.drivingHoursPerDay;
    hoursValue.textContent = hoursRange.value;
    hoursRange.addEventListener('input', () => {
      hoursValue.textContent = hoursRange.value;
    });
  }

  document.querySelectorAll('#setupProfile .pill').forEach((pill) => {
    if (pill.textContent.trim() === user.platform) {
      document.querySelectorAll('#setupProfile .pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
    }
    pill.addEventListener('click', () => {
      document.querySelectorAll('#setupProfile .pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
    });
  });

  bindAction('[data-action="setup-profile-continue"]', () => {
    showFormErrors('setupProfileErrors', []);
    setFieldError('city', '');

    const cityResult = validateCityField('city');
    const summary = [];

    if (!cityResult.valid) {
      setFieldError('city', cityResult.message);
      summary.push(cityResult.message);
    }

    const activePill = document.querySelector('#setupProfile .pill.active');
    const platform = activePill?.textContent?.trim() || '';
    if (!platform) {
      summary.push('Selecciona tu plataforma principal (Uber, DiDi o Cabify).');
    }

    const hours = Number(hoursRange?.value || 0);
    if (!hours || hours < 1 || hours > 16) {
      summary.push('Indica horas de conducción válidas (1 a 16).');
    }

    if (summary.length) {
      showFormErrors('setupProfileErrors', summary);
      return;
    }

    updateUser({
      city: cityResult.value,
      platform,
      drivingHoursPerDay: hours,
    });

    goTo('setupVehicle');
  });
}
