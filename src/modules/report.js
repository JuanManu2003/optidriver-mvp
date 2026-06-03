/**
 * report.js — Genera y exporta reportes de conducción en CSV y PDF.
 *
 * Las proyecciones usan los datos del perfil (plataforma y horas de conducción)
 * para extrapolar ahorro/gasto diario y mensual a partir de la sesión actual.
 */

import { getUser } from './storage.js';
import { getSessionSummary } from './sessionAnalytics.js';
import { formatCLP, FUEL_PRICE_CLP, BASELINE_FUEL_PER_100 } from './analytics.js';
import { tripsApi, insightsApi } from './api.js';

// Promedio de días trabajados al mes para conductores de apps en Chile
const WORK_DAYS_PER_MONTH = 24;

/**
 * Calcula proyecciones basadas en la sesión actual y el perfil del conductor.
 * Aquí es donde "horas de conducción" y "plataforma" influyen de verdad.
 */
// Velocidad urbana promedio (km/h) para estimar km a partir de horas conducidas.
const AVG_URBAN_KMH = 28;

/**
 * Proyección de gasto/ahorro mensual, basada en:
 *  - la eficiencia REAL medida en los viajes recientes (L/100 promedio), y
 *  - las horas/día que declara el conductor en su perfil.
 * Estable aunque no haya un viaje en curso (usa el historial, no la sesión).
 */
export async function buildProjections() {
  const user = getUser();
  const hoursPerDay = Number(user.drivingHoursPerDay) || 8;

  // Eficiencia promedio real de los últimos viajes (si no hay, usa baseline)
  let avgFuel = BASELINE_FUEL_PER_100;
  try {
    const trips = await tripsApi.list(10);
    const valid = trips.filter((t) => t.avgFuelPer100 > 0);
    if (valid.length) {
      avgFuel = valid.reduce((s, t) => s + t.avgFuelPer100, 0) / valid.length;
    }
  } catch { /* sin datos: baseline */ }

  const kmPerDay = hoursPerDay * AVG_URBAN_KMH;
  const litersPerDay = (kmPerDay * avgFuel) / 100;
  const fuelCostPerDay = litersPerDay * FUEL_PRICE_CLP;
  // Ahorro vs conductor promedio (baseline): positivo si consumes menos.
  const savedPerDay = ((BASELINE_FUEL_PER_100 - avgFuel) / 100) * kmPerDay * FUEL_PRICE_CLP;

  const r = (n) => Math.round(n);

  return {
    platform: user.platform || 'Uber',
    hoursPerDay,
    avgFuel: Number(avgFuel.toFixed(1)),
    perDay: {
      savingsClp: r(savedPerDay),
      fuelCostClp: r(fuelCostPerDay),
      km: r(kmPerDay),
      liters: Number(litersPerDay.toFixed(1)),
    },
    perMonth: {
      savingsClp: r(savedPerDay * WORK_DAYS_PER_MONTH),
      fuelCostClp: r(fuelCostPerDay * WORK_DAYS_PER_MONTH),
      km: r(kmPerDay * WORK_DAYS_PER_MONTH),
      liters: Number((litersPerDay * WORK_DAYS_PER_MONTH).toFixed(0)),
    },
  };
}

/**
 * Reúne todos los datos del reporte (perfil, hábitos, viajes, proyecciones).
 */
export async function buildReportData() {
  const user = getUser();
  const session = getSessionSummary();
  const projections = await buildProjections();

  let trips = [];
  try {
    trips = await tripsApi.list(50);
  } catch {
    trips = [];
  }

  // Hábitos y score desde el histórico (mismo dato que la pantalla Insights);
  // si no hay datos en backend, usa la sesión actual como respaldo.
  let habits = session.habitScores;
  let avgScore = session.avgScore;
  try {
    const ins = await insightsApi.get();
    if (ins?.habits) {
      habits = {
        braking: ins.habits.braking,
        acceleration: ins.habits.acceleration,
        steadySpeed: ins.habits.steadySpeed,
      };
      avgScore = ins.habits.avgScore ?? avgScore;
    }
  } catch { /* respaldo a la sesión */ }

  return {
    generatedAt: new Date(),
    driver: {
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || 'Conductor',
      email: user.email || '—',
      city: user.city || '—',
      platform: user.platform || '—',
      hoursPerDay: projections.hoursPerDay,
    },
    habits,
    avgScore,
    projections,
    trips,
  };
}

