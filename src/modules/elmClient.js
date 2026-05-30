/**
 * elmClient.js — Conexión directa al ELM327 desde el navegador vía Web Serial API.
 *
 * Web Serial API permite que el navegador acceda a puertos serie (USB) sin servidor.
 * Requiere Chrome/Edge 89+ con HTTPS o localhost, y el flag experimental activado.
 *
 * Uso alternativo al backend: cuando el usuario conecta el ELM por USB directamente
 * al PC, la app puede leer OBD2 sin pasar por Node.js.
 *
 * IMPORTANTE: En producción se recomienda usar el backend (elmReader.js) para
 * mayor compatibilidad. Este módulo es el camino "browser-only".
 */

// ─── Constantes OBD2 ─────────────────────────────────────────────────────────
const CMDS = {
  SPEED:   '010D\r',
  RPM:     '010C\r',
  THROTTLE:'0111\r',
  TEMP:    '0105\r',
};

const BAUD_RATE = 38400;

// ─── Estado ───────────────────────────────────────────────────────────────────
let serialPort   = null;
let reader       = null;
let writer       = null;
let pollTimer    = null;
let onDataCb     = null;
let elmConnected = false;

// ─── Utilidades de parseo ─────────────────────────────────────────────────────

function parseHex(h) { return parseInt(h, 16); }

function extractSpeed(raw) {
  const m = raw.match(/410D([0-9A-Fa-f]{2})/);
  return m ? parseHex(m[1]) : null;
}

function extractRPM(raw) {
  const m = raw.match(/410C([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})/);
  return m ? Math.round(((parseHex(m[1]) * 256) + parseHex(m[2])) / 4) : null;
}

function extractThrottle(raw) {
  const m = raw.match(/4111([0-9A-Fa-f]{2})/);
  return m ? Math.round((parseHex(m[1]) / 255) * 100) : null;
}

function extractTemp(raw) {
  const m = raw.match(/4105([0-9A-Fa-f]{2})/);
  return m ? parseHex(m[1]) - 40 : null;
}

// ─── Comunicación serie ───────────────────────────────────────────────────────

async function writeCmd(cmd) {
  if (!writer) return;
  const enc = new TextEncoder();
  await writer.write(enc.encode(cmd));
}

async function readResponse(timeoutMs = 2000) {
  const dec = new TextDecoder();
  let buffer = '';
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { value, done } = await Promise.race([
      reader.read(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 300)),
    ]).catch(() => ({ value: null, done: true }));

    if (done || !value) break;
    buffer += dec.decode(value);
    if (buffer.includes('>')) break; // ELM termina cada respuesta con '>'
  }

  return buffer.replace(/[\r\n>]/g, ' ').replace(/\s+/g, '').trim();
}

async function sendCmd(cmd, timeout = 2000) {
  await writeCmd(cmd);
  return readResponse(timeout);
}

// ─── Inicialización ───────────────────────────────────────────────────────────

async function initSequence() {
  const steps = ['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATSP0', '0100'];
  for (const cmd of steps) {
    await sendCmd(`${cmd}\r`, 3000);
    await new Promise(r => setTimeout(r, 300));
  }
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Solicita permiso al usuario para acceder al puerto serie y conecta el ELM327.
 * @param {function} onData   Callback({ speed, rpm, throttle, temp, ts, source })
 * @param {number}   pollMs   Frecuencia de lectura en ms (default 600)
 */
export async function connectBrowserElm(onData, pollMs = 600) {
  if (!('serial' in navigator)) {
    throw new Error('Tu navegador no soporta Web Serial API. Usa Chrome/Edge 89+.');
  }

  // Pedir al usuario que seleccione el puerto
  serialPort = await navigator.serial.requestPort();
  await serialPort.open({ baudRate: BAUD_RATE });

  reader = serialPort.readable.getReader();
  writer = serialPort.writable.getWriter();
  onDataCb = onData;

  await initSequence();
  elmConnected = true;

  console.log('[ELM-Browser] Conectado. Iniciando lectura OBD2...');

  pollTimer = setInterval(async () => {
    try {
      await writeCmd(CMDS.SPEED);
      const speedRaw = await readResponse(800);
      await writeCmd(CMDS.RPM);
      const rpmRaw = await readResponse(800);
      await writeCmd(CMDS.THROTTLE);
      const throttleRaw = await readResponse(800);
      await writeCmd(CMDS.TEMP);
      const tempRaw = await readResponse(800);

      const tick = {
        speed:    extractSpeed(speedRaw)    ?? 0,
        rpm:      extractRPM(rpmRaw)        ?? 800,
        throttle: extractThrottle(throttleRaw) ?? 0,
        temp:     extractTemp(tempRaw)      ?? 90,
        ts:       Date.now(),
        source:   'elm327-browser',
      };

      if (onDataCb) onDataCb(tick);
    } catch (err) {
      console.warn('[ELM-Browser] Error de lectura:', err.message);
    }
  }, pollMs);
}

/**
 * Desconecta el puerto serie.
 */
export async function disconnectBrowserElm() {
  clearInterval(pollTimer);
  pollTimer = null;
  elmConnected = false;

  try {
    reader?.releaseLock();
    writer?.releaseLock();
    await serialPort?.close();
  } catch { /* ignorar errores al cerrar */ }

  serialPort = null;
  reader = null;
  writer = null;
}

export function isBrowserElmConnected() {
  return elmConnected;
}

/**
 * Indica si el navegador actual soporta Web Serial API.
 */
export function supportsWebSerial() {
  return 'serial' in navigator;
}
