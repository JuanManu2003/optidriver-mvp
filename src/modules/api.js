/**
 * api.js — Capa de datos sobre Supabase (auth + base de datos + realtime).
 *
 * Mantiene la misma interfaz que usaban las vistas (authApi, vehiclesApi,
 * tripsApi, insightsApi, connectWS/onWsMessage), de modo que el resto de la
 * app no cambia.
 *
 * Si Supabase NO está configurado (sin VITE_SUPABASE_URL), todas las llamadas
 * fallan de forma controlada y la app cae al modo local (localStorage + simulador).
 */

import { supabase, hasSupabase } from './supabase.js';

function ensure() {
  if (!hasSupabase) throw new Error('Supabase no configurado (modo local)');
  return supabase;
}

// ─── Sesión / token (compatibilidad con el código existente) ────────────────

let currentSession = null;

if (hasSupabase) {
  supabase.auth.getSession().then(({ data }) => { currentSession = data.session; });
  supabase.auth.onAuthStateChange((_event, session) => { currentSession = session; });
}

export function getToken() {
  return currentSession?.access_token || '';
}
export function setToken() { /* la sesión la gestiona supabase-js; no-op */ }
export function clearToken() { if (hasSupabase) supabase.auth.signOut(); }

function userId() {
  return currentSession?.user?.id || null;
}

// ─── Mapeo snake_case (BD) ↔ camelCase (frontend) ───────────────────────────

function tripToCamel(t) {
  return {
    id: t.id,
    startedAt: t.started_at,
    endedAt: t.ended_at,
    distanceKm: Number(t.distance_km) || 0,
    durationMin: Number(t.duration_min) || 0,
    avgSpeed: Number(t.avg_speed) || 0,
    avgRpm: Number(t.avg_rpm) || 0,
    avgFuelPer100: Number(t.avg_fuel_per_100) || 0,
    score: t.score || 0,
    costClp: t.cost_clp || 0,
    savingsClp: t.savings_clp || 0,
    lossClp: t.loss_clp || 0,
    harshBrakes: t.harsh_brakes || 0,
    harshAccels: t.harsh_accels || 0,
    idleSeconds: t.idle_seconds || 0,
    vehicleName: t.vehicle_name || 'Viaje',
  };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  async register({ firstName, lastName, email, password, phone, city }) {
    const sb = ensure();
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName, last_name: lastName, phone, city } },
    });
    if (error) throw new Error(error.message);
    currentSession = data.session;
    return { token: data.session?.access_token || 'pending', userId: data.user?.id };
  },

  async login({ email, password }) {
    const sb = ensure();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    currentSession = data.session;
    const p = await sb.from('profiles').select('*').eq('id', data.user.id).single();
    return {
      token: data.session.access_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        firstName: p.data?.first_name,
        lastName: p.data?.last_name,
        city: p.data?.city,
      },
    };
  },

  async me() {
    const sb = ensure();
    const id = userId();
    if (!id) throw new Error('Sin sesión');
    const { data, error } = await sb.from('profiles').select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    return data;
  },
};

// ─── Vehículos ─────────────────────────────────────────────────────────────────

