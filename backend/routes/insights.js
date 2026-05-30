/**
 * routes/insights.js — Recomendaciones dinámicas basadas en telemetría histórica.
 * GET /api/insights → devuelve tips y métricas de hábitos del usuario
 */

import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const TIPS = [
  { key: 'rpm_high',    title: 'Controla las RPM',         body: 'Mantén las revoluciones entre 1.500 y 2.500 RPM para maximizar eficiencia. Cambiar de marcha más temprano puede ahorrarte hasta un 15% de combustible.' },
  { key: 'harsh_brake', title: 'Frena con anticipación',   body: 'Cada frenada brusca desperdicia energía cinética. Anticipar el tráfico y levantar el pie del acelerador con tiempo reduce tu consumo notablemente.' },
  { key: 'harsh_accel', title: 'Acelera suavemente',       body: 'Aceleraciones bruscas disparan el consumo. Incrementa la velocidad de forma progresiva y usa la inercia del vehículo a tu favor.' },
  { key: 'idle',        title: 'Evita el ralentí',         body: 'Más de 1 minuto detenido consume entre 0.5 y 1 L/hora sin avanzar un metro. Si la parada es larga, apaga el motor.' },
  { key: 'optimal',     title: '¡Conducción excelente!',   body: 'Tus hábitos están en la zona óptima. Mantén la velocidad constante entre 50–80 km/h y seguirás ahorrando en cada viaje.' },
];

function chooseTip(braking, accel, steady) {
  if (braking < 65) return TIPS.find(t => t.key === 'harsh_brake');
  if (accel < 65)   return TIPS.find(t => t.key === 'harsh_accel');
  if (steady < 70)  return TIPS.find(t => t.key === 'rpm_high');
  return TIPS.find(t => t.key === 'optimal');
}

router.get('/', (req, res) => {
  // Calcular hábitos en base a últimos 10 viajes
  const row = db.prepare(`
    SELECT
      AVG(score)                    AS avgScore,
      SUM(harshBrakes)              AS totalBrakes,
      SUM(harshAccels)              AS totalAccels,
      SUM(idleSeconds)              AS totalIdle,
      COUNT(*)                      AS tripCount,
      SUM(distanceKm)               AS totalKm,
      SUM(savingsClp)               AS savingsClp
    FROM (
      SELECT * FROM trips
      WHERE userId = ? AND endedAt IS NOT NULL
      ORDER BY startedAt DESC LIMIT 10
    )
  `).get(req.userId);

  if (!row || !row.tripCount) {
    return res.json({ message: 'Sin datos aún. Completa al menos un viaje.', habits: null, tip: TIPS[4] });
  }

  // Convertir eventos en scores 0-100
  const tripsN = row.tripCount || 1;
  const brakingScore  = Math.max(0, Math.min(100, Math.round(100 - (row.totalBrakes / tripsN) * 12)));
  const accelScore    = Math.max(0, Math.min(100, Math.round(100 - (row.totalAccels / tripsN) * 12)));
  const idleMinAvg    = (row.totalIdle / tripsN) / 60;
  const steadyScore   = Math.max(0, Math.min(100, Math.round(100 - idleMinAvg * 8)));

  const tip = chooseTip(brakingScore, accelScore, steadyScore);

  res.json({
    habits: {
      braking:     brakingScore,
      acceleration: accelScore,
      steadySpeed:  steadyScore,
      avgScore:     Math.round(row.avgScore || 0),
    },
    weeklyStats: {
      tripCount:   row.tripCount,
      totalKm:     Math.round(row.totalKm || 0),
      savingsClp:  Math.round(row.savingsClp || 0),
    },
    tip,
  });
});

export default router;
