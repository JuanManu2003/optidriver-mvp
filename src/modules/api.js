/**
 * api.js — Cliente HTTP + WebSocket para el backend OptiDriver.
 *
 * En desarrollo: usa rutas relativas (/api, /ws) que el proxy de Vite
 *   redirige a localhost:3001.
 * En producción (frontend y backend en dominios distintos): define
 *   VITE_API_URL con la URL del backend, p. ej.:
 *     VITE_API_URL=https://optidriver-backend.onrender.com
 *   El WebSocket se deriva automáticamente de esa URL.
 */

// URL base del backend. Vacío en dev → usa el proxy de Vite (mismo origen).
const API_ORIGIN = import.meta.env.VITE_API_URL || '';
const BASE = `${API_ORIGIN}/api`;

// ─── Token JWT ────────────────────────────────────────────────────────────────

export function getToken() {
  return localStorage.getItem('optidriver_token') || '';
}

export function setToken(token) {
  localStorage.setItem('optidriver_token', token);
}

export function clearToken() {
  localStorage.removeItem('optidriver_token');
}

function authHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: authHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(json.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return json;
}

const get  = (path)        => request('GET',    path);
const post = (path, body)  => request('POST',   path, body);
const put  = (path, body)  => request('PUT',    path, body);
const del  = (path)        => request('DELETE', path);

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (data) => post('/auth/register', data),
  login:    (data) => post('/auth/login', data),
  me:       ()     => get('/auth/me'),
};

// ─── Vehicles ─────────────────────────────────────────────────────────────────

export const vehiclesApi = {
  list:   ()         => get('/vehicles'),
  create: (data)     => post('/vehicles', data),
  update: (id, data) => put(`/vehicles/${id}`, data),
  remove: (id)       => del(`/vehicles/${id}`),
};

// ─── Trips ────────────────────────────────────────────────────────────────────

export const tripsApi = {
  start:   (data)     => post('/trips/start', data),
  end:     (id, data) => post(`/trips/${id}/end`, data),
  list:    (limit)    => get(`/trips${limit ? `?limit=${limit}` : ''}`),
  summary: ()         => get('/trips/summary'),
};

// ─── Insights ─────────────────────────────────────────────────────────────────

export const insightsApi = {
  get: () => get('/insights'),
};

// ─── Telemetría ───────────────────────────────────────────────────────────────

export const telemetryApi = {
  status:  ()               => get('/telemetry/status'),
  postTick: (tripId, tick)  => post(`/telemetry/${tripId}/tick`, tick),
  elmPorts: ()              => get('/elm/ports'),
  connectElm: (port)        => post('/elm/connect', { port }),
};

// ─── WebSocket ────────────────────────────────────────────────────────────────

let ws = null;
let wsCallbacks = {};       // { telemetry: fn, elm_status: fn, ... }
let wsReconnectTimer = null;

function resolveWsUrl() {
  // En producción: deriva del backend (VITE_API_URL), cambiando http→ws / https→wss.
  if (API_ORIGIN) {
    return API_ORIGIN.replace(/^http/, 'ws') + '/ws';
  }
  // En desarrollo: mismo origen, el proxy de Vite redirige /ws → :3001.
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}

export function connectWS() {
  if (ws && ws.readyState < 2) return; // ya conectado o conectando

  const url = resolveWsUrl();
  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('[WS] Conectado al backend');
    clearTimeout(wsReconnectTimer);
  };

  ws.onmessage = (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      const cb  = wsCallbacks[msg.type];
      if (cb) cb(msg.data);
    } catch { /* ignorar mensajes malformados */ }
  };

  ws.onclose = () => {
    console.log('[WS] Desconectado. Reintentando en 3 s...');
    wsReconnectTimer = setTimeout(connectWS, 3000);
  };

  ws.onerror = () => ws.close();
}

export function onWsMessage(type, callback) {
  wsCallbacks[type] = callback;
}

export function disconnectWS() {
  clearTimeout(wsReconnectTimer);
  if (ws) ws.close();
  ws = null;
}
