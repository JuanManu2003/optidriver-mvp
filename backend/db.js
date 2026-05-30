/**
 * db.js — SQLite vía sql.js (puro WebAssembly, sin compilación nativa).
 *
 * sql.js opera en memoria. Este módulo añade:
 *  - Carga desde archivo al arrancar
 *  - Guardado a archivo en cada escritura (debounced 200 ms)
 *  - API compatible con better-sqlite3: prepare().get/all/run + lastInsertRowid
 */

import { createRequire } from 'module';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const initSqlJs = require('sql.js');

const __dir  = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dir, 'optidriver.db');

// ─── Inicialización (top-level await en ESM) ──────────────────────────────────

const SQL = await initSqlJs();

const db = existsSync(DB_PATH)
  ? new SQL.Database(readFileSync(DB_PATH))
  : new SQL.Database();

// ─── Persistencia automática ──────────────────────────────────────────────────

let saveTimer = null;

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const data = db.export();
    writeFileSync(DB_PATH, Buffer.from(data));
  }, 200);
}

// ─── Esquema ──────────────────────────────────────────────────────────────────

db.run(`PRAGMA foreign_keys = ON`);

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    firstName  TEXT NOT NULL,
    lastName   TEXT NOT NULL,
    email      TEXT NOT NULL UNIQUE,
    password   TEXT NOT NULL,
    phone      TEXT,
    city       TEXT,
    createdAt  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    userId     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    brand      TEXT NOT NULL,
    model      TEXT NOT NULL,
    year       INTEGER NOT NULL,
    fuelType   TEXT DEFAULT 'gasoline',
    engineCC   INTEGER,
    plateNum   TEXT,
    isDefault  INTEGER DEFAULT 1,
    createdAt  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS trips (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    userId          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicleId       INTEGER REFERENCES vehicles(id),
    startedAt       TEXT NOT NULL,
    endedAt         TEXT,
    distanceKm      REAL DEFAULT 0,
    durationMin     REAL DEFAULT 0,
    avgSpeed        REAL DEFAULT 0,
    avgRpm          REAL DEFAULT 0,
    avgFuelPer100   REAL DEFAULT 0,
    score           INTEGER DEFAULT 0,
    costClp         INTEGER DEFAULT 0,
    savingsClp      INTEGER DEFAULT 0,
    lossClp         INTEGER DEFAULT 0,
    harshBrakes     INTEGER DEFAULT 0,
    harshAccels     INTEGER DEFAULT 0,
    idleSeconds     INTEGER DEFAULT 0,
    source          TEXT DEFAULT 'simulator',
    createdAt       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS telemetry_ticks (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    tripId    INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    ts        TEXT DEFAULT (datetime('now')),
    speed     REAL,
    rpm       REAL,
    fuel      REAL,
    score     INTEGER,
    mode      TEXT
  );

  CREATE TABLE IF NOT EXISTS insights (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    userId    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week      TEXT NOT NULL,
    braking   INTEGER DEFAULT 0,
    accel     INTEGER DEFAULT 0,
    steady    INTEGER DEFAULT 0,
    tipKey    TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );
`);

scheduleSave();

// ─── Capa de compatibilidad con better-sqlite3 ────────────────────────────────
//
// Expone: db.prepare(sql).get(...params) / .all(...params) / .run(...params)
// .run() retorna { lastInsertRowid, changes }
//

function toArray(params) {
  if (!params || params.length === 0) return [];
  // sql.js acepta array posicional o objeto; normalizamos a array
  return Array.isArray(params[0]) ? params[0] : params;
}

function colsToObject(stmt) {
  const cols = stmt.getColumnNames();
  const vals = stmt.get();
  if (!vals) return undefined;
  const obj = {};
  cols.forEach((c, i) => { obj[c] = vals[i]; });
  return obj;
}

const dbProxy = {
  prepare(sql) {
    return {
      // Retorna el primer resultado como objeto plano, o undefined
      get(...params) {
        const stmt = db.prepare(sql);
        stmt.bind(toArray(params));
        const row = stmt.step() ? colsToObject(stmt) : undefined;
        stmt.free();
        return row;
      },
      // Retorna todos los resultados como array de objetos
      all(...params) {
        const stmt = db.prepare(sql);
        stmt.bind(toArray(params));
        const cols = stmt.getColumnNames();
        const rows = [];
        while (stmt.step()) {
          const obj = {};
          const vals = stmt.get();
          cols.forEach((c, i) => { obj[c] = vals[i]; });
          rows.push(obj);
        }
        stmt.free();
        return rows;
      },
      // Ejecuta INSERT/UPDATE/DELETE; retorna { lastInsertRowid, changes }
      run(...params) {
        const stmt = db.prepare(sql);
        stmt.bind(toArray(params));
        stmt.step();
        stmt.free();
        const lastInsertRowid = db.exec('SELECT last_insert_rowid()')[0]?.values[0][0] ?? 0;
        const changes = db.getRowsModified();
        scheduleSave();
        return { lastInsertRowid, changes };
      },
    };
  },

  // Ejecuta SQL sin parámetros (DDL, PRAGMAs)
  exec(sql) {
    db.run(sql);
    scheduleSave();
  },
};

export default dbProxy;