export const vehiclesApi = {
  async list() {
    const sb = ensure();
    const { data, error } = await sb.from('vehicles').select('*').order('is_default', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },
  async create({ brand, model, year, fuelType, engineCC, plateNum }) {
    const sb = ensure();
    await sb.from('vehicles').update({ is_default: false }).eq('user_id', userId());
    const { data, error } = await sb.from('vehicles').insert({
      user_id: userId(), brand, model, year: Number(year),
      fuel_type: fuelType || 'gasoline', engine_cc: engineCC || null,
      plate_num: plateNum || null, is_default: true,
    }).select('id').single();
    if (error) throw new Error(error.message);
    return { id: data.id };
  },
  async update(id, patch) {
    const sb = ensure();
    const { error } = await sb.from('vehicles').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
    return { ok: true };
  },
  async remove(id) {
    const sb = ensure();
    const { error } = await sb.from('vehicles').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { ok: true };
  },
};

// ─── Viajes ────────────────────────────────────────────────────────────────────

export const tripsApi = {
  async start({ vehicleId, source } = {}) {
    const sb = ensure();
    const { data, error } = await sb.from('trips').insert({
      user_id: userId(), vehicle_id: vehicleId || null, source: source || 'simulator',
    }).select('id').single();
    if (error) throw new Error(error.message);
    return { tripId: data.id };
  },

  async end(id, t) {
    const sb = ensure();
    const { error } = await sb.from('trips').update({
      ended_at: new Date().toISOString(),
      distance_km: t.distanceKm, duration_min: t.durationMin,
      avg_speed: t.avgSpeed, avg_rpm: t.avgRpm, avg_fuel_per_100: t.avgFuelPer100,
      score: t.score, cost_clp: t.costClp, savings_clp: t.savingsClp,
      loss_clp: t.lossClp, harsh_brakes: t.harshBrakes,
      harsh_accels: t.harshAccels, idle_seconds: t.idleSeconds,
    }).eq('id', id);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async list(limit = 20) {
    const sb = ensure();
    const { data, error } = await sb.from('trips')
      .select('*').not('ended_at', 'is', null)
      .order('started_at', { ascending: false }).limit(limit);
    if (error) throw new Error(error.message);
    return data.map(tripToCamel);
  },

  async summary() {
    const sb = ensure();
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    const { data, error } = await sb.from('trips')
      .select('*').not('ended_at', 'is', null).gte('started_at', weekAgo);
    if (error) throw new Error(error.message);

    const tripCount = data.length;
    const totalKm = data.reduce((s, t) => s + Number(t.distance_km || 0), 0);
    const savingsClp = data.reduce((s, t) => s + (t.savings_clp || 0), 0);
    const avgScore = tripCount ? Math.round(data.reduce((s, t) => s + (t.score || 0), 0) / tripCount) : 0;
    return { tripCount, totalKm: Math.round(totalKm * 10) / 10, savingsClp, avgScore };
  },
};

// ─── Insights (cálculo en cliente sobre últimos 10 viajes) ──────────────────────

export const insightsApi = {
  async get() {
    const sb = ensure();
    const { data, error } = await sb.from('trips')
      .select('*').not('ended_at', 'is', null)
      .order('started_at', { ascending: false }).limit(10);
    if (error) throw new Error(error.message);

    if (!data.length) {
      return { habits: null, tip: { title: '¡Comienza a conducir!', body: 'Completa un viaje para ver tus hábitos.' } };
    }

    const n = data.length;
    const totalBrakes = data.reduce((s, t) => s + (t.harsh_brakes || 0), 0);
    const totalAccels = data.reduce((s, t) => s + (t.harsh_accels || 0), 0);
    const totalIdle = data.reduce((s, t) => s + (t.idle_seconds || 0), 0);
    const avgScore = Math.round(data.reduce((s, t) => s + (t.score || 0), 0) / n);

    const braking = Math.max(0, Math.min(100, Math.round(100 - (totalBrakes / n) * 12)));
    const acceleration = Math.max(0, Math.min(100, Math.round(100 - (totalAccels / n) * 12)));
    const steadySpeed = Math.max(0, Math.min(100, Math.round(100 - ((totalIdle / n) / 60) * 8)));

    let tip;
    if (braking < 65) tip = { title: 'Frena con anticipación', body: 'Anticipa el tráfico y suelta el acelerador antes de frenar.' };
    else if (acceleration < 65) tip = { title: 'Acelera suavemente', body: 'Sube de marcha progresivamente para reducir el consumo.' };
    else if (steadySpeed < 70) tip = { title: 'Evita el ralentí', body: 'Apaga el motor en paradas largas.' };
    else tip = { title: '¡Conducción excelente!', body: 'Mantén velocidad constante entre 50–80 km/h.' };

    return {
      habits: { braking, acceleration, steadySpeed, avgScore },
      tip,
    };
  },
};

// ─── Telemetría (compat; el sensor escribe vía Realtime, ver abajo) ─────────────

export const telemetryApi = {
  status: async () => ({ connected: false }),
};

// ─── Realtime (reemplaza el WebSocket) ──────────────────────────────────────────
//
// El agente ELM (agent/elm-supabase-agent.js) emite "broadcast" en el canal
// `telemetry`. Aquí nos suscribimos y reenviamos a los callbacks registrados,
// con la misma API onWsMessage(type, cb) que ya usa telemetrySimulator.js.

let channel = null;
let wsCallbacks = {};

export function connectWS() {
  if (!hasSupabase || channel) return;

  channel = supabase.channel('telemetry');

  channel.on('broadcast', { event: 'tick' }, ({ payload }) => {
    const cb = wsCallbacks['telemetry'];
    if (cb) cb(payload);
  });

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') console.log('[Realtime] Suscrito al canal de telemetría');
  });
}

export function onWsMessage(type, callback) {
  wsCallbacks[type] = callback;
}

export function disconnectWS() {
  if (channel) { supabase.removeChannel(channel); channel = null; }
}