// ─── Exportar CSV ──────────────────────────────────────────────────────────────

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportCSV(data) {
  const rows = [];
  rows.push(['Reporte OptiDriver', data.generatedAt.toLocaleString('es-CL')]);
  rows.push([]);
  rows.push(['Conductor', data.driver.name]);
  rows.push(['Correo', data.driver.email]);
  rows.push(['Ciudad', data.driver.city]);
  rows.push(['Plataforma', data.driver.platform]);
  rows.push(['Horas/día', data.driver.hoursPerDay]);
  rows.push([]);
  rows.push(['Hábitos (0-100)']);
  rows.push(['Frenada', data.habits.braking]);
  rows.push(['Aceleración', data.habits.acceleration]);
  rows.push(['Velocidad constante', data.habits.steadySpeed]);
  rows.push(['Score promedio', data.avgScore]);
  rows.push([]);
  rows.push(['Proyección diaria', 'Ahorro CLP', data.projections.perDay.savingsClp, 'Km', data.projections.perDay.km, 'Litros', data.projections.perDay.liters]);
  rows.push(['Proyección mensual', 'Ahorro CLP', data.projections.perMonth.savingsClp, 'Km', data.projections.perMonth.km, 'Litros', data.projections.perMonth.liters]);
  rows.push([]);
  rows.push(['VIAJES']);
  rows.push(['Fecha', 'Distancia (km)', 'Duración (min)', 'Vel. media', 'RPM media', 'L/100km', 'Score', 'Costo CLP', 'Ahorro CLP']);

  data.trips.forEach((t) => {
    rows.push([
      t.startedAt ? new Date(t.startedAt).toLocaleString('es-CL') : '—',
      t.distanceKm ?? 0,
      t.durationMin ?? 0,
      t.avgSpeed ?? 0,
      t.avgRpm ?? 0,
      t.avgFuelPer100 ?? 0,
      t.score ?? 0,
      t.costClp ?? 0,
      t.savingsClp ?? 0,
    ]);
  });

  // Escapar y unir
  const csv = rows
    .map((r) => r.map((cell) => {
      const s = String(cell ?? '');
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(';'))
    .join('\n');

  // BOM para que Excel reconozca UTF-8 (acentos)
  downloadBlob('﻿' + csv, `optidriver-reporte-${dateStamp()}.csv`, 'text/csv;charset=utf-8');
}

// ─── Exportar PDF (vía ventana de impresión del navegador) ──────────────────────

export function exportPDF(data) {
  const tripRows = data.trips.length
    ? data.trips.map((t) => `
        <tr>
          <td>${t.startedAt ? new Date(t.startedAt).toLocaleDateString('es-CL') : '—'}</td>
          <td>${t.distanceKm ?? 0}</td>
          <td>${t.durationMin ?? 0}</td>
          <td>${t.avgSpeed ?? 0}</td>
          <td>${t.avgFuelPer100 ?? 0}</td>
          <td>${t.score ?? 0}</td>
          <td>$${formatCLP(t.costClp ?? 0)}</td>
        </tr>`).join('')
    : '<tr><td colspan="7" style="text-align:center;color:#888">Sin viajes registrados</td></tr>';

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Reporte OptiDriver</title>
<style>
  * { font-family: -apple-system, "Segoe UI", Arial, sans-serif; }
  body { color: #0F1419; padding: 32px; max-width: 800px; margin: 0 auto; }
  .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 2px; }
  .brand-logo { width: 44px; height: 44px; background: #0F1419; border-radius: 12px; padding: 7px; box-sizing: border-box; }
  .brand-name { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
  .brand-name span { color: #00A86B; }
  .report-title { color: #00A86B; font-size: 15px; margin: 2px 0 0; }
  .sub { color: #667085; font-size: 13px; margin-bottom: 24px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
  .box { border: 1px solid #E6E9EE; border-radius: 10px; padding: 14px; }
  .box strong { font-size: 22px; display:block; }
  .label { color: #667085; font-size: 12px; text-transform: uppercase; }
  .big { font-size: 26px; color:#00A86B; font-weight:700; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
  th, td { border: 1px solid #E6E9EE; padding: 7px 9px; text-align: left; }
  th { background: #F1F3F6; }
  h2 { font-size: 15px; margin: 22px 0 6px; border-bottom: 2px solid #00A86B; padding-bottom: 4px; }
  @media print { body { padding: 0; } }
</style></head>
<body>
  <div class="brand">
    <svg class="brand-logo" viewBox="0 0 100 100" fill="none">
      <path d="M52 7C36 27 22 45 22 65C22 84 36 94 52 94C68 94 82 84 82 65C82 45 68 27 52 7Z" fill="#F5F7FA"/>
      <path d="M41 35H68L62 45H38C32 45 29 52 34 56L63 78H43L25 64C14 55 21 35 41 35Z" fill="#050608"/>
      <path d="M23 64C43 70 56 79 67 94C52 96 38 92 28 82C24 78 22 72 23 64Z" fill="#00C781"/>
      <path d="M35 70C50 75 60 85 67 94" stroke="#F5F7FA" stroke-width="5" stroke-linecap="round"/>
      <path d="M20 63L10 60M22 72L13 76M27 80L20 88" stroke="#050608" stroke-width="4" stroke-linecap="round"/>
    </svg>
    <div>
      <div class="brand-name">Fuel<span>Sense</span></div>
      <p class="report-title">Reporte de conducción</p>
    </div>
  </div>
  <p class="sub">Generado el ${data.generatedAt.toLocaleString('es-CL')}</p>

  <h2>Conductor</h2>
  <p><strong>${data.driver.name}</strong> · ${data.driver.email}<br>
  ${data.driver.city} · Plataforma: <b>${data.driver.platform}</b> · ${data.driver.hoursPerDay} h/día</p>

  <h2>Hábitos de conducción</h2>
  <div class="grid">
    <div class="box"><span class="label">Frenada</span><strong>${data.habits.braking}/100</strong></div>
    <div class="box"><span class="label">Aceleración</span><strong>${data.habits.acceleration}/100</strong></div>
    <div class="box"><span class="label">Velocidad constante</span><strong>${data.habits.steadySpeed}/100</strong></div>
    <div class="box"><span class="label">Score promedio</span><strong>${data.avgScore}/100</strong></div>
  </div>

  <h2>Proyección de ahorro (según ${data.driver.hoursPerDay} h/día)</h2>
  <div class="grid">
    <div class="box"><span class="label">Por día</span><span class="big">$${formatCLP(data.projections.perDay.savingsClp)}</span><br>${data.projections.perDay.km} km · ${data.projections.perDay.liters} L</div>
    <div class="box"><span class="label">Por mes (24 días)</span><span class="big">$${formatCLP(data.projections.perMonth.savingsClp)}</span><br>${data.projections.perMonth.km} km · ${data.projections.perMonth.liters} L</div>
  </div>

  <h2>Historial de viajes (${data.trips.length})</h2>
  <table>
    <thead><tr><th>Fecha</th><th>Km</th><th>Min</th><th>Vel.</th><th>L/100</th><th>Score</th><th>Costo</th></tr></thead>
    <tbody>${tripRows}</tbody>
  </table>

  <p class="sub" style="margin-top:24px">Usa "Guardar como PDF" en el destino de impresión para descargar este reporte.</p>
  <script>window.onload = () => { window.print(); };<\/script>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) {
    alert('Habilita las ventanas emergentes para exportar el PDF.');
    return false;
  }
  win.document.write(html);
  win.document.close();
  return true;
}

function dateStamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
