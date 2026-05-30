/**
 * routes/vehicles.js — CRUD de vehículos del usuario autenticado.
 * GET    /api/vehicles
 * POST   /api/vehicles
 * PUT    /api/vehicles/:id
 * DELETE /api/vehicles/:id
 */

import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const vehicles = db.prepare('SELECT * FROM vehicles WHERE userId = ? ORDER BY isDefault DESC, id DESC').all(req.userId);
  res.json(vehicles);
});

router.post('/', (req, res) => {
  const { brand, model, year, fuelType, engineCC, plateNum } = req.body;
  if (!brand || !model || !year) {
    return res.status(400).json({ error: 'brand, model y year son obligatorios' });
  }

  // Quitar default de los anteriores si este será el default
  db.prepare('UPDATE vehicles SET isDefault = 0 WHERE userId = ?').run(req.userId);

  const result = db.prepare(`
    INSERT INTO vehicles (userId, brand, model, year, fuelType, engineCC, plateNum, isDefault)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(req.userId, brand, model, Number(year), fuelType || 'gasoline', engineCC || null, plateNum || null);

  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', (req, res) => {
  const vehicle = db.prepare('SELECT id FROM vehicles WHERE id = ? AND userId = ?').get(req.params.id, req.userId);
  if (!vehicle) return res.status(404).json({ error: 'Vehículo no encontrado' });

  const { brand, model, year, fuelType, engineCC, plateNum } = req.body;
  db.prepare(`
    UPDATE vehicles SET brand = COALESCE(?, brand), model = COALESCE(?, model),
    year = COALESCE(?, year), fuelType = COALESCE(?, fuelType),
    engineCC = COALESCE(?, engineCC), plateNum = COALESCE(?, plateNum)
    WHERE id = ?
  `).run(brand || null, model || null, year ? Number(year) : null, fuelType || null, engineCC || null, plateNum || null, req.params.id);

  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM vehicles WHERE id = ? AND userId = ?').run(req.params.id, req.userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Vehículo no encontrado' });
  res.json({ ok: true });
});

export default router;
