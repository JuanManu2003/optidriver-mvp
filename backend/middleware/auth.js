/**
 * middleware/auth.js — Verifica JWT en cabecera Authorization.
 * Agrega req.userId con el id del usuario autenticado.
 */

import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'optidriver_secret_dev_2024';

export function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

export function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}
