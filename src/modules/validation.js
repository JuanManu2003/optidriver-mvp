/**
 * Validaciones de formulario — MVP OptiDriver / FuelSense Pro (Chile)
 */

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const NAME_RE = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]{2,40}$/;

/** Solo dígitos del teléfono móvil chileno (9 + 8 dígitos) */
export function normalizeChilePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('569') && digits.length === 11) return digits.slice(2);
  if (digits.startsWith('56') && digits.length === 11) return digits.slice(2);
  if (digits.length === 9 && digits.startsWith('9')) return digits;
  if (digits.length === 8) return `9${digits}`;
  return digits;
}

export function isValidChileMobilePhone(raw) {
  const normalized = normalizeChilePhone(raw);
  return /^9\d{8}$/.test(normalized);
}

export function formatChilePhoneDisplay(raw) {
  const n = normalizeChilePhone(raw);
  if (!/^9\d{8}$/.test(n)) return raw;
  return `+56 ${n[0]} ${n.slice(1, 5)} ${n.slice(5)}`;
}

export function isValidEmail(value) {
  const v = String(value || '').trim();
  return v.length <= 254 && EMAIL_RE.test(v);
}

export function isValidName(value) {
  const v = String(value || '').trim();
  return NAME_RE.test(v);
}

export function isValidPassword(value) {
  const v = String(value || '');
  if (v.length < 6) return false;
  if (v.length > 64) return false;
  return /[a-zA-Z]/.test(v) && /\d/.test(v);
}

export function passwordsMatch(password, confirm) {
  return String(password) === String(confirm) && password.length > 0;
}

export function isNonEmpty(value) {
  return String(value || '').trim().length > 0;
}

export function isInList(value, list) {
  return list.includes(String(value || '').trim());
}

export function isValidVehicleYear(year) {
  const y = Number(year);
  const current = new Date().getFullYear();
  return Number.isInteger(y) && y >= 1995 && y <= current + 1;
}

export function setFieldError(inputId, message) {
  const input = document.getElementById(inputId);
  const errorEl = document.getElementById(`${inputId}-error`);
  if (input) input.classList.toggle('invalid', Boolean(message));
  if (errorEl) errorEl.textContent = message || '';
}

export function clearFieldErrors(fieldIds) {
  fieldIds.forEach((id) => setFieldError(id, ''));
}

export function showFormErrors(containerId, messages) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!messages.length) {
    el.classList.add('hidden');
    el.innerHTML = '';
    return;
  }
  el.classList.remove('hidden');
  el.innerHTML = `<strong>Revisa los siguientes campos:</strong><ul>${messages
    .map((m) => `<li>${m}</li>`)
    .join('')}</ul>`;
}

export function restrictPhoneInput(input) {
  if (!input) return;
  input.setAttribute('inputmode', 'numeric');
  input.setAttribute('autocomplete', 'tel-national');
  input.setAttribute('maxlength', '15');
  input.addEventListener('input', () => {
    input.value = input.value.replace(/[^\d+\s-]/g, '');
  });
}
