import { CHILE_CITIES, isValidChileCity } from '../data/chileCities.js';

export function populateCitySelect(selectEl, selectedCity = '') {
  if (!selectEl) return;
  const sorted = [...CHILE_CITIES].sort((a, b) => a.localeCompare(b, 'es'));
  selectEl.innerHTML =
    '<option value="">Selecciona tu ciudad</option>' +
    sorted
      .map(
        (c) =>
          `<option value="${c.replace(/"/g, '&quot;')}"${c === selectedCity ? ' selected' : ''}>${c}</option>`,
      )
      .join('');
}

export function validateCityField(selectId = 'city') {
  const value = document.getElementById(selectId)?.value?.trim() || '';
  if (!value) return { valid: false, message: 'Debes seleccionar una ciudad.' };
  if (!isValidChileCity(value)) {
    return { valid: false, message: 'La ciudad seleccionada no es válida.' };
  }
  return { valid: true, value };
}
