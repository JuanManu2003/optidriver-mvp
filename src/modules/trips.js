import { mockTrips, weeklySummary } from '../data/mockTrips.js';
import { formatCLP } from './analytics.js';

export function getRecentTrips() {
  return [...mockTrips];
}

export function getWeeklySummary() {
  return { ...weeklySummary };
}

export function formatTripCost(clp) {
  return `$${formatCLP(clp)} CLP`;
}

export function formatTripFuel(value) {
  return `${String(value).replace('.', ',')} L/100km`;
}
