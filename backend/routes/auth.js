/**
 * routes/auth.js — Registro e inicio de sesión con JWT.
 * POST /api/auth/register
 * POST /api/auth/login
 * GET  /api/auth/me  (requiere token)
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req, res) => {
  const { firstName, lastName, email, password, phone, city } = req.body;

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'Campos obligatorios: firstName, lastName, email, password' });
  }

  const emailNorm = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(emailNorm);
  if (existing) {
    return res.status(409).json({ error: 'El correo ya está registrado' });
  }

  const hash = await bcrypt.hash(password, 10);

  const result = db.prepare(`
    INSERT INTO users (firstName, lastName, email, password, phone, city)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(firstName.trim(), lastName.trim(), emailNorm, hash, phone || null, city || null);

  const token = signToken(result.lastInsertRowid);
  res.status(201).json({ token, userId: result.lastInsertRowid });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Correo y contraseña requeridos' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  const token = signToken(user.id);
  res.json({
    token,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      city: user.city,
    },
  });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, firstName, lastName, email, phone, city, createdAt FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(user);
});

export default router;
