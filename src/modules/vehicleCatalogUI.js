import {
  VEHICLE_BRANDS,
  getModelsForBrand,
  getVehicleYears,
  isValidBrand,
  isValidModel,
} from '../data/vehicleCatalog.js';
import { isValidVehicleYear } from './validation.js';

export function populateBrandSelect(selectEl, selectedBrand = '') {
  if (!selectEl) return;
  selectEl.innerHTML =
    '<option value="">Selecciona marca</option>' +
    VEHICLE_BRANDS.map(
      (b) => `<option value="${b}"${b === selectedBrand ? ' selected' : ''}>${b}</option>`,
    ).join('');
}

export function populateModelSelect(selectEl, brand, selectedModel = '') {
  if (!selectEl) return;
  const models = brand ? getModelsForBrand(brand) : [];
  if (!models.length) {
    selectEl.innerHTML = '<option value="">Primero elige una marca</option>';
    selectEl.disabled = true;
    return;
  }
  selectEl.disabled = false;
  selectEl.innerHTML =
    '<option value="">Selecciona modelo</option>' +
    models
      .map(
        (m) =>
          `<option value="${m}"${m === selectedModel ? ' selected' : ''}>${m}</option>`,
      )
      .join('');
}

export function populateYearSelect(selectEl, selectedYear = '') {
  if (!selectEl) return;
  const years = getVehicleYears();
  selectEl.innerHTML =
    '<option value="">Selecciona año</option>' +
    years
      .map(
        (y) =>
          `<option value="${y}"${String(y) === String(selectedYear) ? ' selected' : ''}>${y}</option>`,
      )
      .join('');
}

export function initVehicleCatalogSelectors({ brandId, modelId, yearId, onChange } = {}) {
  const brandEl = document.getElementById(brandId || 'brand');
  const modelEl = document.getElementById(modelId || 'model');
  const yearEl = document.getElementById(yearId || 'year');

  const refreshModels = () => {
    populateModelSelect(modelEl, brandEl?.value || '');
    onChange?.();
  };

  brandEl?.addEventListener('change', refreshModels);
  modelEl?.addEventListener('change', () => onChange?.());
  yearEl?.addEventListener('change', () => onChange?.());

  return { brandEl, modelEl, yearEl, refreshModels };
}

export function loadVehicleIntoSelectors(vehicle) {
  const brandEl = document.getElementById('brand');
  const modelEl = document.getElementById('model');
  const yearEl = document.getElementById('year');

  const brand = vehicle?.brand && isValidBrand(vehicle.brand) ? vehicle.brand : 'Toyota';
  const model =
    vehicle?.model && isValidModel(brand, vehicle.model) ? vehicle.model : getModelsForBrand(brand)[0];

  populateBrandSelect(brandEl, brand);
  populateModelSelect(modelEl, brand, model);
  populateYearSelect(yearEl, vehicle?.year || 2020);
}

export function validateVehicleForm() {
  const brand = document.getElementById('brand')?.value?.trim() || '';
  const model = document.getElementById('model')?.value?.trim() || '';
  const year = document.getElementById('year')?.value || '';
  const fuelType = document.getElementById('fuelType')?.value || '';

  const errors = [];

  if (!isValidBrand(brand)) errors.push('Selecciona una marca de vehículo válida.');
  if (!isValidModel(brand, model)) errors.push('Selecciona un modelo que corresponda a la marca.');
  if (!isValidVehicleYear(year)) errors.push('Selecciona un año de fabricación válido.');
  if (!fuelType) errors.push('Selecciona el tipo de combustible.');

  return { valid: errors.length === 0, errors, data: { brand, model, year: Number(year), fuelType } };
}
