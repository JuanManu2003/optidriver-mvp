/**
 * gpsTelemetry.js — Mide la conducción usando el GPS del teléfono (estilo Waze).
 *
 * Usa la Geolocation API del navegador (funciona en iPhone y Android, sin
 * hardware ni Bluetooth). Obtiene la velocidad real y la entrega al motor de
 * telemetría, que deriva aceleración, frenadas, consumo estimado y score.
 *
 * Requisitos:
 *  - HTTPS (Netlify lo da) o localhost.
 *  - El usuario debe aceptar el permiso de ubicación.
 */

import { ingestGpsTick, resetGps } from './telemetrySimulator.js';

let watchId = null;
let lastTs = null;
let lastCoords = null;

export function isGpsSupported() {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

export function isGpsRunning() {
  return watchId != null;
}

/** Distancia en metros entre dos coordenadas (fórmula de Haversine). */
function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function geoErrorMessage(err) {
  switch (err?.code) {
    case 1: return 'Permiso de ubicación denegado. Actívalo para medir tu conducción.';
    case 2: return 'No se pudo obtener la ubicación (señal GPS débil).';
    case 3: return 'Tiempo de espera del GPS agotado. Intenta al aire libre.';
    default: return 'No se pudo iniciar el GPS.';
  }
}

/**
 * Inicia la medición por GPS.
 * @param {(msg:string)=>void} onError  callback opcional para errores
 * @returns {boolean} true si arrancó
 */
export function startGps(onError) {
  if (!isGpsSupported()) {
    onError?.('Tu navegador no permite acceder al GPS.');
    return false;
  }
  if (watchId != null) return true;

  resetGps();
  lastTs = null;
  lastCoords = null;

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const now = pos.timestamp || Date.now();
      const dtSec = lastTs ? (now - lastTs) / 1000 : 1;
      lastTs = now;

      let speedKmh;
      // Muchos teléfonos entregan la velocidad directamente (m/s → km/h)
      if (pos.coords.speed != null && !Number.isNaN(pos.coords.speed) && pos.coords.speed >= 0) {
        speedKmh = pos.coords.speed * 3.6;
      } else if (lastCoords) {
        // Si no, la calculamos por distancia recorrida / tiempo
        const d = distanceMeters(lastCoords, pos.coords);
        speedKmh = (d / Math.max(dtSec, 0.3)) * 3.6;
      } else {
        speedKmh = 0;
      }
      lastCoords = pos.coords;

      ingestGpsTick({ speedKmh, dtSec: Math.min(Math.max(dtSec, 0.3), 5) });
    },
    (err) => onError?.(geoErrorMessage(err)),
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 12000 },
  );

  return true;
}

/** Detiene la medición por GPS. */
export function stopGps() {
  if (watchId != null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  lastTs = null;
  lastCoords = null;
}
