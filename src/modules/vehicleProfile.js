import { getVehicle, updateVehicle } from './storage.js';

export function readVehicleFromForm() {
  const brandEl = document.getElementById('brand');
  const modelEl = document.getElementById('model');
  const yearEl = document.getElementById('year');

  const brand = brandEl?.value?.trim() || brandEl?.selectedOptions?.[0]?.text?.trim() || '';
  const model = modelEl?.value?.trim() || '';
  const year = Number(yearEl?.value) || 2020;
  const fuelType = document.getElementById('fuelType')?.value || 'Gasolina';
  return { brand, model, year, fuelType };
}

export function saveVehicleFromForm() {
  const data = readVehicleFromForm();
  updateVehicle(data);
  return data;
}

export function syncProfileVehicleCard() {
  const vehicle = getVehicle();
  const brandEl = document.getElementById('profileBrand');
  const modelEl = document.getElementById('profileModel');
  const yearEl = document.getElementById('profileYear');
  const fuelEl = document.getElementById('profileFuel');

  if (brandEl) brandEl.textContent = vehicle.brand;
  if (modelEl) modelEl.textContent = vehicle.model;
  if (yearEl) yearEl.textContent = String(vehicle.year);
  if (fuelEl) fuelEl.textContent = vehicle.fuelType;
}
