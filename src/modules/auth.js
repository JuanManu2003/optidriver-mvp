/**
 * auth.js — Autenticación contra el backend (JWT) con fallback localStorage para MVP offline.
 *
 * Modo online: llama al backend real y guarda el token JWT.
 * Modo offline: replica el comportamiento original sin backend.
 */

import { authApi, setToken, clearToken, getToken } from './api.js';
import { getUser, updateUser } from './storage.js';

// ─── Backend online ───────────────────────────────────────────────────────────

/**
 * Registra usuario en el backend. Retorna { ok, error }.
 */
export async function registerOnline({ firstName, lastName, email, password, phone, city }) {
  try {
    const data = await authApi.register({ firstName, lastName, email, password, phone, city });
    setToken(data.token);
    updateUser({ isRegistered: true, email: email.trim().toLowerCase(), firstName, lastName });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Inicia sesión en el backend. Retorna { ok, user, error }.
 */
export async function loginOnline(email, password) {
  try {
    const data = await authApi.login({ email, password });
    setToken(data.token);
    updateUser({
      isRegistered: true,
      email: data.user.email,
      firstName: data.user.firstName,
      lastName: data.user.lastName,
    });
    return { ok: true, user: data.user };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export function logoutOnline() {
  clearToken();
  updateUser({ isRegistered: false, onboardingComplete: false });
}

export function isOnlineAuthenticated() {
  return Boolean(getToken());
}

// ─── Fallback MVP (local) ─────────────────────────────────────────────────────

export function setRegisteredCredentials(email, password) {
  updateUser({
    email: email.trim().toLowerCase(),
    passwordMvp: password,
    isRegistered: true,
  });
}

export function markOnboardingComplete() {
  updateUser({ onboardingComplete: true });
}

export function isOnboardingComplete() {
  return Boolean(getUser().onboardingComplete);
}

export function isRegistered() {
  return Boolean(getUser().isRegistered && getUser().email);
}

export function validateLogin(email, password) {
  const user = getUser();
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!user.isRegistered) {
    return { valid: false, message: 'No hay cuenta registrada. Crea una cuenta primero.' };
  }

  if (normalizedEmail !== String(user.email || '').toLowerCase()) {
    return { valid: false, message: 'Correo no registrado en este dispositivo.' };
  }

  if (String(password) !== String(user.passwordMvp || '')) {
    return { valid: false, message: 'Contraseña incorrecta.' };
  }

  return { valid: true };
}

export function getPostLoginScreen() {
  return isOnboardingComplete() ? 'dashboard' : 'setupProfile';
}
