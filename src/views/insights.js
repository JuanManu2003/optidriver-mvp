import { insightsApi, tripsApi } from '../modules/api.js';
import { showToast, formatCLP } from '../modules/telemetrySimulator.js';
import { getSessionSummary } from '../modules/sessionAnalytics.js';
import { getRecommendation } from '../modules/recommendations.js';
import { bindAction } from '../components/Button.js';
import { buildProjections, buildReportData, exportCSV, exportPDF } from '../modules/report.js';

function updateHabit(barId, scoreId, score, warningStyle = false) {
  const bar     = document.getElementById(barId);
  const scoreEl = document.getElementById(scoreId);
  if (scoreEl) scoreEl.textContent = `${score}/100`;
  if (bar) {
    bar.style.width      = `${score}%`;
    bar.style.background = warningStyle && score < 80 ? 'var(--warning)' : 'var(--accent)';
  }
}

function renderHabits(habits) {
  updateHabit('habitBraking',      'habitBrakingScore',      habits.braking);
  updateHabit('habitAcceleration', 'habitAccelerationScore', habits.acceleration, true);
  updateHabit('habitSteady',       'habitSteadyScore',       habits.steadySpeed);
}

function renderTip(tip) {
  const titleEl = document.getElementById('tipTitle');
  const bodyEl  = document.getElementById('tipBody');
  if (titleEl) titleEl.textContent = tip.title;
  if (bodyEl)  bodyEl.textContent  = tip.body;
}

function renderWeeklyStats(stats) {
  const kmEl      = document.getElementById('insightsTotalKm');
  const tripsEl   = document.getElementById('insightsTripCount');
  const savingsEl = document.getElementById('insightsSavings');

  if (kmEl)      kmEl.textContent      = `${stats.totalKm ?? 0} km`;
  if (tripsEl)   tripsEl.textContent   = String(stats.tripCount ?? 0);
  if (savingsEl) savingsEl.textContent = `$${(stats.savingsClp ?? 0).toLocaleString('es-CL')} CLP`;
}

async function renderProjections() {
  const p = await buildProjections();

  const spendEl   = document.getElementById('projDaily');
  const savingsEl = document.getElementById('projMonthly');
  const ctxEl     = document.getElementById('projectionContext');
  const detailEl  = document.getElementById('projDetail');

  const sign = (v) => (v >= 0 ? '$' : '-$') + formatCLP(Math.abs(v));

  // Headline izquierda: gasto mensual de combustible (depende de horas/día)
  if (spendEl) spendEl.textContent = `$${formatCLP(p.perMonth.fuelCostClp)}`;
  // Headline derecha: ahorro mensual vs conductor promedio
  if (savingsEl) savingsEl.textContent = sign(p.perMonth.savingsClp);

  if (ctxEl) ctxEl.textContent = `En ${p.platform} a ~${p.hoursPerDay} h/día (≈${p.perMonth.km} km/mes).`;
  if (detailEl) detailEl.textContent = p.perMonth.savingsClp >= 0
    ? `Ahorras ~$${formatCLP(p.perMonth.savingsClp)}/mes frente a un conductor promedio. ${p.perMonth.liters} L/mes.`
    : `Gastas ~$${formatCLP(Math.abs(p.perMonth.savingsClp))}/mes más que el promedio. Mejora tus hábitos.`;
}

async function renderTripChart() {
  const cont = document.getElementById('tripChart');
  if (!cont) return;

  let trips = [];
  try { trips = await tripsApi.list(7); } catch { trips = []; }

  if (!trips.length) {
    cont.innerHTML = '<p class="small muted" style="text-align:center;padding:18px 0">Aún no tienes viajes. Completa uno para ver tu progreso.</p>';
    return;
  }

  // Orden cronológico (los más antiguos a la izquierda) y score por viaje
  const scores = trips.map((t) => t.score || 0).reverse();
  const W = 330, H = 120, pad = 10;
  const stepX = scores.length > 1 ? (W - pad * 2) / (scores.length - 1) : 0;
  const y = (s) => H - pad - (s / 100) * (H - pad * 2);
  const pts = scores.map((s, i) => `${pad + i * stepX},${y(s)}`);

  const dots = scores.map((s, i) => {
    const color = s >= 85 ? '#00A86B' : s >= 75 ? '#E5A000' : '#E5484D';
    return `<circle cx="${pad + i * stepX}" cy="${y(s)}" r="4.5" fill="${color}" />
            <text x="${pad + i * stepX}" y="${y(s) - 9}" font-size="11" fill="#667085" text-anchor="middle">${s}</text>`;
  }).join('');

  cont.innerHTML = `
    <svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:130px">
      <line x1="0" y1="${H - pad}" x2="${W}" y2="${H - pad}" stroke="#E6E9EE" stroke-width="1"/>
      ${scores.length > 1 ? `<polyline points="${pts.join(' ')}" fill="none" stroke="#00A86B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
      ${dots}
    </svg>
    <p class="small muted" style="text-align:center">Cada punto es un viaje (verde=excelente, amarillo=bueno, rojo=mejorable).</p>
  `;
}

async function loadInsights() {
  try {
    const data = await insightsApi.get();

    if (data.habits) {
      renderHabits(data.habits);
    } else {
      // Sin datos de backend → usar sesión local
      const local = getSessionSummary();
      renderHabits(local.habitScores);
    }

    if (data.tip)         renderTip(data.tip);
    if (data.weeklyStats) renderWeeklyStats(data.weeklyStats);

  } catch {
    // Fallback a sesión local
    const session = getSessionSummary();
    renderHabits(session.habitScores);
    renderTip(getRecommendation(session));
  }
}

export function initInsights() {
  bindAction('[data-action="export-csv"]', async () => {
    showToast('Generando CSV', 'Preparando tu reporte...');
    const data = await buildReportData();
    exportCSV(data);
  });

  bindAction('[data-action="export-pdf"]', async () => {
    showToast('Generando PDF', 'Abriendo el reporte para imprimir/guardar...');
    const data = await buildReportData();
    exportPDF(data);
  });

  document.addEventListener('screenchange', (e) => {
    if (e.detail?.screenId !== 'insights') return;
    loadInsights();
    renderProjections();
    renderTripChart();
  });
}
