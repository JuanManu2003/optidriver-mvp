/**
 * elm-supabase-agent.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Agente que corre en el dispositivo conectado al sensor ELM327 (PC, laptop,
 * o una Raspberry Pi en el auto). Lee la telemetría OBD2 y la publica en el
 * canal Realtime "telemetry" de Supabase, que la app web escucha en vivo.
 *
 * MODOS:
 *   node elm-supabase-agent.js --sim     → simula telemetría (sin hardware)
 *   node elm-supabase-agent.js           → lee el ELM327 real (requiere serialport)
 *
 * VARIABLES DE ENTORNO (.env del agente o exportadas):
 *   SUPABASE_URL        URL del proyecto Supabase
 *   SUPABASE_ANON_KEY   Clave anon (pública)
 *   ELM_PORT            Puerto serie del ELM327 (ej. COM3 o /dev/rfcomm0)
 *   ELM_BAUD            Baudios (default 38400)
 *   POLL_MS             Frecuencia de envío (default 1000)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const POLL_MS = Number(process.env.POLL_MS) || 1000;
const SIM = process.argv.includes('--sim');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Falta SUPABASE_URL o SUPABASE_ANON_KEY. Configúralos en el .env del agente.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const channel = supabase.channel('telemetry');

await new Promise((resolve) => {
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('✅ Conectado a Supabase Realtime (canal: telemetry)');
      resolve();
    }
  });
});

/** Publica un tick de telemetría en el canal. */
async function publish(tick) {
  await channel.send({ type: 'broadcast', event: 'tick', payload: tick });
}

// ─── MODO SIMULADOR ──────────────────────────────────────────────────────────
function startSimulator() {
  console.log(`🟡 Modo SIMULADOR — publicando cada ${POLL_MS} ms. Ctrl+C para detener.`);
  let speed = 50, mode = 'cruise', ticks = 0;

  setInterval(() => {
    ticks++;
    if (ticks % 6 === 0) mode = ['cruise', 'accel', 'brake', 'idle'][Math.floor(Math.random() * 4)];
    if (mode === 'accel') speed = Math.min(95, speed + 5 + Math.random() * 7);
    else if (mode === 'brake') speed = Math.max(0, speed - 8 + Math.random() * 4);
    else if (mode === 'idle') speed = Math.max(0, speed - 3);
    else speed += (Math.random() - 0.5) * 5;
    speed = Math.max(0, Math.min(95, Math.round(speed)));

    const rpm = Math.round(800 + speed * 45 + (Math.random() - 0.5) * 200);
    const fuel = +(5.8 + Math.abs(rpm - 1900) / 1200).toFixed(1);
    const score = Math.min(98, Math.max(52, 88 - (rpm > 3000 ? 14 : 0) - (fuel > 8.5 ? 8 : 0)));

    publish({ speed, rpm, fuel, score, mode, throttle: Math.round(speed / 95 * 60), temp: 90, ts: Date.now(), source: 'simulator' });
  }, POLL_MS);
}

// ─── MODO ELM327 REAL ────────────────────────────────────────────────────────
async function startElm() {
  const ELM_PORT = process.env.ELM_PORT || 'COM3';
  const ELM_BAUD = Number(process.env.ELM_BAUD) || 38400;

  let SerialPort, ReadlineParser;
  try {
    ({ SerialPort } = await import('serialport'));
    ({ ReadlineParser } = await import('@serialport/parser-readline'));
  } catch {
    console.error('❌ Falta serialport. Instálalo:  npm install serialport @serialport/parser-readline');
    process.exit(1);
  }

  const port = new SerialPort({ path: ELM_PORT, baudRate: ELM_BAUD });
  const parser = port.pipe(new ReadlineParser({ delimiter: '>' }));

  let buffer = '', resolver = null;
  parser.on('data', (line) => {
    buffer += line;
    if (line.includes('>') && resolver) { const r = resolver; resolver = null; r(buffer.replace(/[\r\n>]/g, '')); buffer = ''; }
  });
  const cmd = (c, timeout = 2000) => new Promise((res) => {
    resolver = res; buffer = ''; port.write(`${c}\r`);
    setTimeout(() => { if (resolver) { resolver = null; res(''); } }, timeout);
  });

  const hex = (h) => parseInt(h, 16);
  const pSpeed = (r) => { const m = r.match(/410D([0-9A-Fa-f]{2})/); return m ? hex(m[1]) : null; };
  const pRpm = (r) => { const m = r.match(/410C([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})/); return m ? Math.round(((hex(m[1]) * 256) + hex(m[2])) / 4) : null; };

  await new Promise((res) => port.on('open', res));
  console.log(`🔌 Puerto ${ELM_PORT} abierto. Inicializando ELM327...`);
  for (const c of ['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATSP0', '0100']) { await cmd(c, 3000); await new Promise(r => setTimeout(r, 300)); }
  console.log('🟢 ELM327 listo — leyendo OBD2 en vivo.');

  setInterval(async () => {
    const speed = pSpeed(await cmd('010D')) ?? 0;
    const rpm = pRpm(await cmd('010C')) ?? 800;
    const fuel = +(5.8 + Math.abs(rpm - 1900) / 1200).toFixed(1);
    const score = Math.min(98, Math.max(52, 88 - (rpm > 3000 ? 14 : 0)));
    publish({ speed, rpm, fuel, score, mode: 'live', ts: Date.now(), source: 'elm327' });
  }, POLL_MS);
}

if (SIM) startSimulator();
else startElm();
