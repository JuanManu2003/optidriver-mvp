/**
 * Catálogo de marcas y modelos frecuentes en Chile (ride-hailing / uso urbano).
 * Evita texto libre inventado; ampliable sin dependencias externas.
 */
export const VEHICLE_CATALOG = {
  Chevrolet: ['Sail', 'Spark', 'Onix', 'Cruze', 'Tracker', 'Captiva', 'Groove'],
  Citroën: ['C3', 'C4', 'Berlingo', 'C-Elysée'],
  Fiat: ['Uno', 'Argo', 'Cronos', 'Mobi', 'Pulse'],
  Ford: ['Ka', 'Fiesta', 'Focus', 'EcoSport', 'Ranger', 'Territory'],
  Honda: ['City', 'Civic', 'HR-V', 'CR-V', 'Fit'],
  Hyundai: ['Accent', 'Elantra', 'i10', 'i20', 'Tucson', 'Santa Fe', 'Creta', 'Venue'],
  Jeep: ['Renegade', 'Compass', 'Cherokee'],
  Kia: ['Rio', 'Cerato', 'Sportage', 'Seltos', 'Morning', 'Sorento'],
  Mazda: ['2', '3', 'CX-3', 'CX-5', 'CX-30'],
  'Mercedes-Benz': ['Clase A', 'Clase C', 'GLA'],
  Mitsubishi: ['Mirage', 'Lancer', 'Outlander', 'L200', 'ASX'],
  Nissan: ['March', 'Versa', 'Sentra', 'Kicks', 'X-Trail', 'Navara'],
  Peugeot: ['208', '2008', '301', '308', 'Partner'],
  Renault: ['Kwid', 'Logan', 'Sandero', 'Duster', 'Captur', 'Oroch'],
  Subaru: ['Impreza', 'XV', 'Forester', 'Outback'],
  Suzuki: ['Swift', 'Baleno', 'Vitara', 'Jimny', 'S-Cross'],
  Toyota: ['Yaris', 'Corolla', 'RAV4', 'Hilux', 'Raize', 'Rush', 'Camry', 'Prius'],
  Volkswagen: ['Gol', 'Polo', 'Virtus', 'T-Cross', 'Nivus', 'Jetta', 'Tiguan'],
};

export const VEHICLE_BRANDS = Object.keys(VEHICLE_CATALOG).sort((a, b) =>
  a.localeCompare(b, 'es'),
);

export function getModelsForBrand(brand) {
  const models = VEHICLE_CATALOG[brand];
  return models ? [...models].sort((a, b) => a.localeCompare(b, 'es')) : [];
}

export function isValidBrand(brand) {
  return VEHICLE_BRANDS.includes(String(brand || '').trim());
}

export function isValidModel(brand, model) {
  const models = getModelsForBrand(brand);
  return models.includes(String(model || '').trim());
}

export function getVehicleYears() {
  const current = new Date().getFullYear();
  const years = [];
  for (let y = current + 1; y >= 1995; y -= 1) {
    years.push(y);
  }
  return years;
}
