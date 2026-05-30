/**
 * elmReader.js — Integración con sensor ELM327 vía puerto serie.
 *
 * serialport se importa dinámicamente para que el servidor arranque aunque
 * no esté instalado. Solo se necesita si se usa un ELM327 físico.
 *
 * Para instalarlo cuando tengas el sensor:
 *   cd backend && npm install serialport
 *
 * PIDs OBD2 consultados:
 *   010D → Velocidad (km/h)
 *   010C → RPM  → ((A*256)+B)/4
 *   0111 → Acelerador (%)
 *   0105 → Temperatura motor (°C)  → A-40
 */

const DEFAULT_PORT = process.env.ELM_PORT  || 'COM3';
const BAUD_RATE    = Number(process.env.ELM_BAUD)    || 38400;
const POLL_MS      = Number(process.env.ELM_POLL_MS) || 500;

let elmStatus = { connected: false, port: DEFAULT_PORT, lastError: null, lastData: null };
let port = null;
let parser = null;
let pollTimer = null;
let pendingResolve = null;
let pendingTimer = null;
let responseBuffer = '';
let onDataCallback = null;

// ─── Parseo OBD2 ─────────────────────────────────────────────────────────────

const hex = (h) => parseInt(h, 16);

function parseSpeed(r)   { const m = r.match(/410D([0-9A-Fa-f]{2})/);              return m ? hex(m[1]) : null; }
function parseRPM(r)     { const m = r.match(/410C([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})/); return m ? Math.round(((hex(m[1])*256)+hex(m[2]))/4) : null; }
function parseThrottle(r){ const m = r.match(/4111([0-9A-Fa-f]{2})/);              return m ? Math.round((hex(m[1])/255)*100) : null; }
function parseTemp(r)    { const m = r.match(/4105([0-9A-Fa-f]{2})/);              return m ? hex(m[1])-40 : null; }

// ─── Comunicación ─────────────────────────────────────────────────────────────

function sendCommand(cmd, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    if (!port?.isOpen) return reject(new Error('Puerto no abierto'));
    pendingResolve = resolve;
    responseBuffer = '';
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => { pendingResolve = null; reject(new Error(`Timeout: ${cmd}`)); }, timeoutMs);
    port.write(`${cmd}\r`);
  });
}

function handleData(line) {
  const clean = line.replace(/[\r\n>]/g, '').trim();
  if (!clean) return;
  responseBuffer += clean + ' ';
  if (line.includes('>') && pendingResolve) {
    clearTimeout(pendingTimer);
    const result = responseBuffer.trim();
    responseBuffer = '';
    const fn = pendingResolve;
    pendingResolve = null;
    fn(result);
  }
}

async function initElm() {
  const cmds = ['ATZ','ATE0','ATL0','ATS0','ATSP0','0100'];
  for (const cmd of cmds) {
    await sendCommand(cmd, 3000);
    await new Promise(r => setTimeout(r, 300));
  }
}

async function pollTelemetry() {
  try {
    const sr = await sendCommand('010D').catch(() => '');
    const rr = await sendCommand('010C').catch(() => '');
    const tr = await sendCommand('0111').catch(() => '');
    const er = await sendCommand('0105').catch(() => '');

    const tick = {
      speed:    parseSpeed(sr)    ?? 0,
      rpm:      parseRPM(rr)      ?? 800,
      throttle: parseThrottle(tr) ?? 0,
      temp:     parseTemp(er)     ?? 90,
      ts:       Date.now(),
      source:   'elm327',
    };
    elmStatus.lastData = tick;
    if (onDataCallback) onDataCallback(tick);
  } catch (err) {
    console.warn('[ELM] Error poll:', err.message);
  }
}

// ─── API pública ──────────────────────────────────────────────────────────────

export async function connectElm(portPath = DEFAULT_PORT, onData = null) {
  // Importación dinámica: si serialport no está instalado, lanza error claro
  let SerialPort, ReadlineParser;
  try {
    const sp  = await import('serialport');
    const rlp = await import('@serialport/parser-readline');
    SerialPort     = sp.SerialPort;
    ReadlineParser = rlp.ReadlineParser;
  } catch {
    throw new Error(
      'serialport no está instalado. Ejecuta: cd backend && npm install serialport\n' +
      'Requiere Visual Studio Build Tools en Windows.'
    );
  }

  onDataCallback  = onData;
  elmStatus.port  = portPath;

  return new Promise((resolve, reject) => {
    port = new SerialPort({ path: portPath, baudRate: BAUD_RATE });
    parser = port.pipe(new ReadlineParser({ delimiter: '>' }));
    parser.on('data', handleData);

    port.on('open', async () => {
      try {
        await initElm();
        elmStatus.connected = true;
        elmStatus.lastError = null;
        pollTimer = setInterval(pollTelemetry, POLL_MS);
        console.log('[ELM] ✅ Conectado y leyendo OBD2');
        resolve(true);
      } catch (err) {
        elmStatus.connected = false;
        elmStatus.lastError = err.message;
        reject(err);
      }
    });

    port.on('error', (err) => {
      elmStatus.connected = false;
      elmStatus.lastError = err.message;
      reject(err);
    });

    port.on('close', () => {
      elmStatus.connected = false;
      clearInterval(pollTimer);
    });
  });
}

export async function disconnectElm() {
  clearInterval(pollTimer);
  if (port?.isOpen) await new Promise(r => port.close(r));
  port = null;
  elmStatus.connected = false;
}

export function getElmStatus() {
  return { ...elmStatus };
}

export async function listPorts() {
  try {
    const { SerialPort } = await import('serialport');
    const ports = await SerialPort.list();
    return ports.map(p => ({ path: p.path, manufacturer: p.manufacturer }));
  } catch {
    return [];
  }
}
