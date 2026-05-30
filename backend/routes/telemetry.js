/**
 * routes/telemetry.js — Recibe ticks de telemetría OBD2 vía HTTP POST.
 * También expone el estado del ELM en tiempo real.
 *
 * POST /api/telemetry/:tripId/tick  → guarda un tick en la BD
 * GET  /api/telemetry/status        → estado de la conexión ELM
 */

import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { getElmStatus } from '../elm/elmReader.js';

const router = Router();
router.use(requireAuth);

router.post('/:tripId/tick', (req, res) => {
  const { speed, rpm, fuel, score, mode } = req.body;
  const tripId = Number(req.params.tripId);

  // Verificar que el viaje pertenece al usuario
  const trip = db.prepare('SELECT id FROM trips WHERE id = ? AND userId = ?').get(tripId, req.userId);
  if (!trip) return res.status(404).json({ error: 'Viaje no encontrado' });

  db.prepare(`
    INSERT INTO telemetry_ticks (tripId, speed, rpm, fuel, score, mode)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(tripId, speed, rpm, fuel, score, mode || null);

  res.json({ ok: true });
});

router.get('/status', (req, res) => {
  res.json(getElmStatus());
});

export default router;
