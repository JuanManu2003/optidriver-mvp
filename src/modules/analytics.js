/** Precio referencia combustible Chile (CLP/L) */
export const FUEL_PRICE_CLP = 1600;

/** Consumo base urbano ride-hailing (L/100 km) */
export const BASELINE_FUEL_PER_100 = 7.2;

/**
 * RPM esperadas según velocidad (caja automática urbana)
 */
export function rpmFromSpeed(speedKmh, gearHint = 0) {
  if (speedKmh <= 3) return 750 + gearHint * 20;
  const ratio = 42 + gearHint * 3;
  return Math.round(800 + speedKmh * ratio + Math.sin(speedKmh * 0.15) * 80);
}

/**
 * Consumo instantáneo L/100 km coherente con velocidad y RPM
 */
export function fuelPer100FromTelemetry({ speed, rpm, isIdle, harshAccel, harshBrake }) {
  let fuel = BASELINE_FUEL_PER_100;

  if (isIdle) {
    fuel = 9.5;
  } else if (speed < 25) {
    fuel = 8.2 + (rpm - 1200) / 800;
  } else if (speed >= 25 && speed <= 65) {
    fuel = 5.8 + Math.abs(rpm - 1900) / 1200;
  } else if (speed > 65 && speed <= 90) {
    fuel = 6.4 + (speed - 65) * 0.06;
  } else {
    fuel = 8.5 + (speed - 90) * 0.12;
  }

  if (harshAccel) fuel += 1.4;
  if (harshBrake) fuel += 0.6;
  if (rpm > 3200) fuel += (rpm - 3200) / 1000;

  return Math.max(4.8, Math.min(14.5, Number(fuel.toFixed(1))));
}

/**
 * Score de conducción 0–100
 */
export function computeScore({ speed, rpm, fuelPer100, isIdle, harshAccel, harshBrake }) {
  let score = 88;

  if (speed >= 45 && speed <= 72 && rpm >= 1400 && rpm <= 2400) {
    score += 4;
  }

  if (fuelPer100 <= 6.2) score += 3;
  if (fuelPer100 > 8.5) score -= 8;
  if (fuelPer100 > 10) score -= 6;

  if (rpm > 3000) score -= 14;
  else if (rpm > 2600) score -= 7;

  if (speed > 85) score -= 12;
  else if (speed > 78) score -= 6;

  if (isIdle && speed < 2) score -= 4;
  if (harshAccel) score -= 10;
  if (harshBrake) score -= 8;

  score = Math.max(52, Math.min(98, Math.round(score)));
  return score;
}

export function scoreLabel(score) {
  if (score >= 85) return 'Excelente';
  if (score >= 75) return 'Bueno';
  return 'Mejorable';
}

/**
 * Estima pérdida o ahorro en CLP por tick (~1.5 s de conducción simulada)
 */
export function estimateMoneyDelta({ fuelPer100, speed, dtSec = 1.5 }) {
  const distanceKm = (speed / 3600) * dtSec;
  const liters = (fuelPer100 / 100) * distanceKm;
  const baselineLiters = (BASELINE_FUEL_PER_100 / 100) * distanceKm;
  const deltaLiters = liters - baselineLiters;
  // No redondear aquí: el delta por tick es fraccionario y debe acumularse
  // en decimales. El redondeo se hace solo al mostrar (getSessionMoney).
  const clp = deltaLiters * FUEL_PRICE_CLP;
  return { clp, liters, distanceKm };
}

export function formatCLP(value) {
  return value.toLocaleString('es-CL');
}

export function formatFuel(value) {
  return String(value).replace('.', ',');
}
