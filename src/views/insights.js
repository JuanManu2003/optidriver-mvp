import { insightsApi } from '../modules/api.js';
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

function renderProjections() {
  const p = buildProjections();

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
  });
}
