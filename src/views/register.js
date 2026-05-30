import { goTo } from '../modules/navigation.js';
import { updateUser } from '../modules/storage.js';
import { setRegisteredCredentials, registerOnline } from '../modules/auth.js';
import { bindAction } from '../components/Button.js';
import { showToast } from '../modules/telemetrySimulator.js';
import {
  isValidName, isValidEmail, isValidChileMobilePhone, isValidPassword,
  passwordsMatch, normalizeChilePhone, formatChilePhoneDisplay,
  setFieldError, clearFieldErrors, showFormErrors, restrictPhoneInput,
} from '../modules/validation.js';

const REGISTER_FIELDS = ['regFirstName', 'regLastName', 'regEmail', 'regPhone', 'regPassword', 'regPasswordConfirm'];

function validateRegisterForm() {
  clearFieldErrors(REGISTER_FIELDS);
  showFormErrors('registerErrors', []);

  const firstName      = document.getElementById('regFirstName')?.value?.trim() || '';
  const lastName       = document.getElementById('regLastName')?.value?.trim() || '';
  const email          = document.getElementById('regEmail')?.value?.trim() || '';
  const phoneRaw       = document.getElementById('regPhone')?.value?.trim() || '';
  const password       = document.getElementById('regPassword')?.value || '';
  const passwordConfirm = document.getElementById('regPasswordConfirm')?.value || '';

  const summary = [];
  let valid = true;

  if (!isValidName(firstName))  { setFieldError('regFirstName', 'Nombre válido, mín. 2 letras.'); summary.push('Nombre inválido.'); valid = false; }
  if (!isValidName(lastName))   { setFieldError('regLastName',  'Apellido válido, mín. 2 letras.'); summary.push('Apellido inválido.'); valid = false; }

  if (!email)                  { setFieldError('regEmail', 'El correo es obligatorio.'); summary.push('Correo requerido.'); valid = false; }
  else if (!isValidEmail(email)) { setFieldError('regEmail', 'Correo inválido (ej. nombre@dominio.cl).'); summary.push('Correo inválido.'); valid = false; }

  if (!phoneRaw)                         { setFieldError('regPhone', 'Teléfono obligatorio.'); summary.push('Teléfono requerido.'); valid = false; }
  else if (!isValidChileMobilePhone(phoneRaw)) { setFieldError('regPhone', '9 dígitos, comienza en 9.'); summary.push('Teléfono inválido.'); valid = false; }

  if (!password)                { setFieldError('regPassword', 'Contraseña obligatoria.'); summary.push('Contraseña requerida.'); valid = false; }
  else if (!isValidPassword(password)) { setFieldError('regPassword', 'Mín. 6 caracteres, una letra y un número.'); summary.push('Contraseña débil.'); valid = false; }

  if (!passwordConfirm)                   { setFieldError('regPasswordConfirm', 'Confirma tu contraseña.'); summary.push('Confirmación requerida.'); valid = false; }
  else if (!passwordsMatch(password, passwordConfirm)) { setFieldError('regPasswordConfirm', 'Las contraseñas no coinciden.'); summary.push('Contraseñas no coinciden.'); valid = false; }

  if (!valid) showFormErrors('registerErrors', summary);

  return {
    valid,
    data: {
      firstName, lastName,
      name: `${firstName} ${lastName}`.trim(),
      email,
      phone: normalizeChilePhone(phoneRaw),
      phoneDisplay: formatChilePhoneDisplay(normalizeChilePhone(phoneRaw)),
      password,
    },
  };
}

export function initRegister() {
  restrictPhoneInput(document.getElementById('regPhone'));

  bindAction('[data-action="register-submit"]', async () => {
    const result = validateRegisterForm();
    if (!result.valid) return;

    const btn = document.querySelector('[data-action="register-submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Registrando...'; }

    // Intentar registro en backend; fallback local si no responde
    const online = await registerOnline(result.data);
    if (!online.ok && online.error?.includes('registrado')) {
      showFormErrors('registerErrors', [online.error]);
      if (btn) { btn.disabled = false; btn.textContent = 'Crear cuenta'; }
      return;
    }

    // Guardar también en storage local (compatibilidad MVP offline)
    updateUser({
      firstName: result.data.firstName,
      lastName:  result.data.lastName,
      name:      result.data.name,
      phone:     result.data.phone,
      phoneDisplay: result.data.phoneDisplay,
      onboardingComplete: false,
    });
    setRegisteredCredentials(result.data.email, result.data.password);

    const profileName = document.getElementById('profileName');
    if (profileName) profileName.textContent = result.data.name;

    if (btn) { btn.disabled = false; btn.textContent = 'Crear cuenta'; }
    goTo('setupProfile');
  });
}
