/**
 * routes/trips.js — Sesiones de conducción.
 * POST /api/trips/start       → inicia un viaje, retorna tripId
 * POST /api/trips/:id/end     → cierra el viaje con resumen final
 * GET  /api/trips             → listado de viajes del usuario
 * GET  /api/trips/summary     → resumen semanal
 */

import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.post('/start', (req, res) => {
  const { vehicleId, source } = req.body;
  const result = db.prepare(`
    INSERT INTO trips (userId, vehicleId, startedAt, source)
    VALUES (?, ?, datetime('now'), ?)
  `).run(req.userId, vehicleId || null, source || 'simulator');

  res.status(201).json({ tripId: result.lastInsertRowid });
});

router.post('/:id/end', (req, res) => {
  const trip = db.prepare('SELECT id FROM trips WHERE id = ? AND userId = ?').get(req.params.id, req.userId);
  if (!trip) return res.status(404).json({ error: 'Viaje no encontrado' });

  const {
    distanceKm = 0, durationMin = 0, avgSpeed = 0, avgRpm = 0,
    avgFuelPer100 = 0, score = 0, costClp = 0, savingsClp = 0,
    lossClp = 0, harshBrakes = 0, harshAccels = 0, idleSeconds = 0,
  } = req.body;

  db.prepare(`
    UPDATE trips SET
      endedAt = datetime('now'), distanceKm = ?, durationMin = ?,
      avgSpeed = ?, avgRpm = ?, avgFuelPer100 = ?, score = ?,
      costClp = ?, savingsClp = ?, lossClp = ?,
      harshBrakes = ?, harshAccels = ?, idleSeconds = ?
    WHERE id = ?
  `).run(distanceKm, durationMin, avgSpeed, avgRpm, avgFuelPer100, score,
         costClp, savingsClp, lossClp, harshBrakes, harshAccels, idleSeconds, req.params.id);

  res.json({ ok: true });
});

router.get('/', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const trips = db.prepare(`
    SELECT t.*, v.brand || ' ' || v.model AS vehicleName
    FROM trips t LEFT JOIN vehicles v ON t.vehicleId = v.id
    WHERE t.userId = ? AND t.endedAt IS NOT NULL
    ORDER BY t.startedAt DESC LIMIT ?
  `).all(req.userId, limit);

  res.json(trips);
});

router.get('/summary', (req, res) => {
  const row = db.prepare(`
    SELECT
      COUNT(*) AS tripCount,
      ROUND(SUM(distanceKm), 1) AS totalKm,
      ROUND(AVG(score)) AS avgScore,
      SUM(savingsClp) AS savingsClp,
      SUM(lossClp) AS lossClp,
      SUM(harshBrakes) AS harshBrakes,
      SUM(harshAccels) AS harshAccels
    FROM trips
    WHERE userId = ? AND endedAt IS NOT NULL
      AND startedAt >= datetime('now', '-7 days')
  `).get(req.userId);

  res.json(row || {});
});

export default router;
